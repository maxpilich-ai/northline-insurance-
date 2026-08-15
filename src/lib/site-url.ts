import { resolveSiteUrl } from "./site-url-rules.mjs";

/**
 * ============================================================================
 * CANONICAL SITE URL — one definition, one fallback, one validator
 * ============================================================================
 *
 * WHY THIS FILE EXISTS. The site URL was previously declared in four places
 * with two different fallbacks: `http://localhost:3000` in the layout and the
 * metadata helper, `https://example.com` in robots.ts and sitemap.ts. With the
 * variable unset, the canonical tags and the sitemap therefore disagreed, and
 * the sitemap advertised a domain nobody owns.
 *
 * BUILD TIME, NOT RUN TIME. `NEXT_PUBLIC_*` variables are inlined by the
 * compiler. Setting NEXT_PUBLIC_SITE_URL when starting an already-built server
 * has NO effect — the value baked in at build time wins. On Vercel this is
 * invisible because the variable is present during the build. Anywhere that
 * builds an image once and configures it later (Docker, a CI artefact), the
 * variable must be present in the BUILD environment. next.config.mjs warns when
 * a production build runs without it, and FAILS the build when it is present
 * but unusable.
 *
 * VALIDATED, NOT MERELY PRESENT (finding R3-M3). The rule lives in
 * ./site-url-rules.mjs so that next.config.mjs and this module cannot drift
 * apart. Anything that is not an absolute http(s) URL with a real hostname is
 * treated exactly like an absent one: `SITE_URL_IS_FALLBACK` is true, and the
 * API refuses to write a consent record whose source it cannot state.
 */

const resolved = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, {
  isProduction: process.env.NODE_ENV === "production",
  allowLocal: process.env.ALLOW_LOCAL_SITE_URL === "1",
});

/** The development fallback. Used for rendering only — never as evidence. */
const FALLBACK = "http://localhost:3000";

/** Normalised: no trailing slash, so `${SITE_URL}${path}` is always correct. */
export const SITE_URL: string = resolved.url ?? FALLBACK;

/**
 * Why the configured value was or was not usable, in words, for logs and for
 * the consent record's `sourceUrlReason`.
 */
export const SITE_URL_STATUS: "configured" | "missing" | "invalid" =
  resolved.status as "configured" | "missing" | "invalid";

export const SITE_URL_REASON: string = resolved.reason;

/**
 * True when this deployment has no usable canonical URL — whether because the
 * variable was absent or because what it contained could not be used.
 *
 * Both cases mean the same thing to everything downstream: the server cannot
 * state where a person was standing when they consented, so it must not claim
 * to. Callers deliberately cannot tell the two apart.
 */
export const SITE_URL_IS_FALLBACK: boolean = resolved.status !== "configured";

/**
 * Origin only (scheme + host + port). Used as the server's own idea of where
 * it lives when deciding whether a client-reported URL is plausible — never
 * derived from a request header.
 */
export function siteOrigin(): string {
  try {
    return new URL(SITE_URL).origin;
  } catch {
    return FALLBACK;
  }
}
