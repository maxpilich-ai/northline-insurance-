/**
 * BROWSER TESTS — the Turnstile-enabled build (finding R3-H3).
 *
 * Driven by tests/regression/turnstile-enabled.sh, which builds and starts a
 * production image with both Turnstile keys present.
 *
 * THE DEFECT. When the widget script could not load — an ad-blocker, a privacy
 * extension, a corporate filter, a regional block — no token was ever produced,
 * the server answered 403, and the visitor saw "We could not send that just
 * now. Please try again". They could try forever. The README described
 * Turnstile as failing open, which was only ever true of the server.
 *
 * WHAT IS ASSERTED. That the failure is now VISIBLE and ACTIONABLE, that the
 * fallback is real (a telephone number that dials), that it is announced to
 * assistive technology, that retrying is possible, and — just as important —
 * that none of this became a bot bypass: the server still refuses a submission
 * with no token, and the browser cannot talk its way past that.
 *
 *   node tests/regression/turnstile-ui.mjs http://127.0.0.1:PORT
 */
import { namedIdentity } from "../identities.mjs";
const { site, isResolved } = await import("../../src/lib/site.config.ts");

import { chromium } from "playwright";

/* Two servers, ONE build. The Turnstile secret is read at runtime, so BASE runs
   with Cloudflare's always-ACCEPT test secret (the success path) and REJECT_BASE
   with the always-REJECT one (the invalid-token path). */
const BASE = process.argv[2] ?? "http://127.0.0.1:4830";
const REJECT_BASE = process.argv[3] ?? "http://127.0.0.1:4831";
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

const browser = await chromium.launch();

/** Fill the contact form's three fields. */
async function fillContact(page) {
  await page.fill("#c-name", "Turnstile Probe");
  await page.fill("#c-email", "tp@example.test");
  await page.fill("#c-message", "Checking the verification fallback path.");
}

/* ══════════════════════════════════════════════════════════════════════════
   1 · The widget is actually wired up in this build
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n=== the enabled build mounts the widget ===");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/contact", { waitUntil: "load" });
  await page.waitForTimeout(2500);

  const seen = await page.evaluate(() => ({
    slot: !!document.querySelector("[data-turnstile-slot]"),
    script: !!document.querySelector('script[src*="challenges.cloudflare.com"]'),
  }));
  check("a Turnstile slot is rendered", seen.slot);
  check("the Turnstile script is requested", seen.script);
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════
   2 · Cloudflare unreachable / script blocked — the R3-H3 case
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n=== the browser cannot reach Cloudflare ===");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route("**challenges.cloudflare.com**", (r) => r.abort());
  await page.goto(BASE + "/contact", { waitUntil: "load" });

  // The component settles on "unavailable" from the script's error event.
  await page.waitForSelector("[data-verification-unavailable]", { timeout: 20_000 })
    .then(() => check("the visitor is told the form cannot be sent", true))
    .catch(() => check("the visitor is told the form cannot be sent", false,
      "no notice appeared within 20s"));

  const notice = await page.evaluate(() => {
    const el = document.querySelector("[data-verification-unavailable]");
    if (!el) return null;
    const tel = el.querySelector('a[href^="tel:"]');
    // When the number is still an unfilled token the site deliberately renders
    // it as text rather than an anchor — a `tel:` built from a placeholder
    // opens the dialler with nonsense in it. Find whichever one is present.
    const shown =
      tel ??
      [...el.querySelectorAll("span,a")].find((n) =>
        /\{\{OFFICE_PHONE\}\}|[0-9]{3}[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/.test(n.textContent ?? "")
      ) ??
      null;
    const btn = el.querySelector("button");
    return {
      role: el.getAttribute("role"),
      text: el.textContent.replace(/\s+/g, " ").trim(),
      telHref: tel?.getAttribute("href") ?? null,
      telShown: Boolean(shown),
      telVisible: shown ? shown.getBoundingClientRect().width > 0 : false,
      hasRetry: !!btn,
      retryLabel: btn?.textContent?.trim() ?? null,
      withinViewport: el.getBoundingClientRect().right <= window.innerWidth + 1,
    };
  });

  check("the notice is announced to assistive technology",
    notice?.role === "alert", `role=${notice?.role}`);
  check("it explains the cause rather than blaming the visitor",
    /ad-blocker|privacy extension|network filter/i.test(notice?.text ?? ""), notice?.text?.slice(0, 120));
  /**
   * THE NUMBER IS ALWAYS SHOWN; IT DIALS ONLY WHEN IT IS REAL.
   *
   * This used to assert an `href="tel:+..."` unconditionally. That was true
   * while `site.phoneHref` held a literal number, and became false the moment
   * the office telephone was redacted to a {{TOKEN}} — at which point
   * `PhoneLink` deliberately renders a span instead, because a `tel:` link
   * built from a placeholder opens the dialler with nonsense in it and the
   * visitor concludes the business is broken rather than the site unfinished.
   *
   * So the assertion now follows the design: the fallback must always OFFER
   * the number visibly, and must be dialable exactly when the token is filled.
   * Asked of the config rather than guessed, so filling the number in flips the
   * expectation automatically instead of breaking this test.
   */
  const dialable = isResolved(site.phoneHref);
  check("the fallback shows the office telephone at all", notice?.telShown === true);
  check("the telephone is visible on a phone viewport", notice?.telVisible === true);
  check(
    dialable
      ? "the number is filled in, so it is a real tel: link"
      : "the number is an unfilled token, so it is shown as text rather than a dead tel: link",
    dialable
      ? typeof notice?.telHref === "string" && notice.telHref.startsWith("tel:+")
      : notice?.telHref === null,
    `telHref=${String(notice?.telHref)} phoneHref=${site.phoneHref}`
  );
  check("the notice fits a 390px viewport", notice?.withinViewport === true);
  check("a retry control is offered", notice?.hasRetry === true, String(notice?.retryLabel));

  // The submit button must stop pretending.
  const submit = page.locator('form button[type="submit"]').first();
  check("the submit button is disabled rather than doomed", await submit.isDisabled());
  const label = (await submit.textContent())?.trim() ?? "";
  check("its label names the actual problem", /verification/i.test(label), JSON.stringify(label));

  // And what the visitor typed is not destroyed.
  await fillContact(page);
  await submit.click({ force: true }).catch(() => {});
  await page.waitForTimeout(800);
  check("clicking does not navigate or clear the form",
    page.url().includes("/contact") && !page.url().includes("?") &&
      (await page.inputValue("#c-name")) === "Turnstile Probe");

  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════
   3 · Retry after failure
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n=== the visitor can retry ===");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  let blocking = true;
  await page.route("**challenges.cloudflare.com**", (r) => (blocking ? r.abort() : r.continue()));
  await page.goto(BASE + "/contact", { waitUntil: "load" });
  await page.waitForSelector("[data-verification-unavailable]", { timeout: 20_000 });

  await fillContact(page);
  blocking = false;
  await page.locator("[data-verification-unavailable] button").click();
  await page.waitForTimeout(1500);

  check("retrying does not clear what was already typed",
    (await page.inputValue("#c-name")) === "Turnstile Probe");
  const requested = await page.evaluate(
    () => document.querySelectorAll('script[src*="challenges.cloudflare.com"]').length > 0
  );
  check("retrying re-attempts the verification", requested);
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════
   4 · No bot bypass was created
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n=== the fallback is not a bypass ===");
{
  const body = {
    kind: "contact", name: "No Token", email: "nt@example.test", phone: "",
    reason: "general", message: "Submitting with no Turnstile token at all.",
  };
  const noToken = await fetch(BASE + "/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": namedIdentity("turnstile-ui", 201) },
    body: JSON.stringify(body),
  });
  await noToken.text();
  check("the server still refuses a submission with no token", noToken.status === 403,
    `status ${noToken.status}`);

  // Nothing the client can say should change that.
  const claiming = await fetch(BASE + "/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": namedIdentity("turnstile-ui", 202) },
    body: JSON.stringify({ ...body, turnstileToken: "", verificationUnavailable: true, skipVerification: true }),
  });
  await claiming.text();
  check("a client claiming 'verification was unavailable' is still refused",
    claiming.status === 403, `status ${claiming.status}`);

  /* Against the always-REJECT secret, a token that Cloudflare declines must be
     refused. BASE cannot show this: its test secret accepts everything by
     design, which is what makes the success path above meaningful. */
  const declined = await fetch(REJECT_BASE + "/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": namedIdentity("turnstile-ui", 203) },
    body: JSON.stringify({ ...body, turnstileToken: "a-token-cloudflare-will-decline" }),
  });
  await declined.text();
  check("a token Cloudflare declines is refused", declined.status === 403,
    `status ${declined.status}`);

  const declinedEmpty = await fetch(REJECT_BASE + "/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": namedIdentity("turnstile-ui", 204) },
    body: JSON.stringify(body),
  });
  await declinedEmpty.text();
  check("and so is no token at all on that server", declinedEmpty.status === 403,
    `status ${declinedEmpty.status}`);
}

/* ══════════════════════════════════════════════════════════════════════════
   5 · The success path — enabled, reachable, challenge passes
   ══════════════════════════════════════════════════════════════════════════
   This one needs the browser to actually fetch Cloudflare's widget script, so
   it is gated on a capability probe rather than assumed. Where the host is
   unreachable the *correct* behaviour is the fallback asserted above, and
   asserting the success path there would be asserting that the network is
   something it is not. Reported as SKIPPED, with the reason, and never counted
   as a pass.
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n=== Turnstile enabled and working ===");
{
  /* Probed FROM THE BROWSER, not from Node. They do not agree: in this sandbox
     Node's fetch reaches the host while Chromium's request is reset, and it is
     the browser's view that decides whether a visitor can be challenged. */
  let reachable = false;
  let why = "";
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE + "/contact", { waitUntil: "domcontentloaded" });
    reachable = await page.evaluate(async () => {
      try {
        await new Promise((resolve, reject) => {
          const el = document.createElement("script");
          el.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          el.onload = resolve;
          el.onerror = () => reject(new Error("script failed to load"));
          document.head.appendChild(el);
          setTimeout(() => reject(new Error("timed out")), 8000);
        });
        return typeof window.turnstile !== "undefined";
      } catch {
        return false;
      }
    });
    if (!reachable) why = "the browser here cannot load the widget script";
    await ctx.close();
  }

  if (!reachable) {
    console.log(`  SKIP  the success path — ${why}.`);
    console.log("        The widget script cannot be fetched in this environment, so a passing");
    console.log("        challenge cannot be produced. Everything above still ran: this is the");
    console.log("        same condition as a blocked client, and the fallback behaviour it");
    console.log("        triggers is asserted in full. Run this suite where");
    console.log("        challenges.cloudflare.com is reachable to cover the success path.");
  } else {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/contact", { waitUntil: "load" });
    // Long enough for the widget to mint a token, short of the component's own
    // unavailability timeout.
    await page.waitForTimeout(6000);

    const blocked = await page.evaluate(
      () => !!document.querySelector("[data-verification-unavailable]")
    );
    check("no failure notice is shown when the widget can load", !blocked);

    const submit = page.locator('form button[type="submit"]').first();
    check("the submit button is enabled", !(await submit.isDisabled()));

    await fillContact(page);
    await submit.click();
    await page.waitForURL(/thank-you\/message/, { timeout: 25_000 })
      .then(() => check("a verified submission reaches the thank-you route", true))
      .catch(() => check("a verified submission reaches the thank-you route", false, page.url()));
    await ctx.close();
  }
}

await browser.close();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
