import { chromium } from "playwright";
import { COLOUR_HELPERS } from "../colour.mjs";

/**
 * ============================================================================
 * PERSISTENT CHROME, FOCUS, AND CONTRAST
 * ============================================================================
 *
 * Four findings that share one cause: two pieces of UI float above the page —
 * a sticky header and, on phones, a fixed call bar — and the rest of the layout
 * did not know how tall either of them was.
 *
 *   R4-03  tabbing to a footer link scrolled it under the call bar. Measured at
 *          390x844: "About" landed at 794..810 with the bar occupying 779..844.
 *          Entirely covered. WCAG 2.2 SC 2.4.11 (Focus Not Obscured), on a site
 *          that states AA conformance on /terms.
 *   R4-08  eight sticky sidebars used `lg:top-32`, a literal that was right for
 *          one header state.
 *   R4-10  at 320x568 the two bars took 33.4% of the viewport against a
 *          documented 30% budget.
 *   R4-09  `placeholder:text-muted/60` on the styleguide composited to 2.33:1
 *          against a 4.5:1 floor — and the mechanism (Tailwind cannot apply an
 *          alpha modifier to a bare `var()` colour, so it drops the declaration
 *          entirely) applies to every colour in the palette, not just this one.
 *
 * Plus R4-06: the "fictional company" disclaimer was `sm:hidden`, so the one
 * audience most likely to mistake this for a real agency — someone viewing it
 * on a laptop — was the audience that never saw it.
 *
 * Everything here is MEASURED in the browser. Nothing asserts a class name.
 */

const BASE = process.argv[2];
if (!BASE) {
  console.error("usage: chrome-focus.mjs <base-url>");
  process.exit(2);
}

let failed = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failed = 1;
};

const browser = await chromium.launch();

/* ══ 1. Focus is never under the chrome ════════════════════════════════ */

console.log("\n1 · a focused element is never covered by the header or the call bar (R4-03)");

/**
 * ROUTES MATTER AS MUCH AS WIDTHS (finding R6-06).
 *
 * This walk covered only `/`. The homepage's tab order is links and buttons —
 * short controls that fit in the gap the scroll padding leaves. `/contact` has
 * a 120px textarea sitting near the fold, and at 375x667 tabbing into it left
 * 65px (54% of it, including where the caret sits) under the call bar. A sweep
 * that varies one dimension and holds the other fixed will keep finding
 * nothing.
 */
for (const [w, h, route] of [
  [320, 568, "/"],
  [375, 667, "/"],
  [390, 844, "/"],
  [1280, 900, "/"],
  [375, 667, "/contact"],
  [390, 844, "/contact"],
  [375, 667, "/careers/apply"],
  [360, 640, "/quote"],
]) {
  const label = `${w}x${h} ${route}`;
  /**
   * `reducedMotion: "reduce"` is not a shortcut — globals.css sets
   * `scroll-behavior: auto` under that media query, so scroll-into-view lands
   * instantly instead of animating over ~400ms. Without it the walk measures a
   * scroll still in flight and reports elements as "covered" that are simply
   * not there yet, which is a test that fails for a reason unrelated to what it
   * is about.
   */
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${route}`, { waitUntil: "load" });
  await page.waitForTimeout(700);

  /**
   * Tab all the way through the page. At every stop, ask the document what is
   * actually painted at the centre of the focused element. If the answer is not
   * that element, it is covered — which is the WCAG test itself, rather than a
   * guess from coordinates and an assumed chrome height.
   */
  const obscured = [];
  let stops = 0;
  let reachedFooter = false;

  /**
   * The walk must run all the way to the FOOTER, because that is where R4-03
   * was: the footer's "About" link scrolled to 794..810 with the call bar
   * occupying 779..844. An earlier version of this walk stopped as soon as two
   * focus stops produced the same label — and "Read more" appears several times
   * on the homepage, so it stopped after seven, hundreds of pixels above the
   * thing it was written to check. It now runs until focus cycles back to where
   * it started, and asserts that the footer was reached.
   */
  await page.keyboard.press("Tab");
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    window.__firstFocus = document.activeElement;
  });

  for (let i = 0; i < 220; i++) {
    const info = await page.evaluate((step) => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const r = el.getBoundingClientRect();
      const inFooter = Boolean(el.closest("footer"));
      if (r.width === 0 || r.height === 0) return { skip: true, inFooter, cycled: el === window.__firstFocus };
      // Only elements actually on screen can be judged. `elementFromPoint`
      // clamps its arguments to the viewport, so asking it about an element
      // 3000px down the page returns whatever happens to be at the clamped
      // coordinate — an answer that means nothing. An element the browser has
      // not scrolled to is a different question from an element it scrolled
      // under the chrome.
      const centreY = r.top + r.height / 2;
      if (r.bottom <= 0 || r.top >= window.innerHeight || centreY < 0 || centreY > window.innerHeight) {
        return { skip: true, offscreen: true, inFooter, cycled: el === window.__firstFocus };
      }
      const x = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1);
      const y = Math.min(Math.max(centreY, 1), window.innerHeight - 1);
      const hit = document.elementFromPoint(x, y);
      const visible = hit === el || el.contains(hit) || (hit ? hit.contains(el) : false);
      return {
        what: (el.textContent || el.id || el.tagName).trim().slice(0, 36),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        inFooter,
        cycled: step > 0 && el === window.__firstFocus,
        visible,
        coveredBy: visible ? null : (hit?.tagName ?? "?") + (hit?.className ? `.${String(hit.className).split(" ")[0]}` : ""),
      };
    }, i);
    if (!info) break;
    if (info.inFooter) reachedFooter = true;
    if (info.cycled && i > 0) break;
    if (!info.skip) {
      stops++;
      if (!info.visible) obscured.push(info);
    }
    await page.keyboard.press("Tab");
    await page.waitForTimeout(110);
  }

  check(`${label}: the walk reached the footer`, reachedFooter, `${stops} stops, footer never focused`);
  check(
    `${label}: no focused control is obscured (${stops} on-screen stops)`,
    obscured.length === 0,
    obscured.map((o) => `${o.what} @${o.top}..${o.bottom} covered by ${o.coveredBy}`).join(" | ")
  );
  await ctx.close();
}

/* ══ 2. The chrome variables are published, and consumed ═══════════════ */

console.log("\n2 · --chrome-top / --chrome-bottom track the real heights (R4-03/R4-08)");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(900);

  const read = () =>
    page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
      const header = document.querySelector("header");
      // `offsetHeight > 0` rather than an on-screen test: the bar is parked with
      // translate-y-full at rest, so it is laid out but not visible — and its
      // laid-out height is exactly what must be reserved (R6-06).
      const bar = [...document.querySelectorAll("div,nav")].find((e) => {
        const s = getComputedStyle(e);
        return s.position === "fixed" && parseFloat(s.bottom) === 0 && e.offsetHeight > 0;
      });
      return {
        top: px("--chrome-top"),
        bottom: px("--chrome-bottom"),
        headerH: header?.offsetHeight ?? 0,
        barH: bar?.offsetHeight ?? 0,
        scrollPadTop: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0,
        scrollPadBottom: parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) || 0,
      };
    });

  const atTop = await read();
  /**
   * FINDING R6-06 — the reservation has to exist at rest.
   *
   * `--chrome-bottom` used to be 0 until the bar was actually shown, and the
   * bar appears on scroll. A focus scroll is a scroll: the browser computed the
   * scroll with 16px of padding, the bar then slid up, and nothing re-scrolled.
   * The height is now published whenever the bar is laid out, shown or not.
   */
  check(
    `at rest, --chrome-bottom (${atTop.bottom}px) already reserves the call bar (${atTop.barH}px)`,
    atTop.barH === 0 || atTop.bottom >= atTop.barH,
    JSON.stringify(atTop)
  );
  check(
    "at rest, scroll-padding-bottom already clears the call bar",
    atTop.barH === 0 || atTop.scrollPadBottom >= atTop.barH,
    `${atTop.scrollPadBottom} < ${atTop.barH}`
  );
  check(
    `--chrome-top (${atTop.top}px) matches the header height (${atTop.headerH}px)`,
    Math.abs(atTop.top - atTop.headerH) <= 1,
    JSON.stringify(atTop)
  );
  check(
    "scroll-padding-top is at least the header height",
    atTop.scrollPadTop >= atTop.headerH,
    `${atTop.scrollPadTop} < ${atTop.headerH}`
  );

  // Scroll down: the header shrinks, and the variable has to follow it. A
  // literal would be wrong from here on.
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(700);
  const scrolled = await read();
  check(
    `after scrolling, --chrome-top (${scrolled.top}px) still matches the header (${scrolled.headerH}px)`,
    Math.abs(scrolled.top - scrolled.headerH) <= 1,
    JSON.stringify(scrolled)
  );
  check(
    `the call bar is shown and --chrome-bottom (${scrolled.bottom}px) matches it (${scrolled.barH}px)`,
    scrolled.barH === 0 || Math.abs(scrolled.bottom - scrolled.barH) <= 1,
    JSON.stringify(scrolled)
  );
  check(
    "scroll-padding-bottom clears the call bar",
    scrolled.scrollPadBottom >= scrolled.barH,
    `${scrolled.scrollPadBottom} < ${scrolled.barH}`
  );
  await ctx.close();
}

/* ══ 3. Sticky sidebars sit below the header ═══════════════════════════ */

console.log("\n3 · sticky sidebars are not tucked under the sticky header (R4-08)");
for (const path of ["/coverage", "/faq", "/about", "/how-it-works"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(700);

  /**
   * A sticky element is only pinned WITHIN its containing block. Once that
   * block scrolls off the top, the element goes with it and reports a negative
   * `top` — correct CSS, and nothing to do with the header. What R4-08 was
   * about is a panel pinned INSIDE the visible page but at an offset that puts
   * it under the header. So the band that matters is 0 <= top < headerBottom:
   * on screen, and higher than the header's lower edge.
   */
  const overlap = await page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) return null;
    const hb = header.getBoundingClientRect();
    const stickies = [...document.querySelectorAll("*")].filter(
      (e) => getComputedStyle(e).position === "sticky" && e.offsetHeight > 0 && e !== header
    );
    return stickies
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          cls: String(e.className).slice(0, 50),
          top: Math.round(r.top),
          headerBottom: Math.round(hb.bottom),
          onScreen: r.bottom > 0 && r.top < window.innerHeight,
          under: r.top >= 0 && r.top < hb.bottom - 1,
        };
      })
      .filter((x) => x.onScreen && x.under);
  });
  check(`${path}: no sticky panel starts above the header's bottom edge`, (overlap ?? []).length === 0, JSON.stringify(overlap));
  await ctx.close();
}

/* ══ 4. The chrome budget at the smallest supported viewport ═══════════ */

console.log("\n4 · persistent chrome stays inside its documented budget (R4-10)");
{
  const BUDGET = 0.3;
  for (const [w, h] of [[320, 568], [360, 640], [375, 667]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(800);

    const used = await page.evaluate(() => {
      const px = (el) => (el && el.offsetHeight) || 0;
      const header = document.querySelector("header");
      const fixedBottom = [...document.querySelectorAll("div,nav")].find((e) => {
        const s = getComputedStyle(e);
        return s.position === "fixed" && parseFloat(s.bottom) === 0 && e.offsetHeight > 0;
      });
      return { header: px(header), bar: px(fixedBottom), viewport: window.innerHeight };
    });
    const fraction = (used.header + used.bar) / used.viewport;
    check(
      `${w}x${h}: chrome is ${(fraction * 100).toFixed(1)}% of the viewport (budget ${BUDGET * 100}%)`,
      fraction <= BUDGET,
      `header ${used.header} + bar ${used.bar} of ${used.viewport}`
    );
    await ctx.close();
  }
}

/* ══ 5. Placeholder contrast, everywhere a placeholder exists ══════════ */

console.log("\n5 · every placeholder meets 4.5:1 (R4-09)");
/**
 * Routes that render a placeholder ON LOAD. `/quote` is deliberately absent:
 * step 1 of the wizard has no input at all, so listing it here produced
 * "0 placeholder(s), all >= 4.5:1" — a pass that measured nothing. Its two
 * placeholders live on steps 3 and 5 and are walked to explicitly below.
 */
for (const path of ["/styleguide", "/contact", "/careers/apply"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(500);

  /**
   * Colour maths from tests/colour.mjs. This file had its own copy, which
   * returned null for any notation it did not recognise and then skipped the
   * element — so a placeholder declared with `color-mix()` would have been
   * silently EXCLUDED from the check rather than measured. A contrast test that
   * quietly drops the cases it cannot read is the worst of both worlds.
   */
  const results = await page.evaluate(`(() => {
    ${COLOUR_HELPERS}
    const out = [];
    for (const el of document.querySelectorAll("input[placeholder], textarea[placeholder]")) {
      if (!el.offsetHeight) continue;
      const declared = getComputedStyle(el, "::placeholder").color;
      const colour = parseColour(declared);
      const bg = effectiveBackground(el);
      out.push({
        placeholder: el.getAttribute("placeholder").slice(0, 30),
        colour: declared,
        ratio: Number(contrastRatio(compositeOver(colour, bg), bg).toFixed(2)),
      });
    }
    return out;
  })()`);

  const bad = results.filter((r) => r.ratio < 4.5);
  /**
   * A route listed here MUST yield at least one placeholder. The previous
   * condition was `results.length === 0 || bad.length === 0`, which reported
   * "/quote: 0 placeholder(s), all >= 4.5:1" — a pass that measured nothing.
   * The wizard's placeholders live on steps 3 and 5, which page load never
   * reaches; they are walked to explicitly below.
   */
  check(
    `${path}: ${results.length} placeholder(s), all >= 4.5:1`,
    results.length > 0 && bad.length === 0,
    results.length === 0
      ? "measured NOTHING — the check was vacuous"
      : bad.map((b) => `"${b.placeholder}" ${b.ratio}:1 (${b.colour})`).join(" | ")
  );
  console.log(`     lowest ${Math.min(...results.map((r) => r.ratio))}:1`);
  await ctx.close();
}

console.log("\n  ...and the placeholders that only exist deeper in the wizard");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/quote`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  const advance = async () => {
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForTimeout(350);
  };
  const measure = () =>
    page.evaluate(`(() => {
      ${COLOUR_HELPERS}
      const out = [];
      for (const el of document.querySelectorAll("input[placeholder], textarea[placeholder]")) {
        if (!el.offsetHeight) continue;
        const declared = getComputedStyle(el, "::placeholder").color;
        const bg = effectiveBackground(el);
        out.push({ placeholder: el.getAttribute("placeholder").slice(0, 34),
          ratio: Number(contrastRatio(compositeOver(parseColour(declared), bg), bg).toFixed(2)) });
      }
      return out;
    })()`);

  await page.getByText("People depend on my income").click(); await advance();
  await page.getByText("$500,000 – $1 million").click(); await advance();
  const step3 = await measure();
  check(`quote step 3: ${step3.length} placeholder(s), all >= 4.5:1`,
    step3.length > 0 && step3.every((r) => r.ratio >= 4.5),
    JSON.stringify(step3));

  await page.fill("#age", "42");
  await page.getByText("Female", { exact: true }).click();
  await page.selectOption("#state", "Minnesota");
  await page.getByText("No", { exact: true }).click(); await advance();
  await page.getByText("Good", { exact: true }).click(); await advance();
  await page.waitForTimeout(400);
  const step5 = await measure();
  check(`quote step 5: ${step5.length} placeholder(s), all >= 4.5:1`,
    step5.length > 0 && step5.every((r) => r.ratio >= 4.5),
    JSON.stringify(step5));
  await ctx.close();
}

/* ══ 6. The demo disclaimer, at every width (R4-06) ════════════════════ */

console.log("\n6 · the fictional-company disclaimer is visible at every width (R4-06)");
for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [1280, 900], [1920, 1080]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);

  const state = await page.evaluate(() => {
    const el = [...document.querySelectorAll("span,p,div")].find((e) =>
      /fictional company/i.test(e.textContent ?? "") && e.children.length === 0
    );
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      found: true,
      text: el.textContent.trim(),
      painted: r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden",
    };
  });
  check(`${w}x${h}: "Fictional company" is rendered and painted`, state.found && state.painted, JSON.stringify(state));
  await ctx.close();
}

await browser.close();

console.log("");
console.log(failed ? "CHROME / FOCUS / CONTRAST: FAILURES" : "CHROME / FOCUS / CONTRAST: all checks passed");
process.exit(failed);
