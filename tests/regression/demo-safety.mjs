/**
 * REGRESSION TESTS — H7 (demo product claims) and the surrounding demo-safety
 * guarantees (M11, M12, and the "no invented credentials" rule).
 *
 *   node tests/regression/demo-safety.mjs http://127.0.0.1:PORT
 *
 * The property under test: while the site is in demonstration mode, nothing it
 * renders may read as a verified statement about a real, licensed business.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:4501";
const ROUTES = ["/", "/how-it-works", "/coverage", "/carriers", "/about", "/faq", "/quote",
  "/schedule", "/contact", "/careers", "/careers/apply", "/privacy", "/terms",
  "/thank-you/quote", "/thank-you/message", "/thank-you/apply", "/thank-you/schedule", "/nope"];

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const textOf = async (route) => {
  await page.goto(BASE + route, { waitUntil: "load" });
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
};

console.log("=== H7 · the product section cannot read as a verified offering ===");
{
  const text = await textOf("/coverage");
  check("the 'what we place' claim is gone while products are unconfirmed",
    !/The coverage we can arrange/i.test(text) && !/\bWhat we place\b/i.test(text));
  check("the section is labelled as demonstration content",
    /Demonstration content/i.test(text));
  check("the product list is still present (not deleted to pass a test)",
    /Term Life Insurance/.test(text) && /Whole Life Insurance/.test(text) && /Universal Life Insurance/.test(text));
  check("an explicit note says these are categories, not an offering",
    /category descriptions, not an offering/i.test(text));
  check("the note names the firm without claiming it places them",
    /nothing here says what Northline Life & Insurance can place/i.test(text));
}

console.log("\n=== demo banner and licensing labels on every route ===");
{
  let missingBanner = [], missingFooterLabel = [];
  for (const route of ROUTES) {
    const text = await textOf(route);
    if (!/DEMONSTRATION PROTOTYPE/i.test(text)) missingBanner.push(route);
    if (!/Demonstration content\./i.test(text)) missingFooterLabel.push(route);
  }
  check("the demonstration banner is on every route", missingBanner.length === 0, missingBanner.join(", "));
  check("the footer licensing block is labelled on every route",
    missingFooterLabel.length === 0, missingFooterLabel.join(", "));
}

console.log("\n=== no invented credentials anywhere in the rendered site ===");
{
  const findings = [];
  for (const route of ROUTES) {
    const text = await textOf(route);
    // A licence or producer number would look like a run of digits next to the label.
    if (/National Producer (No|Number)[.:]?\s*\d/i.test(text)) findings.push(`${route}: NPN digits`);
    if (/(Resident|Agency) license no\.?\s*\d/i.test(text)) findings.push(`${route}: licence digits`);
    if (/\b(NPN|License)\s*#?\s*\d{4,}/i.test(text)) findings.push(`${route}: numeric credential`);
    // Unverifiable business claims the project forbids.
    if (/\b\d+\+?\s*years (of )?(experience|in business)\b/i.test(text)) findings.push(`${route}: years claim`);
    if (/\b(award|award-winning|#1|rated #1|top-rated|best rates|lowest rates|guaranteed savings)\b/i.test(text))
      findings.push(`${route}: superlative/award`);
    if (/\b(\d[\d,]*)\s+(families|clients|policies)\s+(served|helped|placed)\b/i.test(text))
      findings.push(`${route}: client statistic`);
  }
  check("no licence number, NPN, years-in-business, award or client statistic renders",
    findings.length === 0, findings.slice(0, 5).join(" | "));
  check("the unfilled credential tokens are still visible as placeholders",
    /\{\{RESIDENT_LICENSE\}\}/.test(await textOf("/")) && /\{\{NPN\}\}/.test(await textOf("/")));
}

console.log("\n=== machine-readable surfaces stay demo-safe ===");
{
  let jsonld = 0;
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "load" });
    jsonld += await page.evaluate(() => document.querySelectorAll('script[type="application/ld+json"]').length);
  }
  check("zero JSON-LD business schema is emitted in demo mode", jsonld === 0, `found ${jsonld}`);

  const robots = await (await fetch(BASE + "/robots.txt")).text();
  check("robots.txt disallows everything", /Disallow:\s*\/\s*$/m.test(robots.trim()), robots.replace(/\n/g, " "));

  let indexable = [];
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "load" });
    const r = await page.evaluate(() => document.querySelector('meta[name="robots"]')?.content ?? "");
    if (!/noindex/.test(r)) indexable.push(`${route}:${r || "(none)"}`);
  }
  check("every route carries noindex", indexable.length === 0, indexable.join(", "));

  // M12 — the share card must not present as a real business.
  await page.goto(BASE + "/", { waitUntil: "load" });
  const og = await page.evaluate(() => ({
    title: document.querySelector('meta[property="og:title"]')?.content ?? "",
    desc: document.querySelector('meta[property="og:description"]')?.content ?? "",
    image: document.querySelector('meta[property="og:image"]')?.content ?? "",
    alt: document.querySelector('meta[property="og:image:alt"]')?.content ?? "",
  }));
  check("the share card declares the demonstration status",
    /demonstration/i.test(og.title + og.desc + og.alt),
    JSON.stringify(og));
}

console.log(`\n  ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
