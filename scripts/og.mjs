/**
 * Renders public/og.png — the social share image.
 *
 * A typographic plate built from the design system, using the site's own fonts
 * and colour tokens rather than a separate asset that could drift out of step
 * with the brand. Regenerate whenever the company name, tagline or logo change.
 *
 * USAGE — the site must be running, so the self-hosted Fraunces and Inter files
 * resolve and the plate uses the same faces as the site:
 *
 *   npm run build && npm start          # in one terminal
 *   npm run og                          # in another
 *   npm run og -- https://your.site     # or point it somewhere else
 *
 * Playwright is a devDependency, so `npm ci` is enough. If the browser binary
 * is missing on a fresh machine, Playwright will say so — run
 * `npx playwright install chromium` once.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

// Pull the built stylesheet off the running site so the fonts and tokens match.
await page.goto(base, { waitUntil: "load" });
const { cssHref, displayFamily, sansFamily, isDemo } = await page.evaluate(() => {
  const h1 = document.querySelector("h1");
  const body = document.body;
  return {
    cssHref: document.querySelector('link[rel="stylesheet"]')?.getAttribute("href") ?? "",
    // Resolve the ACTUAL family names. next/font hashes them and exposes them
    // via a class on <html>, which a standalone page would not inherit.
    displayFamily: h1 ? getComputedStyle(h1).fontFamily : "Georgia, serif",
    sansFamily: getComputedStyle(body).fontFamily,
    // Read the demonstration status off the running site rather than keeping a
    // second copy of the flag here, where it could drift.
    isDemo: /DEMONSTRATION PROTOTYPE/i.test(body.innerText),
  };
});

await page.setContent(`
<!doctype html><html><head>
<link rel="stylesheet" href="${new URL(cssHref, base).href}">
<style>
  html,body{margin:0;padding:0}
  body{width:1200px;height:630px;background:var(--paper);display:flex;flex-direction:column;
       justify-content:space-between;padding:72px 80px;box-sizing:border-box}
  .eyebrow{font-family:${sansFamily};font-size:15px;letter-spacing:.14em;text-transform:uppercase;
           font-weight:500;color:var(--accent)}
  h1{font-family:${displayFamily};font-variation-settings:'opsz' 144,'SOFT' 0,'WONK' 0;
     font-size:76px;line-height:1.03;letter-spacing:-.03em;color:var(--ink);margin:28px 0 0;max-width:17ch;font-weight:400}
  .rule{height:1px;background:var(--rule-strong);margin:0 0 28px}
  .foot{display:flex;justify-content:space-between;align-items:baseline;
        font-family:${sansFamily};font-size:17px;color:var(--muted)}
  .mark{font-family:${displayFamily};font-variation-settings:'opsz' 144,'SOFT' 0,'WONK' 0;font-size:27px;color:var(--ink);letter-spacing:-.015em;display:flex;flex-direction:column;line-height:1}
  .sub{font-family:${sansFamily};font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-top:6px}
  .lockup{display:flex;align-items:center;gap:12px}
  .demo{font-family:${sansFamily};font-size:14px;font-weight:600;letter-spacing:.18em;
        text-transform:uppercase;color:var(--paper);background:var(--ink-deep);
        padding:10px 18px;border-radius:2px;display:inline-block;margin-bottom:26px}
  .demo-note{font-family:${sansFamily};font-size:14px;color:var(--muted);margin-top:10px}
</style></head><body>
  <div>
    ${isDemo ? '<div class="demo">Demonstration prototype</div>' : ""}
    <div class="eyebrow">Independent Life Insurance Brokerage</div>
    <h1>Every carrier underwrites differently.</h1>
  </div>
  <div>
    <div class="rule"></div>
    <div class="foot">
      <span class="lockup">
        <svg width="30" height="33" viewBox="0 0 40 44" fill="none" stroke="#1D4634" stroke-width="4" stroke-linejoin="miter"><path d="M6 40 V8 L34 40 V2"/></svg>
        <span class="mark">Northline<span class="sub">Life &amp; Insurance</span></span>
      </span>
      <span>${isDemo ? "Fictional company — website design demonstration" : "Clear guidance. Coverage built around your life."}</span>
    </div>
  </div>
</body></html>`, { waitUntil: "load" });

await page.waitForTimeout(900);
const buf = await page.screenshot({ type: "png" });
writeFileSync(new URL("../public/og.png", import.meta.url), buf);
await browser.close();
console.log("wrote public/og.png");
