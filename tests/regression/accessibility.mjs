/**
 * REGRESSION TESTS — M3 (contrast), M4 (mobile menu), M5 (focus management),
 * M7 (sticky chrome budget).
 *
 *   node tests/regression/accessibility.mjs http://127.0.0.1:PORT
 *
 * Each of these failed against the pre-remediation build.
 */
import { chromium } from "playwright";
import { COLOUR_HELPERS } from "../colour.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:4501";
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

const browser = await chromium.launch();

/* ── M3 · contrast, with alpha-correct compositing ───────────────────────── */
console.log("=== M3 · colour contrast ===");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const ROUTES = ["/", "/how-it-works", "/coverage", "/carriers", "/about", "/faq", "/quote",
    "/schedule", "/contact", "/careers", "/careers/apply", "/privacy", "/terms",
    "/thank-you/quote", "/nope"];
  let failures = [], weakest = Infinity, weakestNode = "";
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "load" });
    await page.waitForTimeout(150);
    /**
     * The colour maths comes from tests/colour.mjs rather than being written
     * inline here. The inline copy could not parse `color(srgb …)` — the form
     * Chromium computes for `color-mix()` — and silently read its 0-1 channels
     * as 8-bit ones, reporting the site's lightest panel at 1.12:1. A
     * screenshot of that panel measured 15.19:1. See the note in colour.mjs.
     */
    const result = await page.evaluate(`(() => {
      ${COLOUR_HELPERS}
      const bad = [];
      let min = Infinity, minNode = "";
      document.querySelectorAll("body *").forEach((el) => {
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
        if (!hasText) return;
        const s = getComputedStyle(el);
        if (s.visibility === "hidden" || s.display === "none" || +s.opacity === 0) return;
        if (el.classList.contains("sr-only")) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const fgc = parseColour(s.color);
        const bg = effectiveBackground(el);
        const fg = fgc.a >= 1 ? fgc : compositeOver(fgc, bg);
        const ratio = contrastRatio(fg, bg);
        const size = parseFloat(s.fontSize);
        const large = size >= 24 || (size >= 18.66 && +s.fontWeight >= 700);
        const need = large ? 3 : 4.5;
        if (ratio < min) { min = ratio; minNode = el.textContent.trim().slice(0, 34); }
        if (ratio < need) bad.push({ ratio: +ratio.toFixed(2), need, txt: el.textContent.trim().slice(0, 40) });
      });
      return { bad, min, minNode };
    })()`);
    failures.push(...result.bad.map((b) => `${route} ${b.ratio}:1 "${b.txt}"`));
    if (result.min < weakest) { weakest = result.min; weakestNode = `${route} "${result.minNode}"`; }
  }
  check("zero AA contrast failures across 15 routes", failures.length === 0, failures.slice(0, 4).join(" | "));
  check("the production note on a dark ground is legible (was 1.76:1)", failures.length === 0);
  console.log(`     weakest measured pairing: ${weakest.toFixed(2)}:1 — ${weakestNode}`);
  await ctx.close();
}

/* ── M4 · mobile menu ────────────────────────────────────────────────────── */
console.log("\n=== M4 · mobile menu keyboard behaviour ===");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load" });
  const state = () => page.evaluate(() => ({
    expanded: document.querySelector("button[aria-expanded]")?.getAttribute("aria-expanded"),
    focus: (document.activeElement?.tagName ?? "") + "/" + (document.activeElement?.textContent ?? "").trim().slice(0, 14),
  }));

  await page.locator("button[aria-expanded]").click();
  await page.waitForTimeout(300);
  check("menu opens", (await state()).expanded === "true");

  // Focus must not escape to the page behind the panel.
  let escaped = 0;
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const nav = document.getElementById("mobile-nav");
      const btn = document.querySelector("button[aria-expanded]");
      const a = document.activeElement;
      return !!(a && (nav?.contains(a) || btn === a));
    });
    if (!inside) escaped++;
  }
  check("focus is trapped inside the open panel (was 7/12 escapes)", escaped === 0, `${escaped}/14 escaped`);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const afterEsc = await state();
  check("Escape closes the menu", afterEsc.expanded === "false", `aria-expanded=${afterEsc.expanded}`);
  check("focus returns to the toggle after Escape", afterEsc.focus.startsWith("BUTTON"), afterEsc.focus);

  // Clicking a link still navigates and closes.
  await page.locator("button[aria-expanded]").click();
  await page.waitForTimeout(250);
  await page.locator("#mobile-nav a").first().click();
  await page.waitForTimeout(700);
  const afterNav = await page.evaluate(() => ({
    path: location.pathname,
    expanded: document.querySelector("button[aria-expanded]")?.getAttribute("aria-expanded"),
    overflow: getComputedStyle(document.body).overflow,
  }));
  check("navigating from the menu still works and closes it",
    afterNav.path !== "/" && afterNav.expanded === "false" && afterNav.overflow !== "hidden",
    JSON.stringify(afterNav));
  await ctx.close();
}

/* ── M7 · sticky chrome budget ───────────────────────────────────────────── */
console.log("\n=== M7 · sticky chrome does not eat the phone viewport ===");
{
  for (const [w, h] of [[375, 667], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/faq", { waitUntil: "load" });
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(400);
    const pct = await page.evaluate(() => {
      const els = [...document.querySelectorAll("body *")].filter((e) => {
        const s = getComputedStyle(e);
        return (s.position === "sticky" || s.position === "fixed") && e.getBoundingClientRect().height > 4;
      });
      const vh = window.innerHeight;
      const top = els.filter((e) => e.getBoundingClientRect().top < 120)
        .reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0);
      const bottom = els.filter((e) => e.getBoundingClientRect().bottom >= vh - 2)
        .reduce((m, e) => Math.max(m, e.getBoundingClientRect().height), 0);
      return Math.round((100 * (top + bottom)) / vh);
    });
    check(`${w}x${h}: persistent chrome under 30% of the viewport (was 41%)`, pct < 30, `${pct}%`);
    await ctx.close();
  }
  // The notice must still be present at every width — shortened, not removed.
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load" });
  const noticeText = await page.locator("header").innerText();
  check("the demonstration notice is still visible on a small phone",
    /DEMONSTRATION PROTOTYPE/i.test(noticeText) && /Fictional company/i.test(noticeText),
    noticeText.slice(0, 60).replace(/\n/g, " "));
  await ctx.close();
}

/* ── M5 · focus management on form outcomes ─────────────────────────────── */
console.log("\n=== M5 · focus management ===");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Failed submit → focus lands on the first invalid field, not the button.
  await page.goto(BASE + "/contact", { waitUntil: "load" });
  await page.getByRole("button", { name: /send|submit/i }).click();
  await page.waitForTimeout(500);
  const afterInvalid = await page.evaluate(() => ({
    id: document.activeElement?.id ?? document.activeElement?.tagName,
    invalid: [...document.querySelectorAll("[aria-invalid=true]")].map((e) => e.id),
    alerts: document.querySelectorAll("[role=alert]").length,
  }));
  check("failed submit moves focus to the first invalid field (was the button)",
    afterInvalid.id === "c-name", JSON.stringify(afterInvalid));
  check("errors are still announced", afterInvalid.alerts >= 3 && afterInvalid.invalid.length >= 3,
    JSON.stringify(afterInvalid));

  // Successful submit → focus lands on the confirmation heading.
  await page.fill("#c-name", "Focus Probe");
  await page.fill("#c-email", "focus@example.com");
  await page.selectOption("#c-reason", "general");
  await page.fill("#c-message", "Checking that focus moves to the confirmation heading.");
  await Promise.all([
    page.waitForURL(/thank-you\/message/, { timeout: 20000 }),
    page.getByRole("button", { name: /send|submit/i }).click(),
  ]);
  await page.waitForTimeout(600);
  const afterSuccess = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    text: (document.activeElement?.textContent ?? "").trim().slice(0, 40),
  }));
  check("successful submit moves focus to the confirmation heading (was BODY)",
    afterSuccess.tag === "H1", JSON.stringify(afterSuccess));
  await ctx.close();
}

console.log(`\n  ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
