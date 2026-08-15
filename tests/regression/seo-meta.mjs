/**
 * REGRESSION TESTS — indexing directives.
 *
 * FINDING R2-08 was reported as "the 404 emits two <meta name="robots"> tags".
 * It is recorded in app/not-found.tsx as NOT FIXED: the first tag is injected
 * by Next.js for any 404 response and is not configurable. Measured both ways,
 * declaring `robots` in not-found.tsx and omitting it produce identical output.
 *
 * Rather than assert the duplicate is gone — it is not — this file asserts the
 * property the finding was actually about: while this build is a demonstration
 * with unfilled placeholders, NOTHING on it may tell a crawler to index. That
 * holds whether one tag is served or two, and it would fail loudly if the root
 * layout's directive were ever dropped in an attempt to dedupe the 404.
 *
 *   node tests/regression/seo-meta.mjs http://127.0.0.1:PORT
 */
const BASE = process.argv[2] ?? "http://127.0.0.1:4801";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

const ROUTES = [
  "/", "/how-it-works", "/coverage", "/carriers", "/about", "/faq", "/quote",
  "/schedule", "/contact", "/careers", "/careers/apply", "/privacy", "/terms",
  "/styleguide", "/thank-you/quote", "/thank-you/message", "/thank-you/apply",
  "/thank-you/schedule", "/nope",
];

const robotsTags = (html) =>
  [...html.matchAll(/<meta\s+name="robots"\s+content="([^"]*)"/gi)].map((m) => m[1].toLowerCase());

console.log("\n=== every route refuses indexing while this is a demo ===");

const seen = {};
for (const route of ROUTES) {
  const html = await fetch(BASE + route).then((r) => r.text());
  seen[route] = robotsTags(html);
}

check("every route emits at least one robots directive",
  ROUTES.every((r) => seen[r].length > 0),
  ROUTES.filter((r) => seen[r].length === 0).join(", "));

check("no robots directive anywhere permits indexing",
  ROUTES.every((r) => seen[r].every((t) => /noindex/.test(t) && !/(^|[\s,])index/.test(t))),
  ROUTES.filter((r) => seen[r].some((t) => !/noindex/.test(t)))
    .map((r) => `${r}: ${seen[r].join(" | ")}`).join("; "));

check("every non-404 route carries exactly one robots tag",
  ROUTES.filter((r) => r !== "/nope").every((r) => seen[r].length === 1),
  ROUTES.filter((r) => r !== "/nope" && seen[r].length !== 1)
    .map((r) => `${r}: ${seen[r].length}`).join(", "));

/* The 404's duplicate is asserted as a KNOWN, BOUNDED condition rather than
   ignored: if Next ever stops injecting its tag, or the layout's directive is
   removed, this fails and the comment in not-found.tsx gets revisited. */
check("the 404's known framework duplicate is still exactly two agreeing tags",
  seen["/nope"].length === 2 && seen["/nope"].every((t) => t.startsWith("noindex")),
  seen["/nope"].join(" | "));

check("the root layout's directive is the stricter of the two on the 404",
  seen["/nope"].includes("noindex, nofollow"),
  seen["/nope"].join(" | "));

/* ══════════════════════════════════════════════════════════════════════════
   SHARE METADATA IS PER-ROUTE, NOT INHERITED (findings R3-M6 and R4-16)

   Next merges metadata between segments SHALLOWLY: a page that declares only a
   title keeps the root layout's `openGraph` object whole. R3-M6 fixed six
   routes that way; R4-16 found the seventh — the 404, which unfurled in Slack
   and iMessage as the homepage, complete with an `og:url` pointing at a page
   that exists, for an address that had just returned 404.

   Asserted for every route at once, so the next route added inherits the check
   rather than the bug.
   ══════════════════════════════════════════════════════════════════════════ */

console.log("\n=== share metadata is per-route, not inherited ===");
{
  const meta = {};
  for (const route of ROUTES) {
    const html = await fetch(BASE + route).then((r) => r.text());
    const grab = (prop) =>
      html.match(new RegExp(`<meta\\s+property="${prop}"\\s+content="([^"]*)"`, "i"))?.[1] ?? null;
    const grabName = (name) =>
      html.match(new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, "i"))?.[1] ?? null;
    meta[route] = { url: grab("og:url"), title: grab("og:title"), ogDesc: grab("og:description"), desc: grabName("description") };
  }

  const home = meta["/"];
  const others = ROUTES.filter((r) => r !== "/");

  check("the homepage publishes an og:url", Boolean(home.url), String(home.url));

  const inheritedUrl = others.filter((r) => meta[r].url && meta[r].url === home.url);
  check("no other route claims the homepage's og:url", inheritedUrl.length === 0, inheritedUrl.join(", "));

  const inheritedTitle = others.filter((r) => meta[r].title && meta[r].title === home.title);
  check("no other route claims the homepage's og:title", inheritedTitle.length === 0, inheritedTitle.join(", "));

  const inheritedDesc = others.filter((r) => meta[r].desc && meta[r].desc === home.desc);
  check("no other route claims the homepage's description", inheritedDesc.length === 0, inheritedDesc.join(", "));

  /* R4-16 specifically. The 404 must not assert a canonical address for itself:
     it is served for arbitrarily many URLs and none of them is canonical, so
     the honest value is no value at all. */
  check("the 404 asserts no og:url", meta["/nope"].url === null, String(meta["/nope"].url));
  check("the 404 has its own og:title", /not found/i.test(meta["/nope"].title ?? ""), String(meta["/nope"].title));
  check("the 404 has its own description", /does not exist/i.test(meta["/nope"].desc ?? ""), String(meta["/nope"].desc));
}

console.log("\n=== robots.txt and the crawl surface agree ===");
{
  const txt = await fetch(BASE + "/robots.txt").then((r) => r.text());
  check("robots.txt disallows everything", /Disallow:\s*\/\s*$/m.test(txt), txt.slice(0, 120));
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
