import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  anyLeadSchema,
  canonicalLicensedState,
  carriesConsent,
  consentContractFor,
  licensedStates,
  type AnyLead,
} from "@/lib/leads";
import {
  anyTransportConfigured,
  deliverLead,
  type DeliveryResult,
  type LeadRecord,
} from "@/lib/delivery";
import { hasVisibleContent } from "@/lib/invisible";
import { TURNSTILE_ENABLED, turnstileSecret } from "@/lib/turnstile";
import { describeTurnstileConfig, turnstileIntendedButInert } from "@/lib/turnstile.server";
import {
  CANONICAL_URL_REASON,
  CANONICAL_URL_UNAVAILABLE,
  TRUST_PROXY_HEADERS,
  canonicalFormUrl,
  clientIdentity,
  clientReportedPage,
  type ClientIdentity,
} from "@/lib/request-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The two delivery transports each carry a 10s timeout and run in parallel, so
 * the worst case is ~10s plus overhead. Declared explicitly rather than left to
 * a platform default that may be lower — a truncated function produces an
 * opaque platform 504 with no log line instead of this route's honest 502.
 */
export const maxDuration = 20;

/**
 * ============================================================================
 * LEAD INTAKE
 * ============================================================================
 *
 * TRUST BOUNDARY. Everything in the request body is attacker-controlled.
 * Specifically, the server does NOT trust the client for:
 *
 *   · consent evidence — the canonical text and version come from the server's
 *     own constants, selected by lead.kind. The client's echoed values are
 *     compared and rejected on mismatch, then discarded.
 *   · the timestamp — stamped here.
 *   · the source URL — DERIVED from lead.kind and the canonical site URL. No
 *     request header contributes to it. What the browser claimed is kept
 *     separately under `consent.unverified`. See lib/request-identity.ts.
 *   · the client IP — recorded only when the deployment explicitly vouches for
 *     its forwarding headers (TRUST_PROXY_HEADERS=1); otherwise null, with the
 *     reason recorded alongside it.
 *   · the state of residence — validated against the configured licence
 *     footprint, not merely narrowed by a menu in the browser.
 *
 * DELIVERY. Success is reported only when a real transport returns 2xx.
 * In development with nothing configured the response is explicitly marked
 * `delivery: "simulated"`. In production nothing configured returns 503, and a
 * configured transport that fails returns 502.
 */

/* ── Rate limiting ────────────────────────────────────────────────────────

   REDESIGNED AFTER FINDINGS R2-01 AND R2-02.

   The previous version had one counter shared by everyone, checked as the very
   first thing in the handler. Two consequences, both demonstrated:

     R2-01  Sixty empty POSTs — no body, no content-type, no valid payload —
            exhausted the shared budget and returned 429 to every other visitor
            on the site. Cheap invalid traffic could deny the whole lead
            pipeline for the price of one request per second.
     R2-02  The per-caller bucket was skipped entirely when the identity could
            not be parsed, so sending `X-Forwarded-For: not-an-ip` opted the
            caller out of per-caller limiting altogether.

   THE REDESIGN RESTS ON THREE RULES.

   1. INVALID TRAFFIC AND VALID TRAFFIC HAVE SEPARATE BUDGETS.
      A rejected request can never consume the capacity reserved for real lead
      submissions. The submission budget is charged at ONE point — immediately
      before delivery, once the request has passed content type, body size,
      JSON parse, schema, Turnstile, honeypot, consent and the licence
      footprint. Everything rejected anywhere before that is charged to a
      different, per-caller counter instead.

      Widened after finding R4-04: the charge previously sat before Turnstile,
      so a Turnstile refusal, a consent mismatch or an unlicensed state still
      spent a submission despite delivering nothing — which made a forged
      forwarding header a silent way to exhaust a specific visitor's budget.
      tests/regression/budget-matrix.mjs asserts the attribution of every exit
      status so this cannot drift again.

   2. EVERY CALLER HAS A COUNTING KEY, ALWAYS.
      lib/request-identity.ts guarantees a key even when the forwarding header
      is absent, malformed or untrusted. There is no branch in which a caller
      is uncounted, so malforming a header cannot buy more capacity than
      sending a valid one — it buys exactly the same.

   3. NO UNAUTHENTICATED GLOBAL HARD GATE.
      Nothing one caller does can produce a 429 for a different caller. The
      global counter is now OFF by default and exists only as an opt-in
      runaway guard (LEAD_RATE_LIMIT_GLOBAL); when an operator does set it, it
      is charged only by valid submissions, so it cannot be driven by garbage.

   WHAT THIS DELIBERATELY DOES NOT SOLVE. On a deployment with no trusted
   proxy, a caller who rotates the forwarding header still gets a fresh bucket
   each time; the counters are per-instance and non-durable besides. Bounding
   that requires state this prototype should not invent — the honeypot and
   Turnstile sit in front of it, and a real deployment should set
   TRUST_PROXY_HEADERS=1 behind a proxy that overwrites the header (where
   rotation is impossible) or apply a WAF rule at the edge. Documented in
   README rather than papered over, because the alternative — a global gate —
   is what produced R2-01.
   ---------------------------------------------------------------------- */

const WINDOW_MS = 60_000;

/** Well-formed lead submissions per caller per window. */
const MAX_SUBMISSIONS_PER_IDENTITY = positiveInt(process.env.LEAD_RATE_LIMIT_PER_IDENTITY, 5);

/**
 * Rejected requests per caller per window (415, 413, 400, 422).
 *
 * Deliberately looser than the submission limit: a person fixing a validation
 * error should never hit it, while a script firing garbage exhausts its OWN
 * budget and nobody else's.
 */
const MAX_REJECTS_PER_IDENTITY = positiveInt(process.env.LEAD_RATE_LIMIT_REJECTS, 30);

/**
 * Optional global runaway guard, charged ONLY by valid submissions.
 * Unset by default: a global gate that anyone can trip is finding R2-01.
 */
const MAX_GLOBAL_SUBMISSIONS = positiveInt(process.env.LEAD_RATE_LIMIT_GLOBAL, 0);

/**
 * The "unattributed" key is shared by every caller that arrives with none of
 * the three forwarding headers. That is the shape of the original M8 lockout,
 * so it gets a larger allowance rather than the standard one.
 *
 * The multiplier is deliberately modest. A larger one would be worth
 * manufacturing: any caller who could place themselves in this bucket would buy
 * that multiple of the normal budget. lib/request-identity.ts makes the bucket
 * unselectable — presence of ANY forwarding header is enough to be "observed" —
 * and in every runtime tested Next supplies one, so this is a genuine last
 * resort rather than the normal path.
 */
const UNATTRIBUTED_MULTIPLIER = 4;

/**
 * Reads a non-negative integer from the environment.
 *
 * An ABSENT or BLANK variable means "use the default" (finding R3-L12). It
 * previously did not: `Number("")` is 0 and 0 is a non-negative integer, so an
 * env line written as `LEAD_RATE_LIMIT_PER_IDENTITY=` — a natural way to write
 * "leave this alone" — silently set the ceiling to zero and answered 429 to
 * every submission the deployment ever received. An explicit `0` still means
 * zero, because that is a deliberate act.
 */
function positiveInt(raw: string | undefined, fallback: number) {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

type Counter = { count: number; resetAt: number };

/** Two independent maps: one for accepted work, one for rejected noise. */
const submissionHits = new Map<string, Counter>();
const rejectHits = new Map<string, Counter>();
const globalSubmissions: Counter = { count: 0, resetAt: 0 };

function sweep(map: Map<string, Counter>, now: number) {
  if (map.size < 5000) {
    map.forEach((entry, key) => {
      if (now > entry.resetAt) map.delete(key);
    });
    return;
  }
  // Above the cap, drop only EXPIRED entries; never clear wholesale, which
  // would hand every tracked caller a fresh budget.
  const expired: string[] = [];
  map.forEach((entry, key) => {
    if (now > entry.resetAt) expired.push(key);
  });
  expired.forEach((k) => map.delete(k));
}

/** Charges one unit and reports whether the ceiling has been passed. */
function charge(map: Map<string, Counter>, key: string, max: number, now: number): boolean {
  sweep(map, now);
  const entry = map.get(key) ?? { count: 0, resetAt: 0 };
  map.set(key, entry);
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + WINDOW_MS;
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

/**
 * Gives one unit back.
 *
 * FINDING R6-03. The submission budget is charged immediately BEFORE delivery,
 * which is deliberate — it is the admission control that stops many concurrent
 * requests all passing the ceiling check before any of them has been counted.
 * But a charge taken before an attempt is only correct if the attempt is then
 * refunded when it fails. It was not, so a store outage spent the visitor's
 * five submissions on five error pages: measured 502,502,502,502,502,429 — the
 * site told a real person to try again and then refused them, during the exact
 * window in which the operator most wants the lead.
 *
 * The window is NOT reset or extended here; only the count moves. A refund can
 * never create budget that did not exist, and never below zero.
 */
function refund(map: Map<string, Counter>, key: string): void {
  const entry = map.get(key);
  if (entry && entry.count > 0) entry.count -= 1;
}

/**
 * Charged when a request is rejected before it could prove it was a lead.
 * Affects only the caller that sent it.
 */
function rejectionBudgetExceeded(identity: ClientIdentity): boolean {
  const max =
    identity.trust === "unattributed"
      ? MAX_REJECTS_PER_IDENTITY * UNATTRIBUTED_MULTIPLIER
      : MAX_REJECTS_PER_IDENTITY;
  return charge(rejectHits, identity.key, max, Date.now());
}

/**
 * Charged once a request has proved it is a well-formed lead. This is the
 * budget that actually protects the business, and garbage cannot touch it.
 */
function submissionBudgetExceeded(identity: ClientIdentity): { limited: boolean; scope?: string } {
  const now = Date.now();
  const max =
    identity.trust === "unattributed"
      ? MAX_SUBMISSIONS_PER_IDENTITY * UNATTRIBUTED_MULTIPLIER
      : MAX_SUBMISSIONS_PER_IDENTITY;

  if (charge(submissionHits, identity.key, max, now)) return { limited: true, scope: "identity" };

  if (MAX_GLOBAL_SUBMISSIONS > 0) {
    if (now > globalSubmissions.resetAt) {
      globalSubmissions.count = 1;
      globalSubmissions.resetAt = now + WINDOW_MS;
    } else {
      globalSubmissions.count += 1;
      if (globalSubmissions.count > MAX_GLOBAL_SUBMISSIONS) return { limited: true, scope: "global" };
    }
  }
  return { limited: false };
}

/**
 * Undoes `submissionBudgetExceeded` for a lead that was charged and then not
 * delivered (finding R6-03). Mirrors it exactly: whatever that function
 * incremented, this decrements, including the opt-in global counter.
 */
function refundSubmissionBudget(identity: ClientIdentity): void {
  refund(submissionHits, identity.key);
  if (MAX_GLOBAL_SUBMISSIONS > 0 && globalSubmissions.count > 0) {
    globalSubmissions.count -= 1;
  }
}

/* ── Request body size ────────────────────────────────────────────────────
   A valid lead is under 8 KB. Everything above the ceiling is rejected before
   the body is read, so a large payload costs the process nothing: no buffering,
   no JSON parse, no schema walk. Content-Length can be absent or a lie, so the
   body is also read through a counting stream that aborts at the same ceiling.
   ---------------------------------------------------------------------- */

const MAX_BODY_BYTES = 64 * 1024;

class BodyTooLarge extends Error {}

/**
 * Reads the body with a hard byte ceiling. Chunks are counted as they arrive
 * and the read is abandoned the moment the ceiling is passed, so a 40 MB
 * upload is discarded after 64 KB rather than assembled in memory.
 */
async function readBoundedText(req: Request): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new BodyTooLarge();

  const body = req.body;
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLarge();
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

/** Exact media-type match. `application/jsonEVIL` is not JSON. */
function isJsonContentType(header: string | null): boolean {
  if (!header) return false;
  const type = header.split(";")[0]?.trim().toLowerCase();
  return type === "application/json";
}

/* ── Turnstile ────────────────────────────────────────────────────────────

   FAIL-OPEN IS AN INTENTIONAL DESIGN DECISION, NOT AN OVERSIGHT.

   When a token is missing or Cloudflare says the token is invalid, the
   submission is refused (403). But when Cloudflare itself cannot be REACHED —
   a network partition, a Cloudflare outage, an 8-second timeout — this route
   allows the submission through rather than blocking it.

   The trade: an unreachable verifier would otherwise take the contact forms of
   a small brokerage offline for the duration of someone else's outage. A
   life insurance enquiry is high-value and low-volume; a lost one costs more
   than an occasional spam message that still has to clear the honeypot and the
   rate limiter.

   The honest consequence: **Turnstile does not guarantee spam prevention under
   every network condition.** An attacker who can reliably block the server's
   egress to challenges.cloudflare.com can bypass it. Anyone who would rather
   fail CLOSED should return false in the catch below and accept that the forms
   stop accepting submissions whenever Cloudflare is unreachable. Every such
   event is logged, so the choice is observable either way.
   ---------------------------------------------------------------------- */

/** Distinguishes "the visitor failed the check" from "this deployment is misconfigured". */
class TurnstileMisconfigured extends Error {}

async function turnstileOk(token: string | undefined, ip: string | null) {
  /**
   * FINDING R6-02 — the deployment was given Turnstile keys but this image was
   * built without them, so the gate below is inert. Refuse rather than accept
   * unverified submissions while the startup log claims protection is on.
   *
   * Checked HERE, in front of the gate, rather than at module load: it must
   * produce the same deliberate 503 the other misconfiguration states produce,
   * not a boot crash that takes the whole site down when only submissions are
   * affected.
   */
  if (turnstileIntendedButInert()) {
    throw new TurnstileMisconfigured(
      "Turnstile keys are present in the environment but this image was built " +
        "without them (NEXT_PUBLIC_TURNSTILE_ENABLED is not set). No token can " +
        "be verified. Rebuild with both keys present."
    );
  }

  if (!TURNSTILE_ENABLED) return true;

  let secret: string;
  try {
    secret = turnstileSecret(); // throws if enabled without a secret
  } catch (err) {
    // The build guard prevents this, so reaching it means the environment
    // changed after the build — the secret was removed from the running
    // deployment. Refuse, but as a deliberate 503 rather than an unhandled
    // stack trace, so the visitor sees the form's normal failure message.
    throw new TurnstileMisconfigured(err instanceof Error ? err.message : "misconfigured");
  }
  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      // remoteip is optional; sending a value the deployment does not vouch for
      // would only teach Cloudflare a fiction.
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      // FINDING R6-10. `safeFetch` guards the operator-configured store URL;
      // this host is hard-coded, but "hard-coded" is not the same as "cannot
      // redirect". `redirect: "error"` rejects any 3xx outright, so a hijacked
      // or misrouted response can never send this POST — which carries the
      // secret — anywhere else. Cloudflare does not redirect siteverify; if it
      // ever starts, this fails loudly instead of following.
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Deliberate fail-open — see the block comment above this function.
    console.warn("[lead] turnstile verification unreachable — allowing (fail-open by design)");
    return true;
  }
}

/* ── Logging ──────────────────────────────────────────────────────────────
   No lead PII is ever logged. Not the name, email, telephone, notes or health
   answer. Nor is any remote service's response body: a custom LEAD_STORE_URL
   could echo the submitted lead back in an error, so a failure is reduced to
   four fields — request id, transport, HTTP status, failure category — and
   nothing else is ever passed to a log line. The IP appears only on rejection
   paths, where it is the diagnostic subject rather than incidental.
   ---------------------------------------------------------------------- */

/**
 * Strips every result down to the fields that are safe to log.
 *
 * `detail` is included, and is safe by the contract on `DeliveryResult`: it is
 * always a fixed string this codebase constructs, never anything a remote
 * service sent back. It carries the hop and reason for a blocked destination
 * (finding R4-14), which is the difference between an operator being able to
 * see that their store redirects into the VPC and their seeing only that
 * something failed.
 */
function loggable(results: DeliveryResult[]) {
  return results.map((r) => ({
    transport: r.transport,
    ok: r.ok,
    status: r.status,
    category: r.category,
    detail: r.detail,
  }));
}

function logDelivery(requestId: string, kind: string, results: DeliveryResult[]) {
  console.info("[lead] delivery", { requestId, kind, results: loggable(results) });
}

/* ── One-time configuration report ────────────────────────────────────────
   Printed on the first request this instance serves, so the deployed posture is
   a log line rather than a guess. No secret values, only whether each control
   is on and where the identity comes from. ------------------------------- */

let configReported = false;

function reportConfigurationOnce() {
  if (configReported) return;
  configReported = true;
  const turnstile = describeTurnstileConfig();
  console.info("[lead] configuration", {
    turnstile: turnstile.message,
    proxyHeaders: TRUST_PROXY_HEADERS ? "trusted" : "not trusted — no IP recorded",
    canonicalUrl: CANONICAL_URL_UNAVAILABLE
      ? "NOT CONFIGURED — consent submissions are refused in production"
      : "configured",
    transports: anyTransportConfigured() ? "configured" : "none",
    maxBodyBytes: MAX_BODY_BYTES,
    rateLimit: {
      submissionsPerIdentity: MAX_SUBMISSIONS_PER_IDENTITY,
      rejectionsPerIdentity: MAX_REJECTS_PER_IDENTITY,
      globalSubmissions: MAX_GLOBAL_SUBMISSIONS === 0 ? "disabled" : MAX_GLOBAL_SUBMISSIONS,
      windowMs: WINDOW_MS,
    },
  });
}

/* ── Handler ──────────────────────────────────────────────────────────── */

export async function POST(req: Request) {
  reportConfigurationOnce();
  const requestId = randomUUID();
  const identity = clientIdentity(req);

  /**
   * A rejection helper, so every early exit charges the SAME budget — the
   * per-caller rejection counter, never the submission counter and never a
   * global one. Getting this wrong in either direction is R2-01.
   */
  const reject = (status: number, error: string) => {
    if (rejectionBudgetExceeded(identity)) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    return NextResponse.json({ error }, { status });
  };

  // ── Cheap checks first, decided from headers alone ─────────────────────
  if (!isJsonContentType(req.headers.get("content-type"))) {
    return reject(415, "Unsupported content type.");
  }

  let body: unknown;
  try {
    const text = await readBoundedText(req);
    body = JSON.parse(text);
  } catch (err) {
    if (err instanceof BodyTooLarge) {
      console.warn("[lead] rejected oversized body", { requestId });
      return reject(413, "Request body too large.");
    }
    return reject(400, "Malformed request.");
  }

  const parsed = anyLeadSchema.safeParse(body);
  if (!parsed.success) {
    // Field paths only — never the submitted values.
    if (rejectionBudgetExceeded(identity)) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    return NextResponse.json(
      {
        error: "Validation failed.",
        issues: parsed.error.issues.map((i) => i.path.join(".")),
      },
      { status: 422 }
    );
  }

  const lead: AnyLead = parsed.data;

  /* ── Turnstile ───────────────────────────────────────────────────────
     The submission budget is NOT charged yet. See the note above the charge
     itself, further down: it is spent only by a lead that has passed every
     check and is about to be delivered. Everything that fails between here and
     there is charged to the rejection budget instead.

     ORDER: TURNSTILE BEFORE THE HONEYPOT (finding R4-13). The audit timed the
     two outcomes and found the honeypot answered measurably sooner than a real
     submission — a bot can detect the trap by stopwatch and simply stop filling
     the field. With the honeypot first, the trap skipped the single most
     expensive thing a real submission does: the network round-trip to
     Cloudflare. Verifying first makes that cost common to both paths, so the
     largest component of the tell is gone in every deployment that has
     Turnstile configured — which is the deployment this ordering is for. The
     residual gap, and why it is not closed with an artificial delay, is written
     up at the honeypot itself.
     ------------------------------------------------------------------- */
  try {
    if (!(await turnstileOk(lead.turnstileToken, identity.ip))) {
      return reject(403, "Verification failed.");
    }
  } catch (err) {
    if (err instanceof TurnstileMisconfigured) {
      console.error("[lead] REFUSED — Turnstile enabled without a secret at runtime", {
        requestId,
        detail: err.message,
      });
      return NextResponse.json(
        { error: "Submissions are temporarily unavailable.", requestId },
        { status: 503 }
      );
    }
    throw err;
  }

  /* ── Honeypot ───────────────────────────────────────────────────────────
     Humans never see this field. Return 200 so a bot learns nothing from the
     response, but deliver nothing.

     THE TRAP IS METERED (finding R3-H1). Until Round 3 this branch returned
     200 and charged NOTHING — it sat after the schema check and before the
     submission counter, so a well-formed lead with the honeypot filled was the
     one request class that reached JSON parsing, full schema validation and the
     log with no counter of any kind. 120 of 120 succeeded from a single
     identity, and that identity's real budgets were still untouched
     afterwards. The traffic the honeypot exists to identify was the traffic
     least constrained by the limiter.

     WHICH BUDGET, AND WHY THE REJECTION ONE.
     Honeypot traffic is charged to the per-caller REJECTION budget, not the
     submission budget, for two reasons:

       · A forged forwarding header lets one caller be counted as another (a
         known and documented limitation on deployments with no trusted proxy).
         If honeypot hits charged the submission budget, that would become a
         cheap way to consume a specific visitor's five real submissions.
         Charged to the rejection budget, it cannot block anybody's genuine
         enquiry.
       · The honeypot has a documented false-positive mode — an aggressive
         password manager or an accessibility tool that fills every field. A
         real person caught by that must not lose the capacity to send the
         enquiry they are still in the middle of writing.

     WHAT A BOT LEARNS. Under budget the answer is 200 and delivery silently
     does not happen, exactly as before. Over budget the answer is 429 — the
     same answer every other over-budget path gives, so the honeypot is not
     singled out. The previous behaviour was in fact the stronger tell: an
     endpoint that answers 200 forever while ordinary traffic starts refusing
     at five is a difference a probing client can measure. The residual
     difference in ceilings is documented in the README rather than papered
     over.

     The trap is LOGGED. A silent drop means a false positive destroys a real
     enquiry with no trace at all. The log line carries no submitted values.

     TIMING (finding R4-13) — PARTIALLY MITIGATED, RESIDUE DOCUMENTED.
     Measured medians: honeypot 5.0ms, real submission 8.1ms, a 1.62x ratio, so
     a bot can identify the trap without ever seeing a different status code.
     This check now runs AFTER Turnstile rather than before it, which puts the
     verification round-trip — tens of milliseconds, and the dominant term in
     any configured deployment — on both paths. What remains is delivery: a real
     submission then talks to Resend and/or the lead store, and the honeypot
     does not.

     THAT RESIDUE IS DELIBERATELY LEFT.
       · Closing it means either performing a delivery for traffic the honeypot
         exists to stop, which defeats the control, or sleeping for a synthetic
         interval. A fixed sleep is itself a fingerprint; a random one is
         averaged out by the same repeated sampling that found the tell.
       · The impact is bounded. What a bot learns is "this field is a trap",
         and the field is already discoverable — it is in the HTML, and its
         hiding is done in CSS that any scraper can read. The honeypot has never
         been a control that survives a determined attacker; it is a cheap first
         filter in front of Turnstile and the two budgets, both of which are
         unaffected by this knowledge.
       · Blocks nothing. Not the demo, not publication, not production. */
  /*
     TRIMMED BEFORE IT IS BELIEVED (finding R4-12).

     `lead.company` was tested for raw truthiness, so a single space, a tab or a
     newline counted as "a bot filled the trap" and the enquiry was silently
     dropped. Every one of those is far likelier to come from an autofill or a
     stray keystroke than from a bot, and the visitor is told nothing — they get
     a 200 and no lead is delivered. A bot that fills the field puts something
     in it; whitespace is not something.

     Note "0" IS still a hit: it is a real character a real bot would type, and
     JavaScript's falsy `0` is a string quirk, not an intent signal.

     WIDENED BY FINDING R6-04. `trim()` was the whole test, and it does not
     remove zero-width characters — so U+200B, U+200D and U+00AD were read as
     "a bot filled the trap" and the enquiry was silently discarded with a 200,
     while a byte-order mark in the same position was tolerated. The question
     is now asked by `hasVisibleContent`, which strips the same invisible class
     the notification renderer strips. One rule, both callers.
  */
  if (hasVisibleContent(lead.company)) {
    const throttled = rejectionBudgetExceeded(identity);
    console.warn("[lead] honeypot tripped — not delivered", {
      requestId,
      kind: lead.kind,
      throttled,
    });
    if (throttled) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── Consent: server-authoritative ──────────────────────────────────────
  const receivedAt = new Date().toISOString();
  let consent: LeadRecord["consent"];

  if (carriesConsent(lead)) {
    const contract = consentContractFor(lead.kind);

    /**
     * REFUSE RATHER THAN RECORD A FICTION (finding R2-03).
     *
     * The source URL is derived from NEXT_PUBLIC_SITE_URL, which is inlined at
     * BUILD time. An image built without it would otherwise record
     * `http://localhost:3000/quote` as the page where a real person consented.
     * That is a false statement in the field whose only purpose is provability,
     * and nothing at runtime would reveal it.
     *
     * In production the submission is refused with a configuration error, so
     * the operator finds out immediately instead of discovering a year of
     * worthless consent records during a dispute. In development the record is
     * still written, with sourceUrl null and the reason attached, so the demo
     * and the test suite remain usable without configuration.
     */
    if (CANONICAL_URL_UNAVAILABLE && process.env.NODE_ENV === "production") {
      console.error(
        "[lead] REFUSED — NEXT_PUBLIC_SITE_URL was not set at build time, so the " +
          "consent source URL cannot be established. Rebuild with the variable set.",
        { requestId, kind: lead.kind }
      );
      return NextResponse.json(
        { error: "Submissions are temporarily unavailable.", requestId },
        { status: 503 }
      );
    }

    // The schema already requires consent === true. These two checks confirm
    // the form displayed the contract this server believes applies. A mismatch
    // means a stale client, a tampered payload, or a form wired to the wrong
    // constant — none of which should produce a stored consent record.
    if (lead.consentVersion !== contract.version) {
      console.warn("[lead] consent version mismatch", {
        requestId,
        kind: lead.kind,
        expected: contract.version,
        received: lead.consentVersion,
      });
      return reject(409, "Consent version mismatch. Please reload the page and try again.");
    }

    if (lead.consentText !== contract.text) {
      console.warn("[lead] consent text mismatch", { requestId, kind: lead.kind });
      return reject(409, "Consent text mismatch. Please reload the page and try again.");
    }

    // Stored evidence is the SERVER's, never the client's.
    //
    //  · text/version — the server's own constants, chosen by lead.kind
    //  · givenAt      — stamped here
    //  · sourceUrl    — derived from lead.kind and the canonical site URL.
    //                   No request header contributes to it, so there is
    //                   nothing for an attacker to forge.
    //  · ip           — present only when the deployment vouches for the
    //                   forwarding headers; otherwise null with the reason.
    //
    // clientReportedPage and userAgent are recorded as UNVERIFIED: useful when
    // reconstructing what happened, never presented as proof of anything.
    consent = {
      version: contract.version,
      text: contract.text,
      givenAt: receivedAt,
      sourceUrl: canonicalFormUrl(lead.kind),
      // When there is no usable canonical URL the record says WHICH failure it
      // was — absent, or present but unusable (finding R3-M3). "Not configured"
      // and "configured as nonsense" need different remedies from the operator.
      sourceUrlReason: CANONICAL_URL_UNAVAILABLE
        ? `no usable canonical site URL at build time — ${CANONICAL_URL_REASON}`
        : "derived on the server from the form kind and the canonical site URL",
      ip: identity.ip,
      ipTrust: identity.trust,
      ipReason: identity.reason,
      unverified: {
        clientReportedPage: clientReportedPage(req),
        clientReportedPageNote:
          "claimed by the browser via Referer; normalised by URL parsing; not evidence",
        userAgent: (req.headers.get("user-agent") ?? "").slice(0, 400) || null,
      },
    };
  }

  // ── Licensed state: the business rule, enforced here ───────────────────
  // Only the answers a person actually gave. The transport fields, the client's
  // consent echo, and the values the record already carries at the top level
  // (kind, and the consent boolean that the consent block supersedes) are all
  // dropped, so `fields` is exactly the submission and nothing else.
  const fields: Record<string, unknown> = { ...lead };
  for (const key of ["company", "turnstileToken", "consentText", "consentVersion", "consent", "kind"]) {
    delete fields[key];
  }

  if (lead.kind === "quote") {
    const states = licensedStates();
    if (states.length === 0) {
      // No footprint configured, so the rule cannot be applied. Say so rather
      // than let the absence pass unnoticed.
      console.warn(
        "[lead] licence footprint not configured — state of residence was accepted unvalidated",
        { requestId }
      );
    } else {
      const canonical = canonicalLicensedState(lead.state);
      if (!canonical) {
        // Defence in depth: the schema already rejects this.
        if (rejectionBudgetExceeded(identity)) {
          return NextResponse.json({ error: "Too many requests." }, { status: 429 });
        }
        return NextResponse.json({ error: "Validation failed.", issues: ["state"] }, { status: 422 });
      }
      fields.state = canonical;
    }
  }

  const record: LeadRecord = { requestId, kind: lead.kind, receivedAt, consent, fields };

  /* ── Submission budget: charged HERE, and only here ───────────────────
     FINDING R4-04. This charge used to sit before Turnstile, so anything that
     failed after it — a Turnstile refusal, a consent version or text mismatch,
     an unlicensed state — spent one of the caller's five submissions despite
     delivering nothing. That contradicted the rule the whole two-budget design
     exists to enforce: only a well-formed, acceptable lead may consume the
     capacity reserved for real enquiries.

     It mattered beyond tidiness. On a deployment whose origin is reachable
     without the proxy, forging a victim's forwarding header and sending six
     deliberately mismatched consent payloads exhausted that victim's budget
     while delivering nothing at all — a lockout with no spam for the operator
     to notice. Measured before this change: six forged 409s, then the victim's
     own valid submission answered 429.

     Now the request has passed content type, size, JSON, schema, Turnstile,
     the honeypot, consent and the licence footprint. It is a real lead about to be
     delivered, and that is the only thing this budget is for.
     ------------------------------------------------------------------- */
  const limit = submissionBudgetExceeded(identity);
  if (limit.limited) {
    console.warn("[lead] submission rate limit reached", {
      requestId,
      scope: limit.scope,
      trust: identity.trust,
    });
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  // ── Delivery ───────────────────────────────────────────────────────────
  const configured = anyTransportConfigured();
  const results = await deliverLead(record);
  logDelivery(requestId, lead.kind, results);

  /**
   * A LEAD THAT WAS NOT DELIVERED DOES NOT SPEND A SUBMISSION (finding R6-03).
   *
   * The unit taken before the delivery attempt is given back, and the request
   * is charged to the REJECTION budget instead — the same budget every other
   * "this did not become a lead" outcome uses. That keeps a bound on retries
   * during an outage (a caller cannot hammer a failing transport for free)
   * while leaving the visitor's five real submissions untouched, so the form
   * still works the moment the transport recovers.
   */
  const notDelivered = () => {
    refundSubmissionBudget(identity);
    return rejectionBudgetExceeded(identity);
  };

  /**
   * Once the rejection budget IS exhausted, say so. Answering 502 forever would
   * make a failing transport an unbounded amount of work per caller — the
   * refund would have removed the only ceiling instead of moving it.
   */
  const tooManyRetries = () =>
    NextResponse.json({ error: "Too many requests." }, { status: 429 });

  if (!configured && process.env.NODE_ENV === "production") {
    console.error("[lead] NOT DELIVERED — no transport configured in production", {
      requestId,
      kind: lead.kind,
    });
    if (notDelivered()) return tooManyRetries();
    return NextResponse.json(
      { error: "Lead could not be delivered.", requestId },
      { status: 503 }
    );
  }

  const delivered = results.filter((r) => r.ok);
  if (delivered.length === 0) {
    console.error("[lead] NOT DELIVERED — every configured transport failed", {
      requestId,
      kind: lead.kind,
      results: loggable(results),
    });
    if (notDelivered()) return tooManyRetries();
    return NextResponse.json(
      { error: "Lead could not be delivered.", requestId },
      { status: 502 }
    );
  }

  const simulated = delivered.every((r) => r.transport === "simulated");

  return NextResponse.json({
    ok: true,
    requestId,
    // The caller can always tell a real delivery from a development stub.
    delivery: simulated ? "simulated" : "delivered",
    transports: delivered.map((r) => r.transport),
  });
}
