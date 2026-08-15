import { chromium } from "playwright";

/**
 * ============================================================================
 * THE QUOTE WIZARD — ARRIVING AT STEP 5, AND RADIO-GROUP VALIDATION
 * ============================================================================
 *
 * FINDING R4-01. Advancing to the last step of the wizard fired a SUBMIT. The
 * person had not filled in name, email, telephone or consent, so they were met
 * with four validation errors on a step they had just arrived at, having done
 * nothing wrong. On the site's primary conversion form.
 *
 * The cause was React reconciliation, not an event handler. Steps 1-4 render a
 * "Continue" button and step 5 renders a "Send my request" button, in the same
 * position, from a ternary. Without distinct keys React reuses the same DOM
 * node and mutates its `type` from "button" to "submit" — and the click that
 * caused the step change is still being dispatched to that node, which is now a
 * submit button inside a form.
 *
 * The fix is at two levels, because keys alone would leave the class open:
 * distinct `key`s stop the node being reused, and a `step !== last` guard in
 * the submit handler makes an early submission impossible however it is
 * provoked — including by pressing Enter in a text input on step 3, which is
 * implicit form submission and never involved the button at all.
 *
 * So this file does not test for keys. It tests the observable property: you
 * can reach step 5, by any means a person has, without being shown an error.
 *
 * FINDING R4-15 is here too, because it is the same form: radio groups are the
 * only controls on it that did not carry `aria-invalid` and `aria-describedby`
 * after a failed submit, so a screen-reader user was told "radio group" with no
 * indication that it was the thing blocking them.
 */

const BASE = process.argv[2];
if (!BASE) {
  console.error("usage: quote-wizard.mjs <base-url>");
  process.exit(2);
}

let failed = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failed = 1;
};

const browser = await chromium.launch();

/** What the page is showing, from the outside. */
const snapshot = (page) =>
  page.evaluate(() => ({
    alerts: [...document.querySelectorAll('[role="alert"]')]
      .map((e) => e.textContent.trim())
      .filter(Boolean),
    invalid: [...document.querySelectorAll('[aria-invalid="true"]')].map(
      (e) => e.id || e.getAttribute("name") || e.tagName
    ),
    onStep5: Boolean(document.querySelector("#consent")),
    heading: document.querySelector("#wizard-step-heading")?.textContent?.trim() ?? null,
    url: location.pathname + location.search,
  }));

/**
 * Walks steps 1-4, advancing by `how`.
 *
 * "mouse"  — clicking Continue
 * "enter"  — focusing Continue and pressing Enter
 * "space"  — focusing Continue and pressing Space (the other button activation)
 * "field"  — pressing Enter inside a TEXT INPUT on step 3, which is implicit
 *            form submission and does not involve the button at all. This is
 *            the vector distinct keys alone would not have closed.
 */
async function walk(page, how) {
  await page.goto(`${BASE}/quote`, { waitUntil: "load" });
  await page.waitForTimeout(300);

  const advance = async () => {
    const btn = page.getByRole("button", { name: /continue/i });
    if (how === "mouse") await btn.click();
    else {
      await btn.focus();
      await page.keyboard.press(how === "enter" ? "Enter" : " ");
    }
    await page.waitForTimeout(300);
  };

  await page.getByText("People depend on my income").click();
  await advance();
  await page.getByText("$500,000 – $1 million").click();
  await advance();
  await page.fill("#age", "42");
  await page.getByText("Female", { exact: true }).click();
  await page.selectOption("#state", "Minnesota");
  await page.getByText("No", { exact: true }).click();
  await advance();
  await page.getByText("Good", { exact: true }).click();
  await advance();
  await page.waitForTimeout(500);
}

/* ══ 1. Arriving at step 5, by every route a person has ════════════════ */

console.log("\n1 · arriving at step 5 shows no errors");

for (const how of ["mouse", "enter", "space"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await walk(page, how);
  const s = await snapshot(page);
  check(
    `advanced by ${how.padEnd(6)} → step 5 reached`,
    s.onStep5,
    `heading=${JSON.stringify(s.heading)} url=${s.url}`
  );
  check(
    `advanced by ${how.padEnd(6)} → no validation errors on arrival`,
    s.alerts.length === 0 && s.invalid.length === 0,
    `alerts=${JSON.stringify(s.alerts)} invalid=${JSON.stringify(s.invalid)}`
  );
  await ctx.close();
}

/* ══ 2. Implicit submission from an earlier step ═══════════════════════ */

console.log("\n2 · Enter inside a text field on step 3 does not submit the form");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/quote`, { waitUntil: "load" });
  await page.waitForTimeout(300);
  await page.getByText("People depend on my income").click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForTimeout(250);
  await page.getByText("$500,000 – $1 million").click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForTimeout(250);

  await page.click("#age");
  await page.fill("#age", "42");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);

  const s = await snapshot(page);
  check(
    "still on the wizard, not navigated to a thank-you page",
    s.url.startsWith("/quote"),
    s.url
  );
  check(
    "no validation errors were raised by pressing Enter",
    s.alerts.length === 0,
    JSON.stringify(s.alerts)
  );
  await ctx.close();
}

/* ══ 3. Back and forward ═══════════════════════════════════════════════ */

console.log("\n3 · browser Back and Forward do not produce a submit");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await walk(page, "mouse");
  const before = await snapshot(page);
  check("reached step 5 before navigating", before.onStep5);

  await page.goBack();
  await page.waitForTimeout(500);
  const back = await snapshot(page);
  check("after Back: no validation errors", back.alerts.length === 0, JSON.stringify(back.alerts));

  await page.goForward();
  await page.waitForTimeout(500);
  const fwd = await snapshot(page);
  check("after Forward: no validation errors", fwd.alerts.length === 0, JSON.stringify(fwd.alerts));
  await ctx.close();
}

/* ══ 4. Direct navigation ══════════════════════════════════════════════ */

console.log("\n4 · loading /quote directly starts at step 1, clean");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/quote`, { waitUntil: "load" });
  await page.waitForTimeout(500);
  const s = await snapshot(page);
  check("no errors on first load", s.alerts.length === 0, JSON.stringify(s.alerts));
  check("not on step 5", !s.onStep5);
  await ctx.close();
}

/* ══ 5. The form still works ═══════════════════════════════════════════ */

console.log("\n5 · a complete journey still submits (the fix did not disable submit)");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await walk(page, "mouse");
  await page.fill("#name", "Wizard Probe");
  await page.fill("#email", "wizard@example.test");
  await page.fill("#phone", "9522327177");
  await page.check("#consent");
  await page.getByRole("button", { name: /send my request/i }).click();
  const reached = await page
    .waitForURL(/thank-you\/quote/, { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  check("a filled step 5 reaches /thank-you/quote", reached, page.url());
  await ctx.close();
}

/* ══ 6. Radio-group validation semantics (R4-15) ═══════════════════════ */

console.log("\n6 · radio groups announce their own errors (R4-15)");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/quote`, { waitUntil: "load" });
  await page.waitForTimeout(400);

  // Advance without choosing anything: step 1 is a radio group, so this is the
  // failed-submit state for a radiogroup specifically.
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForTimeout(400);

  const group = await page.evaluate(() => {
    const g = document.querySelector('[role="radiogroup"]');
    if (!g) return null;
    const describedBy = g.getAttribute("aria-describedby");
    const target = describedBy ? document.getElementById(describedBy) : null;
    return {
      invalid: g.getAttribute("aria-invalid"),
      describedBy,
      targetExists: Boolean(target),
      targetText: target?.textContent?.trim() ?? null,
      targetIsAlert: target?.getAttribute("role") === "alert",
      labelledBy: g.getAttribute("aria-labelledby"),
      labelExists: Boolean(
        g.getAttribute("aria-labelledby") &&
          document.getElementById(g.getAttribute("aria-labelledby"))
      ),
      duplicateIds: (() => {
        const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
        return ids.filter((id, i) => ids.indexOf(id) !== i);
      })(),
    };
  });

  check("the radio group exists", group !== null);
  if (group) {
    check('aria-invalid="true" after a failed submit', group.invalid === "true", String(group.invalid));
    check("aria-describedby is set", Boolean(group.describedBy), String(group.describedBy));
    check("...and points at an element that exists", group.targetExists);
    check("...which is the error message", Boolean(group.targetText), String(group.targetText));
    check("...and is announced (role=alert)", group.targetIsAlert);
    check("the group is still labelled by the question", group.labelExists, String(group.labelledBy));
    check("no duplicate ids on the page", group.duplicateIds.length === 0, group.duplicateIds.join(", "));
  }

  // Choosing an option clears the association, so nothing points at a message
  // that is no longer rendered.
  await page.getByText("People depend on my income").click();
  await page.waitForTimeout(300);
  const cleared = await page.evaluate(() => {
    const g = document.querySelector('[role="radiogroup"]');
    const d = g?.getAttribute("aria-describedby");
    return { invalid: g?.getAttribute("aria-invalid"), describedBy: d, dangling: Boolean(d && !document.getElementById(d)) };
  });
  check("aria-invalid is cleared once a choice is made", cleared.invalid === null, String(cleared.invalid));
  check("aria-describedby never dangles", !cleared.dangling, String(cleared.describedBy));

  await ctx.close();
}

/* ══ 7. Focus moves to the failed field on EVERY step (R6-05) ══════════ */

console.log("\n7 · a failed submit moves focus to the field, on every step (R6-05)");
{
  /**
   * `focusFirstError` used to find a radio group only via a `${id}-label` span,
   * which is how `Field ... group` names one. The wizard's `situation`,
   * `amount` and `health` groups are `OptionCards` labelled by the step
   * heading, so no such span exists and focus silently stayed on the Continue
   * button — on the three steps where the radio group IS the entire step.
   *
   * Measured before the fix: steps 1, 2 and 4 left focus on BUTTON "Continue".
   * The accessibility suite exercised only /contact, which has no radio group,
   * so nothing saw it.
   */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const focused = () =>
    page.evaluate(() => {
      const a = document.activeElement;
      return {
        tag: a?.tagName ?? null,
        name: a?.getAttribute("name") ?? null,
        id: a?.id ?? null,
        isButton: a?.tagName === "BUTTON",
      };
    });
  const advance = async () => {
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForTimeout(450);
  };

  await page.goto(`${BASE}/quote`, { waitUntil: "load" });
  await page.waitForTimeout(400);

  // Step 1 · situation — OptionCards, labelled by the step heading
  await advance();
  let f = await focused();
  check("step 1 (situation): focus lands on the radio, not the button",
    !f.isButton && f.name === "situation", JSON.stringify(f));

  await page.getByText("People depend on my income").click();
  await advance();
  await page.waitForTimeout(150);

  // Step 2 · amount — OptionCards
  await advance();
  f = await focused();
  check("step 2 (amount): focus lands on the radio, not the button",
    !f.isButton && f.name === "amount", JSON.stringify(f));

  await page.getByText("$500,000 – $1 million").click();
  await advance();

  // Step 3 · mixed inputs — the first error is the text input
  await advance();
  f = await focused();
  check("step 3 (age first): focus lands on the input",
    !f.isButton && f.id === "age", JSON.stringify(f));

  // Step 3 · once age is filled the first error is the sex radio group
  await page.fill("#age", "42");
  await advance();
  f = await focused();
  check("step 3 (sex): focus lands on the radio",
    !f.isButton && f.name === "sex", JSON.stringify(f));

  await page.getByText("Female", { exact: true }).click();
  await page.selectOption("#state", "Minnesota");
  await advance();
  f = await focused();
  check("step 3 (tobacco): focus lands on the radio",
    !f.isButton && f.name === "tobacco", JSON.stringify(f));

  await page.getByText("No", { exact: true }).click();
  await advance();
  await page.waitForTimeout(150);

  // Step 4 · health — OptionCards
  await advance();
  f = await focused();
  check("step 4 (health): focus lands on the radio, not the button",
    !f.isButton && f.name === "health", JSON.stringify(f));

  await ctx.close();
}

await browser.close();

console.log("");
console.log(failed ? "QUOTE WIZARD: FAILURES" : "QUOTE WIZARD: all checks passed");
process.exit(failed);
