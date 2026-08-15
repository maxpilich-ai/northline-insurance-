import { chromium } from "playwright";

/**
 * ============================================================================
 * CONTENT CLAIMS THE PAGE MUST NOT MAKE (findings R4-05, R4-19, R4-20)
 * ============================================================================
 *
 * FINDING R6-07. Three Round 4 findings were fixed and never tested. Round 6
 * proved it by mutation: setting `termsPublished = true` in careers/page.tsx
 * restores the exact R4-19 defect — the page asserting "Compensation is set out
 * in full further down this page" directly above six unfilled {{TOKEN}}s — and
 * the entire 757-assertion suite still passed. `doc-consistency.mjs` passed.
 * `demo-safety.mjs` passed. No test file referenced the claim at all.
 *
 * A fix nothing asserts is a fix that lasts until the next edit. These are the
 * assertions those three findings should have shipped with.
 *
 * The rule they share: THE PAGE MAY NOT PROMISE WHAT THE TOKENS DO NOT YET
 * SUPPLY. Each check compares a sentence rendered in the browser against the
 * state of the values that sentence describes, so filling the tokens in flips
 * the expectation automatically rather than breaking the test.
 *
 *   node tests/regression/content-claims.mjs http://127.0.0.1:PORT
 */

/**
 * Expectations come from the CONFIG, not from what the page happens to render.
 *
 * An earlier draft decided "is the team size filled in?" by looking for
 * `{{TEAM_SIZE}}` in the rendered text — so on a route that never renders that
 * token at all the answer came back "filled", and every claim check below it
 * passed without testing anything. That is the same vacuous-pass shape this
 * file exists to close. `site.config.ts` is the single source of truth for
 * whether a value is confirmed, so it is asked directly.
 */
const { site, isResolved, allResolved } = await import("../../src/lib/site.config.ts");

const BASE = process.argv[2];
if (!BASE) {
  console.error("usage: content-claims.mjs <base-url>");
  process.exit(2);
}

let failed = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failed = 1;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const textOf = async (route) => {
  await page.goto(BASE + route, { waitUntil: "load" });
  await page.waitForTimeout(250);
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
};

/* ══ R4-19 · the careers compensation promise ══════════════════════════ */

console.log("\n1 · /careers may not promise terms it has not published (R4-19)");
{
  const text = await textOf("/careers");

  // The six values the "terms" table renders, read from the config itself.
  const TERMS = {
    commissionStructure: site.commissionStructure,
    vestingPolicy: site.vestingPolicy,
    releasePolicy: site.releasePolicy,
    leadPolicy: site.leadPolicy,
    chargebackPolicy: site.chargebackPolicy,
    employmentStatus: site.employmentStatus,
  };
  const unpublished = Object.entries(TERMS).filter(([, v]) => !isResolved(v)).map(([k]) => k);
  const published = allResolved(...Object.values(TERMS));

  console.log(`     ${unpublished.length}/6 compensation terms still unfilled`);

  /**
   * The self-falsifying sentence, verbatim. It may appear ONLY when every term
   * is filled. This is the assertion whose absence let the R6-07 mutant live.
   */
  const promises = /Compensation is set out in full further down this page/i.test(text);
  check(
    published
      ? "terms are published, so the page may say so"
      : "terms are NOT published, so the page must not claim they are",
    promises === published,
    `page ${promises ? "claims" : "does not claim"} the terms are published; ${unpublished.length} are unfilled: ${unpublished.join(" ")}`
  );

  // The honest alternative must actually be shown in its place.
  check(
    published ? "(n/a — terms published)" : "...and says instead that they are not published yet",
    published || /not published yet/i.test(text),
    text.slice(0, 0) || "the replacement sentence is missing"
  );

  // Same rule for the recruiting-compensation question.
  const downlineFilled = isResolved(site.downlineDisclosure);
  const answersPlainly = /is answered plainly further down this page\./i.test(text);
  check(
    downlineFilled
      ? "the recruiting answer is filled, so the page may say it is answered"
      : "the recruiting answer is unfilled, so the page must qualify the promise",
    answersPlainly === downlineFilled,
    `claims=${answersPlainly} filled=${downlineFilled}`
  );

  // And no unconditional promise anywhere in the careers copy.
  for (const [what, re] of [
    ["a salary figure", /\$\s?\d[\d,]*(\.\d+)?\s*(per|\/)?\s*(year|yr|month|hour)?/i],
    ["a commission percentage", /\b\d{1,3}\s?%\s*(commission|comp|payout)/i],
    ["a guaranteed income claim", /\b(guaranteed|guarantee)\s+(income|earnings|commission|salary)/i],
    ["a headcount claim", /\b\d[\d,]*\+?\s*(producers|agents) (on|in) (our|the) (team|agency)/i],
  ]) {
    check(`/careers publishes no ${what}`, !re.test(text), (text.match(re) ?? [""])[0]);
  }
}

/* ══ R4-05 · the producer-headcount claim ══════════════════════════════ */

console.log("\n2 · no page asserts a producer headcount it cannot support (R4-05)");
{
  const teamFilled = isResolved(site.teamSize);
  console.log(`     site.teamSize is ${teamFilled ? "confirmed" : "an unfilled token"} — claims are ${teamFilled ? "permitted" : "forbidden"}`);
  for (const route of ["/about", "/", "/careers", "/how-it-works", "/faq", "/carriers"]) {
    const text = await textOf(route);

    /**
     * R4-05 was the heading "Licensed producers work under the brokerage." —
     * an unqualified statement about how many people there are and what they
     * do, with the number itself held as an unfilled token.
     */
    const CLAIMS = [
      [/Licensed producers work under the brokerage/i, "the exact R4-05 sentence"],
      [/\bour team of \d/i, "a numbered team claim"],
      [/\b\d[\d,]*\+?\s*(licensed )?(producers|agents|advisors)\b/i, "a producer count"],
      [/\bproducers work under\b/i, "an unqualified 'producers work under' claim"],
    ];
    for (const [re, what] of CLAIMS) {
      const hit = re.test(text);
      check(
        `${route.padEnd(15)} makes no ${what}${teamFilled ? " (team size filled — would be allowed)" : ""}`,
        teamFilled ? true : !hit,
        (text.match(re) ?? [""])[0]
      );
    }
  }
}

/* ══ R4-20 · the privacy policy describes what the code does ═══════════ */

console.log("\n3 · /privacy describes the code's actual behaviour (R4-20)");
{
  const text = await textOf("/privacy");

  /**
   * Gap 1. The user-agent and the claimed page are kept only for the two kinds
   * that build a consent record — `quote` and `agent`. The contact form makes
   * none, so the policy must not say those are kept for every submission.
   */
  check(
    "it does not claim user-agent is kept for every form",
    !/When (any|a) form is submitted[^.]*user-agent/i.test(text),
    (text.match(/When (any|a) form is submitted[^.]{0,120}/i) ?? [""])[0]
  );
  check(
    "it scopes user-agent and referrer to the two consent-bearing forms",
    /only for the quote form and the producer application/i.test(text),
    "the scoping sentence is missing"
  );
  check(
    "it says plainly that the contact form keeps neither",
    /contact form creates no consent record/i.test(text),
    "the contact-form carve-out is missing"
  );

  /**
   * Gap 2. Email delivery needs three environment variables. The policy used to
   * state it unconditionally.
   */
  check(
    "delivery is described as conditional on configuration, not as a fact",
    /whichever delivery routes this deployment has configured/i.test(text),
    "the conditional delivery sentence is missing"
  );
  check(
    "it does not state unconditionally that submissions are emailed",
    !/A submission is sent to the brokerage by email and/i.test(text),
    (text.match(/A submission is sent[^.]{0,90}/i) ?? [""])[0]
  );

  /** Gap 3. The IP claim must stay conditional on the trusted-proxy setting. */
  check(
    "the IP claim remains conditional on a trusted proxy",
    /recorded only when this deployment is behind a proxy it trusts/i.test(text),
    "the conditional IP sentence is missing"
  );
}

await browser.close();
console.log("");
console.log(failed ? "CONTENT CLAIMS: FAILURES" : "CONTENT CLAIMS: all checks passed");
process.exit(failed);
