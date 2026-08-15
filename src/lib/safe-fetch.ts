import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { classifyIp, isPubliclyRoutable, type IpClass } from "./ip-classify";

/**
 * ============================================================================
 * OUTBOUND REQUESTS TO OPERATOR-CONFIGURED URLS
 * ============================================================================
 *
 * FINDING R4-14. `LEAD_STORE_URL` is set by the site operator, so the first
 * hop is trust-on-first-use and that is fine. The redirect chain is not.
 * `fetch` follows redirects by default, and the audit demonstrated a store
 * answering `302 Location: http://169.254.169.254/latest/meta-data/` causing
 * this process to issue a request to the cloud instance-metadata service. The
 * response body is never read, so the disclosure is limited to a
 * status/category oracle — but "the exfiltration channel is narrow" is not a
 * control, and the same chain reaches anything else inside the perimeter.
 *
 * There is a second, quieter defect in the same place. `fetch` implements the
 * browser rule that a 301/302/303 turns a POST into a GET. A lead store that
 * moved and answers `301` would therefore have received an empty GET; if that
 * GET returned `200 application/json`, `deliverStore` reported `ok: true` and
 * the lead was reported delivered while never having been sent. A false
 * success in delivery is worse than a failure, because nothing tells anyone.
 *
 * SO THIS MODULE DOES THREE THINGS:
 *
 *   1. Refuses any REDIRECT TARGET whose host is not publicly routable —
 *      literal IPs are classified directly, hostnames are resolved first and
 *      EVERY returned address must pass. Uses `ip-classify.ts`, the same
 *      predicate that decides whether an address may be recorded as consent
 *      evidence.
 *   2. Follows redirects manually, re-issuing the ORIGINAL method and body at
 *      each hop, so a moved store still receives the record instead of an
 *      empty GET.
 *   3. Caps the chain and detects loops.
 *
 * WHERE THE TRUST BOUNDARY ACTUALLY IS. The configured URL is checked for
 * scheme only. It is not checked for routability, and that is deliberate: a
 * lead store on `http://10.0.2.15/intake`, on a Docker service name, or on
 * `127.0.0.1` beside the app is an ordinary and legitimate deployment, and this
 * project's own test harness is one of them. Refusing it would not be
 * hardening, it would be breaking self-hosted installs to defend against the
 * operator's own configuration file. What the operator does NOT control is
 * where that endpoint redirects to — that is chosen by whatever is answering,
 * which may be compromised, stale, or somebody else's domain entirely. So the
 * boundary sits exactly there: hop 0 is trusted because a human wrote it, hops
 * 1+ are not because a remote server chose them.
 *
 * THE ONE EXCEPTION, AND WHY. A redirect to the SAME ORIGIN as the configured
 * URL is allowed even when that host is private — otherwise the near-universal
 * `http` -> `https` redirect on an internal store would be read as an attack.
 * It reaches nothing new: the operator already pointed this application at that
 * exact endpoint.
 *
 * THE PORT IS PART OF THE EXCEPTION, and finding that out is why this note is
 * longer than it looks. An earlier revision matched on hostname alone, which
 * the Round 5 security recheck broke immediately: a store on
 * `http://127.0.0.1:8080/intake` could answer `302 Location:
 * http://127.0.0.1:22/` and this application would connect to SSH. Same host,
 * different service. The status/timing difference between "connected" and
 * "refused" is a port scanner of the machine the app runs on, delivered through
 * the one URL the operator was allowed to choose. Matching the origin — scheme,
 * host AND port — closes it, with one carve-out for the http -> https upgrade
 * on the same host, which is the case the exception exists for.
 *
 * RESIDUAL RISK, STATED PLAINLY — DNS REBINDING. The name is resolved for the
 * check and then resolved again by `fetch` when it connects, so a name that
 * answers with a public address on the first lookup and a private one on the
 * second would defeat the check. Closing that needs the request pinned to the
 * validated address, which means a custom undici dispatcher with its own
 * `connect`, and TLS certificate verification against the original hostname.
 * That is a real amount of machinery for a URL the operator chose themselves,
 * and the audit's scenario — a compromised or hostile *store* redirecting us —
 * is fully covered by hop validation. Documented rather than silently
 * accepted; if this codebase ever fetches a URL a *user* supplies, the pinning
 * dispatcher becomes mandatory and this note is the reason why.
 */

export type SafeFetchBlock = {
  /** Which hop failed: 0 is the URL as configured, 1+ are redirect targets. */
  hop: number;
  reason:
    | "bad-url"
    | "unsupported-scheme"
    | "unresolvable-host"
    | "not-publicly-routable"
    | "too-many-redirects"
    | "redirect-loop"
    | "redirect-without-location";
  /** The address class that caused a "not-publicly-routable" block. */
  ipClass?: IpClass;
};

export class BlockedRequestError extends Error {
  readonly block: SafeFetchBlock;
  constructor(block: SafeFetchBlock) {
    // Deliberately free of the URL and of any remote content: this message can
    // end up in a log, and the same rule that stops delivery.ts quoting a
    // response body applies here.
    super(`outbound request blocked at hop ${block.hop}: ${block.reason}`);
    this.name = "BlockedRequestError";
    this.block = block;
  }
}

/** How many redirects to follow before giving up. */
const MAX_REDIRECTS = 3;

/** Effective port, since `URL.port` is empty for the scheme's default. */
function portOf(url: URL): string {
  return url.port || (url.protocol === "https:" ? "443" : "80");
}

/**
 * Is `url` the endpoint the operator configured, or its https upgrade?
 *
 * Host and port must match exactly. The scheme may only change in one
 * direction — http to https on the same host — because that is the redirect
 * this exception exists for and the only one that cannot reach a new service.
 * A downgrade to http is NOT matched: it would let a redirect strip TLS from a
 * lead in flight.
 */
function sameEndpoint(url: URL, origin: URL): boolean {
  const host = url.hostname.replace(/^\[/, "").replace(/\]$/, "");
  const originHost = origin.hostname.replace(/^\[/, "").replace(/\]$/, "");
  if (host !== originHost) return false;
  if (url.protocol === origin.protocol) return portOf(url) === portOf(origin);
  // http -> https upgrade, on the port each scheme uses by default.
  return (
    origin.protocol === "http:" &&
    url.protocol === "https:" &&
    portOf(origin) === "80" &&
    portOf(url) === "443"
  );
}

/**
 * Asserts that a URL may be requested.
 *
 * `hop` 0 is the operator's own configured URL and is checked for scheme only;
 * see the trust-boundary note at the top of this file. Every later hop was
 * chosen by a remote server and must be publicly routable, unless it is the
 * same endpoint the operator configured (`origin`).
 *
 * Exported so the rule can be tested directly, without standing up a
 * redirecting server for every case.
 */
export async function assertRequestable(
  url: URL,
  hop: number,
  origin?: URL
): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BlockedRequestError({ hop, reason: "unsupported-scheme" });
  }

  const host = url.hostname.replace(/^\[/, "").replace(/\]$/, "");

  // The operator's own URL. A human chose it; this module is not here to
  // second-guess that, only to stop a remote server redirecting us elsewhere.
  if (hop === 0) return;

  // The operator's own endpoint, redirecting within itself — an http -> https
  // upgrade or a /a -> /b move. Reaches nothing the operator did not already
  // point us at, so it is permitted whatever the address class.
  //
  // Compared as an ORIGIN, not a hostname: same host on a different port is a
  // different service, and allowing it turns the store URL into a scanner of
  // whatever else the machine is running. See the note at the top of the file.
  if (origin !== undefined && sameEndpoint(url, origin)) return;

  // A literal address needs no lookup — and must not get one, since resolving
  // it would be a no-op that only adds a place to go wrong.
  if (isIP(host) !== 0) {
    const cls = classifyIp(host);
    if (cls !== "public") {
      throw new BlockedRequestError({ hop, reason: "not-publicly-routable", ipClass: cls });
    }
    return;
  }

  let addresses: { address: string }[];
  try {
    // `all: true` matters. Resolving only the first address lets a name with
    // one public and one private answer pass the check and then connect to
    // whichever the resolver hands the connection — every address must pass.
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new BlockedRequestError({ hop, reason: "unresolvable-host" });
  }

  if (addresses.length === 0) {
    throw new BlockedRequestError({ hop, reason: "unresolvable-host" });
  }

  for (const { address } of addresses) {
    if (!isPubliclyRoutable(address)) {
      throw new BlockedRequestError({
        hop,
        reason: "not-publicly-routable",
        ipClass: classifyIp(address),
      });
    }
  }
}

/**
 * `fetch`, with every hop validated and redirects re-issued rather than
 * downgraded.
 *
 * Throws `BlockedRequestError` when a hop is refused. Any other throw is an
 * ordinary transport failure and is left for the caller to classify.
 */
export async function safeFetch(
  target: string,
  init: RequestInit & { headers: Record<string, string>; method: string; body: string }
): Promise<Response> {
  let origin: URL;
  try {
    origin = new URL(target);
  } catch {
    throw new BlockedRequestError({ hop: 0, reason: "bad-url" });
  }
  return followRedirects(target, init, (url, hop) => assertRequestable(url, hop, origin));
}

/**
 * The redirect-following half, with the hop check passed in.
 *
 * WHY THE SEAM EXISTS. The two halves of this module fail in different ways
 * and have to be tested in different ways. The hop check is a pure function of
 * an address and is tested exhaustively against every address class. The
 * redirect logic is only observable against a real HTTP server that actually
 * emits 301/302/307/308, loops and missing `Location` headers — and any server
 * this test suite can start is on loopback, which the hop check correctly
 * refuses. Testing the redirect logic therefore requires substituting the
 * check; testing the check requires no server at all.
 *
 * This is an internal seam, not a configuration point: nothing outside this
 * file passes a different check, `safeFetch` is the only exported way to make
 * a request, and `deliverStore` calls `safeFetch`. `tests/regression/
 * ssrf-redirect.mjs` asserts end-to-end, through the running API with a
 * loopback `LEAD_STORE_URL`, that the strict check is the one in force.
 */
export async function followRedirects(
  target: string,
  init: RequestInit & { headers: Record<string, string>; method: string; body: string },
  assertHop: (url: URL, hop: number) => Promise<void>
): Promise<Response> {
  let current: URL;
  try {
    current = new URL(target);
  } catch {
    throw new BlockedRequestError({ hop: 0, reason: "bad-url" });
  }

  const seen = new Set<string>();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertHop(current, hop);

    // Normalised so `http://h/a` and `http://h/a` reached by different routes
    // collapse to one entry, and a two-URL ping-pong is caught as a loop
    // rather than merely as "too many".
    const fingerprint = current.href;
    if (seen.has(fingerprint)) {
      throw new BlockedRequestError({ hop, reason: "redirect-loop" });
    }
    seen.add(fingerprint);

    const res = await fetch(current, { ...init, redirect: "manual" });

    if (res.status < 300 || res.status > 399) return res;

    const location = res.headers.get("location");
    // The body of a redirect is of no interest and must be released before the
    // next hop, or the connection stays out of the pool (finding R3-M2).
    try {
      await res.body?.cancel();
    } catch {
      /* already disposed */
    }

    if (!location) {
      throw new BlockedRequestError({ hop, reason: "redirect-without-location" });
    }

    if (hop === MAX_REDIRECTS) {
      throw new BlockedRequestError({ hop: hop + 1, reason: "too-many-redirects" });
    }

    try {
      current = new URL(location, current);
    } catch {
      throw new BlockedRequestError({ hop: hop + 1, reason: "bad-url" });
    }

    /**
     * METHOD AND BODY ARE PRESERVED ON EVERY 3xx, INCLUDING 301/302/303.
     *
     * This deviates from the fetch specification on purpose. The spec's
     * rewrite-to-GET exists so that a browser re-navigating after a form post
     * does not resubmit it. This client is not navigating; it is delivering a
     * record to an endpoint the operator nominated, and "the endpoint moved"
     * must not mean "the record was silently dropped and the move reported as
     * a success". Re-issuing the POST is what every webhook sender does, and
     * it is the only behaviour here that cannot lose a lead.
     */
  }

  // Unreachable: the loop either returns, throws, or exits via the
  // `hop === MAX_REDIRECTS` guard above.
  throw new BlockedRequestError({ hop: MAX_REDIRECTS + 1, reason: "too-many-redirects" });
}
