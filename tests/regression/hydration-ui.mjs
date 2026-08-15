/**
 * REGRESSION TESTS — R2-05 (form usable before hydration) and R2-04 (mobile
 * menu state across a breakpoint change).
 *
 *   node tests/regression/hydration-ui.mjs http://127.0.0.1:PORT
 *
 * R2-05 · The forms are React-controlled and submit with `fetch` from an
 * onSubmit handler. If the bundle never arrives — a failed chunk request, a
 * stale CDN entry after a deploy, an extension that blocks scripts, a flaky
 * network — the handler is never attached and the button performs the browser's
 * DEFAULT form submission. The <form> has no action, so that is a GET to the
 * current URL: every answer the visitor typed is discarded, the page appears to
 * reset, and nothing tells them anything went wrong. Reproduced below by
 * blocking /_next/static/chunks/**.
 *
 * R2-04 · Opening the mobile menu sets document.body.style.overflow = "hidden".
 * The panel is hidden by a `lg:` media query, so widening the window past the
 * breakpoint — rotating a tablet, un-maximising a window, an in-app browser
 * changing size — hid the panel while leaving the scroll lock in place and the
 * menu state open. The page could not be scrolled and nothing on screen
 * explained why.
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
   R2-05 · a form that cannot submit must SAY SO, not silently discard input
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n=== R2-05 · the form when the bundle never arrives ===");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Block exactly what a failed deploy or a blocking extension would block.
  await page.route("**/_next/static/chunks/**", (r) => r.abort());

  await page.goto(BASE + "/contact", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const submit = page.locator('form button[type="submit"]').first();

  check("the submit control is still present (the form was not hidden away)",
    await submit.count() > 0);
  check("the submit control is DISABLED while unhydrated",
    await submit.isDisabled());

  const label = (await submit.textContent())?.trim() ?? "";
  check("its label explains the state rather than lying about readiness",
    /preparing/i.test(label), `label was ${JSON.stringify(label)}`);

  // The core of the finding: typed input must not be destroyed by a GET.
  // The fields carry ids, not name attributes, so they are addressed by id.
  await page.fill("#c-name", "Hydration Probe");
  await page.fill("#c-message", "This message must not vanish.");
  const urlBefore = page.url();

  await submit.click({ force: true }).catch(() => {});
  await page.waitForTimeout(700);

  check("clicking does NOT navigate (no native GET submission)",
    page.url() === urlBefore, `${urlBefore} -> ${page.url()}`);
  check("the URL did not gain a query string",
    !page.url().includes("?"), page.url());
  check("what the visitor typed is still on screen",
    (await page.inputValue("#c-name")) === "Hydration Probe" &&
    (await page.inputValue("#c-message")) === "This message must not vanish.");

  /* Pressing Enter inside a field is the other route to an implicit native
     submission, and it does not go through the button at all. */
  await page.click("#c-name");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  check("pressing Enter in a field does not trigger a native submission either",
    page.url() === urlBefore, `${urlBefore} -> ${page.url()}`);

  /* ── The health-sensitive surface, precisely ──────────────────────────────
     The quote wizard is the only form with a `name` attribute on a control:
     the `situation` radio group, whose values include `declined-before`. A
     native GET is the one thing that could put that word in the address bar,
     the browser history and any outbound Referer. Whether it is reachable is
     asserted rather than assumed. */
  await page.goto(BASE + "/quote", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const named = await page.evaluate(() =>
    [...document.querySelectorAll("form [name]")].map((el) => el.getAttribute("name"))
  );
  check("the quote form's only named control is the one this test knows about",
    [...new Set(named)].every((n) => n === "situation"),
    `named controls: ${[...new Set(named)].join(", ")}`);

  const quoteUrlBefore = page.url();
  await page.evaluate(() => {
    const radio = document.querySelector('form input[name="situation"][value="declined-before"]');
    if (radio) radio.checked = true;
  });
  // Every route to a native submission: the visible control, and Enter.
  await page.locator("form button").last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);

  check("an unhydrated quote page cannot be made to navigate at all",
    page.url() === quoteUrlBefore, `${quoteUrlBefore} -> ${page.url()}`);
  check("no health-adjacent answer reaches the address bar",
    !page.url().includes("situation") && !page.url().includes("declined"),
    page.url());

  await ctx.close();
}

/* ── ...and the gate must open. A control that never enables is a broken form,
      not a fix. ─────────────────────────────────────────────────────────── */
console.log("\n=== R2-05 · the gate opens once hydration completes ===");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/contact", { waitUntil: "load" });

  const submit = page.locator('form button[type="submit"]').first();
  await page.waitForFunction(
    () => {
      const b = document.querySelector('form button[type="submit"]');
      return b && !b.disabled;
    },
    { timeout: 5000 }
  ).then(() => check("the submit control becomes enabled after hydration", true))
   .catch(() => check("the submit control becomes enabled after hydration", false,
     "it stayed disabled — the fix broke the form"));

  const label = (await submit.textContent())?.trim() ?? "";
  check("the label returns to the original call to action",
    !/preparing/i.test(label) && label.length > 0, JSON.stringify(label));

  // And it still actually works end to end.
  await page.fill("#c-name", "Hydrated Probe");
  await page.fill("#c-email", "hydrated@example.test");
  await page.fill("#c-message", "Submitted after hydration.");
  await submit.click();
  await page.waitForURL(/thank-you\/message/, { timeout: 15000 })
    .then(() => check("a hydrated form still submits and reaches the thank-you route", true))
    .catch(() => check("a hydrated form still submits and reaches the thank-you route", false, page.url()));

  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════
   R2-04 · crossing the breakpoint with the menu open
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n=== R2-04 · the mobile menu across a breakpoint change ===");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load" });

  const toggle = page.locator("header button[aria-expanded]").first();
  await toggle.click();
  await page.waitForTimeout(250);

  check("the menu opens on a phone viewport",
    (await toggle.getAttribute("aria-expanded")) === "true");
  check("the scroll lock is applied while it is open",
    (await page.evaluate(() => document.body.style.overflow)) === "hidden");

  // The event that produced the finding: the viewport widens past `lg` while
  // the panel is open.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(350);

  check("the page can be scrolled again after widening past the breakpoint",
    (await page.evaluate(() => document.body.style.overflow)) !== "hidden",
    `body.style.overflow = ${JSON.stringify(await page.evaluate(() => document.body.style.overflow))}`);
  check("the menu no longer reports itself as open",
    (await toggle.getAttribute("aria-expanded")) !== "true",
    String(await toggle.getAttribute("aria-expanded")));
  /* The observable consequence, not just the style property. `scrollTo` is
     asked for explicitly non-smooth because the site sets scroll-behavior:
     smooth, which animates and would make this a race rather than a check. */
  check("the page actually scrolls",
    await page.evaluate(async () => {
      window.scrollTo({ top: 400, behavior: "instant" });
      for (let i = 0; i < 40 && window.scrollY === 0; i++) {
        await new Promise((r) => setTimeout(r, 25));
      }
      return window.scrollY > 0;
    }),
    `scrollY stayed at ${await page.evaluate(() => window.scrollY)}`);

  // Going back to a phone viewport must leave the menu usable, not stuck.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await toggle.click();
  await page.waitForTimeout(250);
  check("the menu still opens normally after the round trip",
    (await toggle.getAttribute("aria-expanded")) === "true");
  check("and the scroll lock is re-applied",
    (await page.evaluate(() => document.body.style.overflow)) === "hidden");

  await ctx.close();
}

await browser.close();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
