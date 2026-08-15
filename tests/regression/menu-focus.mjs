/**
 * REGRESSION TESTS — R3-H2 (mobile menu on short viewports) and R3-H4 (focus
 * visibility on the wizard's option cards).
 *
 *   node tests/regression/menu-focus.mjs http://127.0.0.1:PORT
 *
 * R3-H2 · The panel was an ordinary block: `overflow-y: visible`, no
 * max-height, while opening it locked page scrolling. Anything past the fold
 * was unreachable. Measured at 667x375 (a phone in landscape) the panel ran to
 * 711px against a 375px viewport — Contact, Book a call, For Agents and "Get
 * Your Quote", the site's primary call to action, all sat below the edge with
 * no way to scroll. Portrait was not safe either: at 390x667 it ended 5px above
 * the fold, so ordinary browser chrome pushed it over.
 *
 * R3-H4 · The wizard's choices are `.sr-only` radios inside styled labels. The
 * browser drew the focus ring on the input — a 1x1 box with clip:rect(0,0,0,0).
 * Screenshotting a card focused and unfocused produced BYTE-IDENTICAL PNGs
 * while an ordinary button differed. A keyboard user had no indication of
 * position on the primary conversion form, on a site that states WCAG 2.1 AA
 * conformance on /terms.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:4801";
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

const browser = await chromium.launch();

/* ══════════════════════════════════════════════════════════════════════════
   R3-H2 · every navigation item is reachable at every viewport
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n=== R3-H2 · the mobile menu across eight viewports ===");

const VIEWPORTS = [
  [320, 568], [336, 568], [360, 640], [390, 844],
  [414, 896], [568, 320], [667, 375], [844, 390],
];

for (const [width, height] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load" });

  const toggle = page.locator("header button[aria-expanded]").first();
  await toggle.click();
  await page.waitForTimeout(300);

  const result = await page.evaluate(async () => {
    const panel = document.querySelector("#mobile-nav");
    if (!panel) return { error: "no panel" };

    const links = () =>
      [...panel.querySelectorAll("a")].map((a) => ({
        text: a.textContent.trim().replace(/\s+/g, " ").slice(0, 28),
        rect: a.getBoundingClientRect(),
      }));

    /* "Reachable" means: after scrolling the panel as far as it goes, the item
       is inside the viewport. That is the property the visitor cares about —
       not whether it exists in the DOM. */
    const unreachable = [];
    for (const { text } of links()) {
      let seen = false;
      const total = panel.scrollHeight;
      for (let top = 0; top <= total; top += Math.max(40, panel.clientHeight - 40)) {
        panel.scrollTop = top;
        await new Promise((r) => setTimeout(r, 15));
        const hit = links().find((l) => l.text === text);
        if (hit && hit.rect.top >= 0 && hit.rect.bottom <= window.innerHeight + 1) { seen = true; break; }
      }
      if (!seen) unreachable.push(text);
    }
    panel.scrollTop = 0;

    const cs = getComputedStyle(panel);
    return {
      unreachable,
      count: links().length,
      overflowY: cs.overflowY,
      panelBottom: Math.round(panel.getBoundingClientRect().bottom),
      viewportH: window.innerHeight,
      scrollable: panel.scrollHeight > panel.clientHeight,
    };
  });

  const label = `${width}x${height}`.padEnd(9);
  check(`${label} every menu item and the primary CTA is reachable`,
    result.unreachable?.length === 0,
    `unreachable: ${(result.unreachable ?? []).join(", ")}`);
  check(`${label} the panel never extends past the viewport`,
    result.panelBottom <= result.viewportH + 1,
    `bottom ${result.panelBottom} vs viewport ${result.viewportH}`);

  await ctx.close();
}

/* ── Keyboard, Escape, touch scrolling and resize, on the tightest case ─── */
console.log("\n=== R3-H2 · behaviour at the tightest viewport (568x320) ===");
{
  const ctx = await browser.newContext({ viewport: { width: 568, height: 320 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load" });
  const toggle = page.locator("header button[aria-expanded]").first();

  await toggle.click();
  await page.waitForTimeout(250);
  check("the menu opens", (await toggle.getAttribute("aria-expanded")) === "true");

  // Touch/wheel scrolling inside the panel actually moves it.
  const scrolled = await page.evaluate(async () => {
    const panel = document.querySelector("#mobile-nav");
    const before = panel.scrollTop;
    panel.scrollBy(0, 200);
    await new Promise((r) => setTimeout(r, 120));
    return { before, after: panel.scrollTop, scrollable: panel.scrollHeight > panel.clientHeight };
  });
  check("the panel itself scrolls", !scrolled.scrollable || scrolled.after > scrolled.before,
    JSON.stringify(scrolled));

  // Keyboard: tab stays inside, Escape closes and returns focus.
  await page.keyboard.press("Tab");
  const inside = await page.evaluate(() => {
    const panel = document.querySelector("#mobile-nav");
    const toggleEl = document.querySelector("header button[aria-expanded]");
    return panel.contains(document.activeElement) || document.activeElement === toggleEl;
  });
  check("keyboard focus stays within the panel", inside);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check("Escape closes it", (await toggle.getAttribute("aria-expanded")) !== "true");
  check("focus returns to the toggle",
    await page.evaluate(() => document.activeElement === document.querySelector("header button[aria-expanded]")));
  check("the page scrolls again after closing",
    await page.evaluate(async () => {
      window.scrollTo({ top: 300, behavior: "instant" });
      for (let i = 0; i < 30 && window.scrollY === 0; i++) await new Promise((r) => setTimeout(r, 20));
      return window.scrollY > 0;
    }));

  // Resize while open, in both directions.
  await toggle.click();
  await page.waitForTimeout(200);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(350);
  check("widening past the breakpoint closes it and releases the scroll lock",
    (await toggle.getAttribute("aria-expanded")) !== "true" &&
      (await page.evaluate(() => document.body.style.overflow)) !== "hidden" &&
      (await page.evaluate(() => document.documentElement.style.overflow)) !== "hidden");

  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(250);
  await toggle.click();
  await page.waitForTimeout(250);
  const stillCapped = await page.evaluate(() => {
    const p = document.querySelector("#mobile-nav");
    return p.getBoundingClientRect().bottom <= window.innerHeight + 1;
  });
  check("after the round trip the panel is still capped to the viewport", stillCapped);
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════
   R3-H4 · the focus ring lands on something a person can see
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n=== R3-H4 · focus visibility on the wizard's option cards ===");

for (const [width, height, label] of [[320, 568, "320px"], [390, 844, "390px"], [1280, 900, "desktop"]]) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/quote", { waitUntil: "load" });
  await page.waitForTimeout(400);

  const radio = page.locator("input[type=radio]").first();
  await radio.evaluate((el) => el.closest("label").scrollIntoView({ block: "center", behavior: "instant" }));
  await page.waitForTimeout(300);

  const box = await radio.evaluate((el) => {
    const r = el.closest("label").getBoundingClientRect();
    return {
      x: Math.round(Math.max(0, r.x - 12)), y: Math.round(Math.max(0, r.y - 12)),
      width: Math.round(Math.min(r.width + 24, window.innerWidth - Math.max(0, r.x - 12))),
      height: Math.round(r.height + 24),
    };
  });

  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(220);
  const blurred = await page.screenshot({ clip: box });

  await radio.evaluate((el) => el.focus({ focusVisible: true }));
  await page.waitForTimeout(220);
  const focused = await page.screenshot({ clip: box });

  check(`${label} an UNSELECTED card looks different when focused`,
    Buffer.compare(blurred, focused) !== 0,
    "focused and unfocused renders are byte-identical");

  // Selected + focused must also be distinguishable from selected alone.
  await radio.evaluate((el) => { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(220);
  const selBlur = await page.screenshot({ clip: box });
  await radio.evaluate((el) => el.focus({ focusVisible: true }));
  await page.waitForTimeout(220);
  const selFocus = await page.screenshot({ clip: box });
  check(`${label} a SELECTED card also shows focus`,
    Buffer.compare(selBlur, selFocus) !== 0,
    "selected+focused is identical to selected alone");

  await ctx.close();
}

/* Tab and Shift+Tab reach the cards and mark them, on a real keyboard path. */
console.log("\n=== R3-H4 · reached by keyboard, not just by .focus() ===");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/quote", { waitUntil: "load" });
  await page.waitForTimeout(400);

  let hops = 0;
  for (; hops < 40; hops++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement?.type === "radio")) break;
  }
  check("a radio is reachable by Tab", hops < 40, `${hops} hops`);

  const state = await page.evaluate(() => {
    const el = document.activeElement;
    const label = el.closest("label");
    return {
      focusVisible: el.matches(":focus-visible"),
      labelOutline: getComputedStyle(label).outlineStyle,
      labelOutlineWidth: getComputedStyle(label).outlineWidth,
    };
  });
  check("the focused radio matches :focus-visible", state.focusVisible === true);
  check("its LABEL — the visible element — carries the outline",
    state.labelOutline !== "none" && parseFloat(state.labelOutlineWidth) > 0,
    `outline: ${state.labelOutline} ${state.labelOutlineWidth}`);

  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const backAgain = await page.evaluate(() => {
    const el = document.activeElement;
    if (el?.type !== "radio") return false;
    return getComputedStyle(el.closest("label")).outlineStyle !== "none";
  });
  check("Shift+Tab then Tab restores the visible ring", backAgain);
  await ctx.close();
}

await browser.close();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
