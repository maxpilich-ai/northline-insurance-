/**
 * ============================================================================
 * WHAT COUNTS AS A USABLE SITE URL — one rule, two readers
 * ============================================================================
 *
 * Plain JavaScript on purpose. `next.config.mjs` runs before TypeScript exists
 * and cannot import a `.ts` module; `lib/site-url.ts` needs the same rule at
 * runtime. Writing it twice is precisely the mistake finding R2-07 recorded —
 * two readers of one build-time variable, disagreeing about the fallback — so
 * the rule lives here and both import it.
 *
 * WHY THIS FILE EXISTS AT ALL (finding R3-M3). The previous guard asked only
 * whether NEXT_PUBLIC_SITE_URL was *set*:
 *
 *     SITE_URL_IS_FALLBACK = !process.env.NEXT_PUBLIC_SITE_URL
 *
 * so anything non-empty passed. `NEXT_PUBLIC_SITE_URL=northline.example` — a
 * missing protocol, one plausible typo — produced `IS_FALLBACK === false`, the
 * R2-03 refusal never fired, and every consent record stored
 * `sourceUrl: "northline.example/quote"`: a string that resolves to nothing, in
 * the one field whose entire purpose is provability. That is the exact defect
 * R2-03 was written to prevent, reachable by a one-character mistake. Absence
 * was guarded; nonsense was not.
 */

/**
 * @typedef {"configured" | "missing" | "invalid"} SiteUrlStatus
 * @typedef {{ status: SiteUrlStatus, url: string | null, reason: string }} SiteUrlResult
 */

/**
 * Hostnames that only ever mean "this machine".
 * @param {string} hostname
 * @returns {boolean}
 */
export function isLocalHostname(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "::1" ||
    h === "0.0.0.0" ||
    /^127\./.test(h)
  );
}

/**
 * True for an IPv4 or bracketed/plain IPv6 literal.
 * @param {string} hostname
 * @returns {boolean}
 */
function isIpLiteral(hostname) {
  const h = hostname.replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return h.split(".").every((o) => Number(o) <= 255);
  return /^[0-9a-f:]+$/i.test(h) && h.includes(":");
}

/**
 * Validates and normalises NEXT_PUBLIC_SITE_URL.
 *
 * status "configured" — `url` is a normalised absolute origin+path
 * status "missing"    — not set, or set to whitespace
 * status "invalid"    — set to something unusable; `reason` says what
 *
 * @param {string | undefined | null} raw the environment value
 * @param {{ isProduction?: boolean, allowLocal?: boolean }} [opts]
 * @returns {SiteUrlResult}
 *
 * Deliberately permissive about the things real deployments legitimately do:
 * a sub-path deploy (https://host/app) is fine, http is fine (a reverse proxy
 * may terminate TLS), an IP literal is fine, an internationalised punycode host
 * is fine, and a trailing slash is normalised away rather than rejected.
 */
export function resolveSiteUrl(raw, opts = {}) {
  const { isProduction = false, allowLocal = false } = opts;

  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { status: "missing", url: null, reason: "NEXT_PUBLIC_SITE_URL is not set" };
  }

  const trimmed = String(raw).trim();
  /** @type {(reason: string) => SiteUrlResult} */
  const invalid = (reason) => ({ status: "invalid", url: null, reason });

  // A newline in an environment value is never intentional and travels badly
  // into anything that later concatenates it.
  if (/[\r\n\t]/.test(trimmed)) return invalid("contains a line break or tab");

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return invalid(
      `"${trimmed.slice(0, 60)}" is not an absolute URL (a missing https:// prefix is the usual cause)`
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return invalid(`uses the unsupported protocol "${parsed.protocol}" — only http and https are valid`);
  }
  if (!parsed.hostname) return invalid("has no hostname");
  if (parsed.username || parsed.password) return invalid("contains embedded credentials");
  if (parsed.search) return invalid("contains a query string");
  if (parsed.hash) return invalid("contains a fragment");

  const local = isLocalHostname(parsed.hostname);

  // A bare label like "intranet" is almost always a truncated value. Real
  // deployments have a dot, an IP literal, or are explicitly local.
  if (!local && !isIpLiteral(parsed.hostname) && !parsed.hostname.includes(".")) {
    return invalid(`"${parsed.hostname}" is not a fully-qualified hostname`);
  }

  /**
   * Localhost in a production build is an error unless the operator says
   * otherwise. This project's own test harness legitimately runs production
   * builds against 127.0.0.1, so there has to be a door — but it is an
   * explicit, deliberate one (ALLOW_LOCAL_SITE_URL=1) rather than a silent
   * default. "Production must never SILENTLY fall back to localhost" is the
   * requirement, and a door someone had to open is not silence.
   */
  if (local && isProduction && !allowLocal) {
    return invalid(
      `points at "${parsed.hostname}", which is this machine. A production build needs the ` +
        `public URL. Set ALLOW_LOCAL_SITE_URL=1 if a local production build is genuinely intended.`
    );
  }

  // Normalised: origin + path, no trailing slash, so `${SITE_URL}${path}` is
  // always correct and never doubles a separator.
  const url = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
  return {
    status: "configured",
    url,
    reason: local ? "configured (local address, explicitly allowed)" : "configured",
  };
}
