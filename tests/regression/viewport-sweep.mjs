/**
 * REGRESSION TESTS — every route at every width, including LANDSCAPE.
 *
 * WHY LANDSCAPE (findings R3-H2 and R3-M12). The existing suites measured the
 * sticky-chrome budget at 375x667 and 390x844 only — both portrait, both
 * comfortably inside the limit. That is why a mobile menu overhanging a
 * landscape viewport by 336px, hiding the primary call to action, and a header
 * consuming 49% of a 667x375 screen, both survived two rounds of auditing. A
 * phone held sideways is not an exotic device.
 *
 * Asserts three properties across 19 routes x 11 widths:
 *   · no horizontal overflow
 *   · persistent chrome stays inside the project's own 30% budget
 *   · no console or page errors
 *
 *   node tests/regression/viewport-sweep.mjs http://127.0.0.1:PORT
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:4801";
const ROUTES = ["/", "/how-it-works", "/coverage", "/carriers", "/about", "/faq", "/quote",
  "/schedule", "/contact", "/careers", "/careers/apply", "/privacy", "/terms",
  "/styleguide", "/thank-you/quote", "/thank-you/message", "/thank-you/apply",
  "/thank-you/schedule", "/nope"];
const WIDTHS = [
  [320, 568], [375, 667], [390, 844], [414, 896],
  [568, 320], [667, 375],
  [768, 1024], [1024, 768], [1280, 900], [1440, 900], [1920, 1080],
];

const browser = await chromium.launch();
let overflow = 0, errors = 0, chromeOver = 0, checked = 0;
const problems = [];

for (const [w, h] of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const pageErrors = [];
  let currentRoute = "";
  page.on("pageerror", (e) => pageErrors.push({ route: currentRoute, text: String(e).slice(0, 90) }));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push({ route: currentRoute, text: m.text().slice(0, 90) }); });

  for (const route of ROUTES) {
    currentRoute = route;
    await page.goto(BASE + route, { waitUntil: "load" });
    await page.waitForTimeout(120);
    checked++;
    const r = await page.evaluate(() => {
      const over = document.documentElement.scrollWidth > window.innerWidth + 1;
      let widest = null;
      if (over) {
        for (const el of document.querySelectorAll("*")) {
          const b = el.getBoundingClientRect();
          if (b.right > window.innerWidth + 1 && b.width > 0) {
            widest = `${el.tagName}.${String(el.className).slice(0, 40)} right=${Math.round(b.right)}`;
            break;
          }
        }
      }
      // Persistent chrome budget
      let chrome = 0;
      for (const el of document.querySelectorAll("header, [class*='fixed']")) {
        const cs = getComputedStyle(el);
        if (cs.position === "fixed" || cs.position === "sticky") {
          const b = el.getBoundingClientRect();
          if (b.height > 0 && b.top < window.innerHeight && b.bottom > 0) chrome += b.height;
        }
      }
      return { over, widest, chromePct: Math.round((chrome / window.innerHeight) * 100) };
    });
    if (r.over) { overflow++; problems.push(`OVERFLOW ${w}x${h} ${route} :: ${r.widest}`); }
    if (r.chromePct > 30) { chromeOver++; problems.push(`CHROME ${r.chromePct}% ${w}x${h} ${route}`); }
  }
  // /nope is a 404 BY DESIGN, and Chromium logs the document's own status as a
  // console error.
  //
  // FINDING R6-11: the exemption used to be a bare `/404 \(Not Found\)/`
  // filter applied to every route at every width, so a genuinely missing asset
  // — a font, an image, a chunk — would have been swallowed by the allowance
  // written for one intentional 404. Errors are now tagged with the route that
  // produced them and only /nope's are exempt.
  const real = pageErrors.filter((e) => !(e.route === "/nope" && /404 \(Not Found\)/.test(e.text)));
  if (real.length) { errors += real.length; problems.push(`ERRORS ${w}x${h}: ${real.slice(0, 2).map((e) => `${e.route} ${e.text}`).join(" | ")}`); }
  await ctx.close();
}

await browser.close();
console.log(`\n=== ${checked} page renders (${ROUTES.length} routes x ${WIDTHS.length} widths) ===`);
const check = (name, ok, detail = "") =>
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : "  — " + detail}`);

check("no route overflows horizontally at any width", overflow === 0,
  problems.filter((p) => p.startsWith("OVERFLOW")).slice(0, 4).join(" | "));
check("persistent chrome stays within 30% of the viewport, portrait AND landscape",
  chromeOver === 0, problems.filter((p) => p.startsWith("CHROME")).slice(0, 4).join(" | "));
check("no console or page errors on any route at any width", errors === 0,
  problems.filter((p) => p.startsWith("ERRORS")).slice(0, 3).join(" | "));

const failed = (overflow ? 1 : 0) + (chromeOver ? 1 : 0) + (errors ? 1 : 0);
console.log(`\n  ${3 - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
