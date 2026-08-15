import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { IP_CLASS_REASON, classifyIp } from "./ip-classify";
import { SITE_URL, SITE_URL_IS_FALLBACK, SITE_URL_REASON, siteOrigin } from "./site-url";
import type { AnyLead } from "./leads";
import { routes } from "./site.config";

/**
 * ============================================================================
 * REQUEST IDENTITY — what the server may and may not believe about a caller
 * ============================================================================
 *
 * Everything in an HTTP request except the TCP peer is attacker-controlled.
 * This module draws that line explicitly so no caller has to remember it.
 *
 * TWO SEPARATE QUESTIONS, DELIBERATELY KEPT APART:
 *
 *   1. "Who do I RECORD as the source of this consent?"  — needs proof.
 *      Answered by `canonicalFormUrl` (server-derived) and by `clientIdentity`
 *      only when `trust === "proxy"`.
 *
 *   2. "Who do I COUNT this request against?"            — needs only stability.
 *      Answered by `rateLimitKey`, which ALWAYS returns a key. A caller must
 *      never be able to become anonymous to the rate limiter by sending a
 *      malformed header; that was finding R2-02.
 *
 * Conflating the two is what produced R2-02: an identity good enough to record
 * as evidence was being used as the precondition for counting at all, so
 * "unparseable" silently meant "uncounted".
 */

/* ══════════════════════════════════════════════════════════════════════════
   CONSENT SOURCE URL
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The page that hosts each form. Server-side knowledge, not a client claim.
 * If a form is ever moved, this map moves with it.
 */
const FORM_PAGE: Record<AnyLead["kind"], string> = {
  quote: routes.quote,
  agent: routes.apply,
  contact: routes.contact,
};

/**
 * The canonical, server-derived URL of the page whose form produced this lead,
 * or null when this deployment has no configured canonical URL.
 *
 * WHY IT CAN BE NULL (finding R2-03). The URL comes from NEXT_PUBLIC_SITE_URL,
 * which is inlined at BUILD time. A production image built without it would
 * otherwise record `http://localhost:3000/quote` as the place a real person
 * gave consent — a uniformly false statement in the one field whose entire
 * purpose is provability, and one no attacker had to touch. Recording nothing,
 * with the reason attached, is honest; recording localhost is not.
 *
 * The API refuses the submission outright in production rather than storing a
 * consent record it cannot describe — see app/api/lead/route.ts.
 */
export function canonicalFormUrl(kind: AnyLead["kind"]): string | null {
  if (SITE_URL_IS_FALLBACK) return null;
  return `${SITE_URL}${FORM_PAGE[kind]}`;
}

/** True when this build has no usable canonical site URL. */
export const CANONICAL_URL_UNAVAILABLE = SITE_URL_IS_FALLBACK;

/**
 * Why, in words. Distinguishes "never set" from "set to something unusable"
 * (finding R3-M3) so the operator is told which mistake they made.
 */
export const CANONICAL_URL_REASON = SITE_URL_REASON;

/**
 * What the browser SAID the page was — recorded for diagnostics only.
 *
 * Kept only when same-origin with this deployment's own canonical origin, and
 * stored under `consent.unverified` so its status cannot be misread.
 *
 * NOTE ON NORMALISATION (finding R2-10): `new URL()` resolves dot-segments, so
 * a Referer of `/a/%2e%2e/b` is stored as `/b` — a path the browser never
 * actually requested. That is one more reason this value is evidence of
 * nothing: it is a hint for a human reconstructing what happened, and the
 * field name says so.
 *
 * `X-Forwarded-Host` is deliberately NOT consulted. Comparing two headers the
 * attacker controls was the original H1 defect.
 */
export function clientReportedPage(req: Request): string | null {
  const referer = req.headers.get("referer");
  if (!referer) return null;
  try {
    const ref = new URL(referer);
    if (ref.origin !== siteOrigin()) return null;
    return `${ref.origin}${ref.pathname}`;
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   CLIENT IDENTITY
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * How much the deployment is willing to believe about who sent this request.
 *
 *   "proxy"        — TRUST_PROXY_HEADERS=1 and a forwarding header carried a
 *                    PUBLICLY ROUTABLE IP. Good enough to record as evidence.
 *   "observed"     — a forwarding header was present, but this deployment does
 *                    not vouch for it, or it was not a valid address, or it was
 *                    an address no member of the public can hold — loopback,
 *                    RFC 1918, link-local, cloud metadata (finding R4-18). Good
 *                    enough to COUNT against, never to record.
 *   "unattributed" — no forwarding header at all. Rare: Node/Next supply one
 *                    from the socket in every environment tested, so this is a
 *                    genuine last resort rather than the normal case.
 */
export type IdentityTrust = "proxy" | "observed" | "unattributed";

export type ClientIdentity = {
  /** The address, ONLY when trust === "proxy". Null otherwise, always. */
  ip: string | null;
  trust: IdentityTrust;
  /**
   * A stable, non-reversible key for rate limiting. Never null — see the note
   * at the top of this file.
   */
  key: string;
  /** Why the IP was or was not recorded, in words, for the consent record. */
  reason: string;
};

/**
 * DEPLOYMENT ASSUMPTION, STATED ONCE.
 *
 * Set TRUST_PROXY_HEADERS=1 only when every request reaches this application
 * through a proxy that OVERWRITES the forwarding headers — Vercel, Cloudflare,
 * an ALB, an nginx you configured. On those platforms the leftmost
 * X-Forwarded-For entry is the real client address and cannot be spoofed.
 *
 * Leave it unset when the application is reachable directly. The headers are
 * then used for counting but never recorded as evidence.
 */
export const TRUST_PROXY_HEADERS = process.env.TRUST_PROXY_HEADERS === "1";

/**
 * Is this string an actual IP address?
 *
 * Uses Node's own parser rather than a regular expression. A hand-rolled
 * "IPv6-ish" check — character class plus a colon — accepted `2001:db8:::::1`
 * and, under TRUST_PROXY_HEADERS, wrote that string into the consent record as
 * the client's address. Recording a value that is not an address in the field
 * whose purpose is provability is the same defect as R2-03 in a different
 * field. `net.isIP` returns 0 for anything that is not a real address.
 */
function looksLikeIp(value: string): boolean {
  const v = value.trim().replace(/^\[|\]$/g, "");
  if (!v || v.length > 45) return false;
  return isIP(v) !== 0;
}

/**
 * RFC 7239 `Forwarded: for=1.2.3.4;proto=https`.
 *
 * Reachability note (finding R2-09): behind Next.js an `x-forwarded-for` header
 * is always present, so this parser and the `x-real-ip` branch are only reached
 * by a runtime that does not synthesise one. They are kept because the module
 * is runtime-agnostic, and they are covered directly by unit tests rather than
 * only through the HTTP surface, where they are unreachable.
 */
function fromForwarded(header: string): string | null {
  const first = header.split(",")[0] ?? "";
  const match = first.match(/for=("?)\[?([^;,"\]]+)\]?\1/i);
  return match?.[2] ?? null;
}

/** Hashed so a rate-limit key can never become a store of raw addresses. */
function key(prefix: string, value: string): string {
  return `${prefix}:${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

/**
 * Resolves the caller into an identity that is ALWAYS usable for counting and
 * only sometimes usable as evidence.
 *
 * Exported as a pure function of headers so the branches that are unreachable
 * over HTTP behind Next can still be tested directly.
 */
export function identityFromHeaders(headers: {
  xff: string | null;
  realIp: string | null;
  forwarded: string | null;
}): ClientIdentity {
  /**
   * PRESENCE, NOT PARSEABILITY, decides whether the caller is attributable.
   *
   * An earlier revision of this function fell through to the "unattributed"
   * bucket whenever the header could not be parsed into something useful — so
   * sending `X-Forwarded-For:` (empty) landed in the shared bucket, which
   * carries a deliberately larger allowance. That handed a caller 20× the
   * normal budget for the price of one empty header: finding R2-02 in a new
   * costume, caught by the regression suite before it shipped.
   *
   * Now: if ANY forwarding header is present, the caller is "observed" and is
   * keyed on the literal header value — empty string included. Only a request
   * carrying none of the three headers is unattributable, and a caller cannot
   * manufacture that state on any runtime that synthesises one.
   */
  const present =
    headers.xff !== null || headers.realIp !== null || headers.forwarded !== null;

  const raw =
    (headers.xff ? headers.xff.split(",")[0]?.trim() : null) ||
    (headers.realIp ? headers.realIp.trim() : null) ||
    (headers.forwarded ? fromForwarded(headers.forwarded) : null) ||
    "";

  if (!present) {
    return {
      ip: null,
      trust: "unattributed",
      key: "unattributed",
      reason: "no forwarding header was present on the request",
    };
  }

  const valid = raw !== "" && looksLikeIp(raw);

  if (TRUST_PROXY_HEADERS && valid) {
    const ip = raw.replace(/^\[|\]$/g, "").split("%")[0]!;

    /**
     * SYNTACTICALLY VALID IS NOT THE SAME AS ATTRIBUTABLE (finding R4-18).
     *
     * `net.isIP` was the only question asked here, and it says yes to
     * `10.1.2.3`, `127.0.0.1` and `169.254.169.254`. Under
     * TRUST_PROXY_HEADERS all three were written into `consent.ip` — the one
     * field in the record whose entire purpose is to say who, out in the
     * world, agreed to something. None of them identifies a member of the
     * public: the first is somebody's LAN, the second is this machine, the
     * third is the cloud metadata service.
     *
     * This is R2-03 again in a third field. The pattern there was the right
     * one, so it is reused rather than reinvented: when the value would be a
     * fiction, record NOTHING and attach the reason, instead of recording
     * something false.
     *
     * WHY THIS DOES NOT BREAK LEGITIMATE PROXY DEPLOYMENTS. On Vercel,
     * Cloudflare, an ALB or a correctly configured nginx, the leftmost
     * X-Forwarded-For entry is the address the connection arrived from on the
     * public internet, which is by definition publicly routable. The requests
     * that lose their recorded IP here are exactly the ones where it was never
     * evidence to begin with: health checks from inside the VPC, an operator
     * on the office LAN, a local `next start`, and a proxy that was configured
     * to forward its own address instead of the client's.
     *
     * The request is NOT rejected and the caller is NOT exempted from
     * counting — trust falls back to "observed", which is the same state a
     * deployment that does not vouch for its headers is in.
     */
    const cls = classifyIp(ip);
    if (cls === "public") {
      return {
        ip,
        trust: "proxy",
        key: key("ip", ip),
        reason: "recorded from a forwarding header this deployment vouches for",
      };
    }

    return {
      ip: null,
      trust: "observed",
      key: key("ip", ip),
      reason:
        `a forwarding header this deployment vouches for carried ${IP_CLASS_REASON[cls]}, ` +
        "which cannot identify the person who submitted the form",
    };
  }

  // A header exists but is either unvouched-for or not an address. It is still
  // a perfectly good counting key — and MUST be, or malforming it would be a
  // way to opt out of rate limiting.
  return {
    ip: null,
    trust: "observed",
    // Keyed on the literal value, so an empty or malformed header is a bucket
    // like any other rather than an escape hatch.
    key: key("obs", raw === "" ? "<empty-forwarding-header>" : raw.slice(0, 200)),
    reason: TRUST_PROXY_HEADERS
      ? "a forwarding header was present but did not contain a valid IP address"
      : "forwarding headers are not trusted by this deployment (TRUST_PROXY_HEADERS is not set)",
  };
}

export function clientIdentity(req: Request): ClientIdentity {
  return identityFromHeaders({
    xff: req.headers.get("x-forwarded-for"),
    realIp: req.headers.get("x-real-ip"),
    forwarded: req.headers.get("forwarded"),
  });
}
