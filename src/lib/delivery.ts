import type { AnyLead } from "./leads";
import { CONTROL_CHARS, INVISIBLE_FORMATTING } from "./invisible";
import { BlockedRequestError, safeFetch } from "./safe-fetch";

/**
 * ============================================================================
 * LEAD DELIVERY
 * ============================================================================
 *
 * Two real transports, both implemented as HTTP calls with no SDK dependency:
 *
 *   1. EMAIL — Resend (https://api.resend.com/emails)
 *   2. STORE — an HTTP endpoint that accepts JSON. Works with Airtable
 *      automations, Zapier/Make webhooks, a Supabase edge function, or a CRM
 *      intake URL. Email alone is not durable enough for a record that has to
 *      carry consent evidence.
 *
 * DEVELOPMENT vs PRODUCTION — this distinction is the point:
 *
 *   development, nothing configured  → transport "simulated", ok: true.
 *                                      The UI can be exercised. Nothing is
 *                                      delivered, and the response says so.
 *   production, nothing configured   → NO transports. The caller returns 503.
 *                                      Success is never reported.
 *   production, configured, failing  → transports report ok: false. The caller
 *                                      returns 502. Success is never reported.
 *
 * A transport is "ok" only when the remote service returned a 2xx.
 */

export type DeliveryResult = {
  transport: "email" | "store" | "simulated";
  ok: boolean;
  /**
   * HTTP status of the remote response, when there was one. Absent for
   * transport-level failures (DNS, TLS, timeout, connection refused).
   */
  status?: number;
  /**
   * A fixed category, never free text from the remote service. See
   * `FailureCategory` for why.
   */
  category?: FailureCategory;
  /**
   * A fixed note this codebase constructs — the development "simulated"
   * explanation, or the hop and reason for a blocked destination. NEVER
   * carries remote content, which is what makes it safe for `loggable` in the
   * route to pass through.
   */
  detail?: string;
};

/**
 * WHY FAILURES ARE CATEGORISED RATHER THAN QUOTED.
 *
 * The obvious way to log a failed delivery is to include the remote service's
 * response body. That is unsafe here. `LEAD_STORE_URL` points at an endpoint
 * the site operator chooses — an Airtable automation, a webhook, a CRM intake
 * URL — and such an endpoint may echo the payload it received back in its error
 * response. Since the payload IS the lead, quoting the body could copy a
 * person's name, email, telephone and health answer into the application log,
 * which is the one place this codebase has promised they never appear.
 *
 * So a failure is reduced, before it can ever reach a log line, to: which
 * transport, what HTTP status, and which of these categories.
 */
export type FailureCategory =
  /** The request never got an HTTP response: DNS, TLS, connection refused. */
  | "network"
  /** The request exceeded the 10s budget. */
  | "timeout"
  /** 401 or 403 — credentials rejected. */
  | "auth"
  /** 429 — the remote service is rate limiting us. */
  | "rate-limited"
  /** Any other 4xx — the remote service rejected the request as malformed. */
  | "rejected"
  /** Any 5xx — the remote service failed. */
  | "remote-error"
  /**
   * A 2xx that came back as an HTML page. Almost certainly a parked domain, a
   * captive portal or a stale URL rather than a lead store — reported as a
   * failure so it cannot masquerade as a delivery. See deliverStore.
   */
  | "not-a-store"
  /**
   * The configured URL, or somewhere it redirected to, is not a place this
   * application is willing to send a lead: a non-public address, an
   * unsupported scheme, a redirect loop, or too many hops. See safe-fetch.ts
   * and finding R4-14. Reported as a failure, never as a delivery.
   */
  | "blocked-destination";

function categorise(status: number): FailureCategory {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "remote-error";
  return "rejected";
}

/**
 * Releases a remote response body WITHOUT reading it.
 *
 * FINDING R3-M2. "Never read the response body" is the right security rule —
 * an operator-configured endpoint could echo the submitted lead back inside an
 * error page, and reading it would put that content one careless log line away
 * from disclosure. But *not reading* a body is not the same as *disposing* of
 * one. undici buffers an unconsumed body and keeps its connection out of the
 * pool, so the rule as originally implemented leaked both memory and sockets.
 * Measured, 30 responses of 8 MB each:
 *
 *     body left unread   rss  58 -> 558 MB   sockets opened 48 / closed 27
 *     body cancelled     rss 558 -> 318 MB   sockets opened 33 / closed 52
 *
 * `cancel()` discards the stream at the source: the bytes are never surfaced to
 * this process, nothing can be logged from them, and the connection is
 * released. It is the disposal the rule always needed, not a relaxation of it.
 *
 * Deliberately tolerant: a body may already be disposed (a 204 has none, and a
 * network error can destroy the stream), and failing to release a body must
 * never turn a successful delivery into a failed one.
 */
async function discardBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // Already released, or the stream died with the connection. Nothing to do,
    // and nothing about this is worth surfacing to the caller.
  }
}

/** Classifies a thrown fetch error without repeating any message content. */
function categoriseThrown(err: unknown): FailureCategory {
  const name = err instanceof Error ? err.name : "";
  return name === "TimeoutError" || name === "AbortError" ? "timeout" : "network";
}

/** A submission after the server has replaced every client-supplied claim. */
export type LeadRecord = {
  requestId: string;
  kind: AnyLead["kind"];
  receivedAt: string;
  /** Present only for kinds that carry a consent contract. */
  consent?: {
    version: string;
    /** The canonical server-side text — not what the browser sent. */
    text: string;
    /** Server-stamped. */
    givenAt: string;
    /**
     * Server-DERIVED from the lead kind and the canonical site URL. No request
     * header contributes to it. Null when this deployment has no canonical URL
     * configured — recording localhost would be a fiction (finding R2-03).
     */
    sourceUrl: string | null;
    /** Why the source URL is what it is, in words. */
    sourceUrlReason: string;
    /** Non-null ONLY when ipTrust === "proxy". */
    ip: string | null;
    ipTrust: "proxy" | "observed" | "unattributed";
    /** Why the address was or was not recorded. */
    ipReason: string;
    /**
     * Everything the client merely CLAIMED. Recorded for diagnostics, never as
     * evidence. Grouped under one key so the distinction cannot be lost by
     * someone reading the record later.
     */
    unverified: {
      clientReportedPage: string | null;
      clientReportedPageNote: string;
      userAgent: string | null;
    };
  };
  fields: Record<string, unknown>;
};

const isProduction = process.env.NODE_ENV === "production";

export function emailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY && process.env.LEAD_NOTIFY_EMAIL && process.env.LEAD_FROM_EMAIL
  );
}

export function storeConfigured() {
  return Boolean(process.env.LEAD_STORE_URL);
}

export function anyTransportConfigured() {
  return emailConfigured() || storeConfigured();
}

/* ── Rendering ────────────────────────────────────────────────────────────
   Plain text. A lead notification is read on a phone in a hurry, and the
   consent block has to be legible without a mail client rendering HTML.

   STRUCTURAL FORGERY. The body is line-oriented, so a value containing a line
   break used to be able to invent whole sections — a submitted name carrying
   CRLF produced a second, fake "Consent evidence" block above the real one,
   with a forged source URL and IP. The reader had no way to tell which was the
   server's.

   The rule now: A SUBMITTED VALUE CAN NEVER START A LINE. Every line break and
   every other control character inside a value is replaced before rendering,
   so user content is physically incapable of producing the section markers.
   Submitted values are additionally indented, so even a value that merely
   looks like a heading is visibly inside the submission block.
   ---------------------------------------------------------------------- */

/**
 * Flattens a submitted value to a single line.
 *
 * Covers CR, LF, CRLF, NEL (U+0085), LINE SEPARATOR (U+2028) and PARAGRAPH
 * SEPARATOR (U+2029) — the last three because some mail clients and terminals
 * break lines on them too — plus the remaining C0/C1 control characters, which
 * can reposition a cursor or colour a terminal.
 */
/** CR, LF, CRLF, NEL, LINE SEPARATOR, PARAGRAPH SEPARATOR. */
const LINE_BREAKS = /\r\n|[\r\n\u0085\u2028\u2029]/g;
/**
 * Remaining C0 and C1 control characters, and the invisible-formatting class,
 * both imported from lib/invisible.ts. They used to be declared here; finding
 * R6-04 showed the honeypot needed exactly the same rule and did not have it,
 * so the definition moved to one place both can import.
 */

/**
 * Invisible formatting characters that survive every check above (R3-L1).
 *
 * None of these is a control character or a line break, so both rules above
 * pass them straight through — and a notification is read by a person who is
 * about to act on it. The bidirectional overrides are the dangerous ones: an
 * unterminated U+202E reverses the rendering of everything after it, and
 * nothing here ever emits the U+202C that would end the override, so a name
 * ending in one can reorder the rest of the line in a mail client. This is the
 * "Trojan Source" family, applied to an inbox rather than a source file.
 *
 * The character class itself lives in lib/invisible.ts — see the note there,
 * and finding R6-04.
 */

export function flattenForNotification(value: unknown, max = 2000): string {
  const flattened = String(value)
    // Line breaks become a visible marker, so nothing is silently lost.
    .replace(LINE_BREAKS, " \u23CE ")
    // Any other control character is removed outright.
    .replace(CONTROL_CHARS, "")
    // ...as is anything invisible that could reorder or hide what follows.
    .replace(INVISIBLE_FORMATTING, "")
    .trim();
  return flattened.length > max ? `${flattened.slice(0, max)}\u2026 [truncated]` : flattened;
}

/**
 * Exported so the notification can be asserted on directly in tests — the
 * structural-forgery guarantee is a property of this function, and testing it
 * through a live SMTP provider would prove less, not more.
 */
export function renderEmail(record: LeadRecord): { subject: string; text: string } {
  const label =
    record.kind === "quote"
      ? "Quote request"
      : record.kind === "agent"
        ? "Producer application"
        : "Message";

  const lines: string[] = [
    `${label} — ${record.receivedAt}`,
    `Reference: ${record.requestId}`,
    "",
    "─── Submission (values below are supplied by the sender) ───",
  ];

  for (const [key, value] of Object.entries(record.fields)) {
    if (value === "" || value === undefined || value === null) continue;
    // Two leading spaces: submitted content is always visibly indented, and
    // flattenForNotification guarantees it occupies exactly one line.
    lines.push(`  ${flattenForNotification(key, 60)}: ${flattenForNotification(value)}`);
  }

  if (record.consent) {
    const c = record.consent;
    const ipLine = c.ip ?? `(not recorded — ${c.ipReason})`;

    lines.push(
      "",
      "─── Consent evidence (established by the server) ───",
      `Version:    ${c.version}`,
      `Given at:   ${c.givenAt}`,
      `Source URL: ${c.sourceUrl ?? `(not established — ${c.sourceUrlReason})`}`,
      `IP:         ${ipLine}`,
      "",
      "Exact text agreed to:",
      // Server constant. Flattened anyway so a future edit to the consent
      // wording cannot reintroduce a multi-line value here by accident.
      flattenForNotification(c.text, 4000),
      "",
      "─── Unverified (claimed by the browser, not proof) ───",
      `Reported page: ${flattenForNotification(c.unverified.clientReportedPage ?? "(none)", 300)}`,
      `User agent:    ${flattenForNotification(c.unverified.userAgent ?? "(none)", 400)}`
    );
  }

  return { subject: `${label} · ${record.requestId}`, text: lines.join("\n") };
}

/* ── Transports ───────────────────────────────────────────────────────── */

async function deliverEmail(record: LeadRecord): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY!;
  const from = process.env.LEAD_FROM_EMAIL!;
  // Producer applications go to the recruiting inbox when one is configured,
  // so recruiting never lands in the consumer queue.
  const to =
    record.kind === "agent" && process.env.AGENT_LEAD_NOTIFY_EMAIL
      ? process.env.AGENT_LEAD_NOTIFY_EMAIL
      : process.env.LEAD_NOTIFY_EMAIL!;

  const { subject, text } = renderEmail(record);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
      // FINDING R6-10 — see the note on the Turnstile call. A fixed host is not
      // a guarantee against redirection; this request carries the API key and
      // the whole lead, so a 3xx is an error rather than an instruction.
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });

    // The response body is NOT read — see FailureCategory above — but it IS
    // released, on every path, before anything else happens (finding R3-M2).
    await discardBody(res);

    if (!res.ok) {
      return {
        transport: "email",
        ok: false,
        status: res.status,
        category: categorise(res.status),
      };
    }
    return { transport: "email", ok: true, status: res.status };
  } catch (err) {
    return { transport: "email", ok: false, category: categoriseThrown(err) };
  }
}

async function deliverStore(record: LeadRecord): Promise<DeliveryResult> {
  const url = process.env.LEAD_STORE_URL!;
  const token = process.env.LEAD_STORE_TOKEN;

  try {
    /**
     * `safeFetch`, not `fetch` (finding R4-14). It validates the configured URL
     * and every redirect target against `ip-classify.ts` before connecting, and
     * re-issues this POST with its body at each hop rather than letting a
     * 301/302 degrade it into an empty GET that could be reported as a
     * successful delivery.
     */
    const res = await safeFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(10_000),
    });

    /**
     * The response body is NEVER read, and this transport is the reason the
     * rule exists: LEAD_STORE_URL is operator-configured, and a custom endpoint
     * could echo the lead it was just sent back in its error response.
     *
     * It IS released, here, on every path — status and headers are all this
     * function ever needs, and holding an unread body leaks memory and sockets
     * (finding R3-M2, see discardBody).
     */
    await discardBody(res);

    if (!res.ok) {
      return {
        transport: "store",
        ok: false,
        status: res.status,
        category: categorise(res.status),
      };
    }

    /**
     * A 2xx IS NOT AUTOMATICALLY A DELIVERY (finding R2-06).
     *
     * The realistic failure is not a hostile endpoint but a stale one: a
     * LEAD_STORE_URL that now points at a parked domain, a captive portal, a
     * marketing page or a decommissioned webhook whose host still answers 200.
     * Every one of those returns HTML. No JSON intake endpoint does — a webhook
     * answers with JSON, an empty body, or nothing at all.
     *
     * So an HTML content type is treated as a misconfiguration and reported as
     * a FAILURE, which surfaces as a 502 rather than a false success. The
     * response body is still never read; only the declared type is inspected.
     *
     * UNAVOIDABLE RESIDUE, STATED PLAINLY: an endpoint that answers 2xx with a
     * JSON or empty body and then discards the record is indistinguishable from
     * one that stores it. HTTP offers no signal for that, so the README asks
     * the operator to submit one test lead and confirm it arrived.
     */
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
    if (contentType === "text/html" || contentType === "application/xhtml+xml") {
      return {
        transport: "store",
        ok: false,
        status: res.status,
        category: "not-a-store",
      };
    }

    return { transport: "store", ok: true, status: res.status };
  } catch (err) {
    if (err instanceof BlockedRequestError) {
      return {
        transport: "store",
        ok: false,
        category: "blocked-destination",
        // Hop and reason only. Never the URL, never anything the remote sent.
        detail: `${err.block.reason} at hop ${err.block.hop}`,
      };
    }
    return { transport: "store", ok: false, category: categoriseThrown(err) };
  }
}

/* ── Orchestration ────────────────────────────────────────────────────── */

export async function deliverLead(record: LeadRecord): Promise<DeliveryResult[]> {
  const jobs: Promise<DeliveryResult>[] = [];
  if (emailConfigured()) jobs.push(deliverEmail(record));
  if (storeConfigured()) jobs.push(deliverStore(record));

  if (jobs.length > 0) return Promise.all(jobs);

  // Nothing configured.
  if (!isProduction) {
    // Development only. The response tells the caller this was simulated, so
    // no test can mistake it for a delivery that happened.
    return [
      {
        transport: "simulated",
        ok: true,
        detail: "development mode — no transport configured, nothing was delivered",
      },
    ];
  }

  return [];
}
