import { resolveSiteUrl } from "./src/lib/site-url-rules.mjs";

/**
 * Build-time configuration checks.
 *
 * Turnstile is a single switch, not two. If exactly one of the two keys is
 * present the configuration is incoherent — either a widget that protects
 * nothing, or a server demanding a token the browser cannot produce. Both are
 * worse than having no Turnstile at all, because the visible half implies the
 * invisible half exists.
 *
 * A production build refuses to complete in that state. Development warns
 * loudly and continues, so local work is not blocked by a missing secret.
 */
function resolveTurnstile() {
  const site = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const secret = Boolean(process.env.TURNSTILE_SECRET_KEY);

  if (site !== secret) {
    const detail = site
      ? "NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is missing."
      : "TURNSTILE_SECRET_KEY is set but NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing.";
    const message =
      `\n[config] Incoherent Turnstile configuration. ${detail}\n` +
      `[config] Set both keys, or neither. Refusing to build a deployment whose ` +
      `spam protection is half-present.\n`;

    if (process.env.NODE_ENV === "production" || process.env.CI) {
      throw new Error(message);
    }
    console.warn(message);
    return "0";
  }

  return site && secret ? "1" : "0";
}

const TURNSTILE_ENABLED = resolveTurnstile();

/**
 * The canonical site URL is inlined at BUILD time, not read at run time.
 * Setting it when starting an already-built server has no effect, which is a
 * genuinely surprising failure: canonical tags and the sitemap would silently
 * advertise localhost.
 *
 * TWO DIFFERENT FAILURES, TREATED DIFFERENTLY (finding R3-M3):
 *
 *   ABSENT  — warn and continue. A build with no site URL is a legitimate
 *             thing to do while developing, and the API refuses consent-bearing
 *             submissions at runtime rather than recording a localhost source.
 *   INVALID — FAIL the build. A value that is present but unusable is not a
 *             choice, it is a typo, and it is worse than absence: the old guard
 *             only asked whether the variable was set, so `northline.example`
 *             (no protocol) sailed through and every consent record stored a
 *             source URL that resolves to nothing. Nobody would have noticed
 *             until a dispute. Fail loudly at the only moment the value can
 *             still be changed.
 *
 * The rule itself is shared with lib/site-url.ts — see site-url-rules.mjs.
 */
const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, {
  isProduction: process.env.NODE_ENV === "production" || Boolean(process.env.CI),
  allowLocal: process.env.ALLOW_LOCAL_SITE_URL === "1",
});

if (siteUrl.status === "invalid") {
  throw new Error(
    `\n[config] NEXT_PUBLIC_SITE_URL is set but unusable: it ${siteUrl.reason}.\n` +
      `[config] This value is inlined AT BUILD TIME and becomes the canonical URL,\n` +
      `[config] the Open Graph URL, every sitemap entry, and the source URL recorded\n` +
      `[config] as consent evidence. Refusing to build a deployment whose consent\n` +
      `[config] records would cite a URL that does not resolve.\n`
  );
}

if (siteUrl.status === "missing" && (process.env.NODE_ENV === "production" || process.env.CI)) {
  console.warn(
    "\n[config] NEXT_PUBLIC_SITE_URL is not set for this build.\n" +
      "[config] Canonical URLs, Open Graph URLs and sitemap.xml will point at\n" +
      "[config] http://localhost:3000, and the API will REFUSE consent-bearing\n" +
      "[config] submissions rather than record that as the source. This value is\n" +
      "[config] inlined AT BUILD TIME — setting it later will not change the output.\n"
  );
}

/* ── Security headers ─────────────────────────────────────────────────────
   Applied to every response. Deliberately minimal and explicit: each
   allowance below exists because something on this site needs it, and nothing
   is widened "just in case".

   CSP notes, in the order a reader will wonder about them:

   · 'unsafe-inline' for script-src — Next.js App Router bootstraps hydration
     with inline scripts carrying the flight payload. A nonce would require
     rendering every route dynamically, which would trade the entire static
     build for a marginal gain. This is the standard trade for a statically
     rendered Next app.
   · 'unsafe-inline' for style-src — next/font emits an inline <style> block,
     and Tailwind's utilities arrive in a stylesheet from 'self'.
   · challenges.cloudflare.com — the Turnstile widget's script, iframe and
     network calls. Added ONLY when Turnstile is actually enabled, from the same
     single switch the widget reads, so the two cannot disagree (R3-L4).
   · data: for img-src — the icon is an inline SVG.
   · frame-ancestors 'none' — this site is never framed. It is the clickjacking
     control; X-Frame-Options repeats it for older agents.
   · form-action 'self' — the forms post to this origin's API route and nowhere
     else, so a script that rewrote a form target could not exfiltrate to a
     third party.
   ---------------------------------------------------------------------- */
/**
 * The Turnstile host is allowed ONLY when Turnstile is actually on
 * (finding R3-L4). It was previously in script-src, connect-src and frame-src
 * unconditionally, so the shipped demonstration build — which has Turnstile
 * disabled — permitted script execution and framing from a third-party origin
 * it never contacts. A permission nothing uses is a permission granted for
 * free, and this one is derived from the same single switch as the widget, so
 * the two cannot drift apart.
 */
const TURNSTILE_HOST = "https://challenges.cloudflare.com";
const cf = TURNSTILE_ENABLED === "1" ? ` ${TURNSTILE_HOST}` : "";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${cf}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${cf}`,
  // With Turnstile off there is no third-party frame to allow at all.
  TURNSTILE_ENABLED === "1" ? `frame-src ${TURNSTILE_HOST}` : "frame-src 'none'",
  "manifest-src 'self'",
  ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here uses a camera, a microphone, geolocation or payment APIs.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Harmless over plain HTTP; meaningful the moment the site is served over TLS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Stop advertising the framework and its version to every caller.
  poweredByHeader: false,

  // A static export has no server to send headers, so Next ignores this config
  // there (and says so). The headers must then come from the static host —
  // documented in README under the static-preview note.
  ...(process.env.STATIC_EXPORT === "1"
    ? {}
    : {
        async headers() {
          return [{ source: "/:path*", headers: SECURITY_HEADERS }];
        },
      }),

  env: {
    // Derived, never set by hand. Both the browser and the server read this
    // one value, so they cannot disagree about whether Turnstile is on.
    NEXT_PUBLIC_TURNSTILE_ENABLED: TURNSTILE_ENABLED,
  },

  // `STATIC_EXPORT=1 npm run build` produces a self-contained folder that opens
  // in a browser with no server. It EXCLUDES the /api routes, so the forms
  // cannot submit — it is a visual preview only, never a deployment target.
  ...(process.env.STATIC_EXPORT === "1"
    ? {
        output: "export",
        images: { unoptimized: true },
        trailingSlash: true,
        ...(process.env.GH_PAGES_BASE
          ? { basePath: process.env.GH_PAGES_BASE, assetPrefix: process.env.GH_PAGES_BASE }
          : {}),
      }
    : {}),
};

export default nextConfig;
