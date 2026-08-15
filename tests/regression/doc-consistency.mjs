import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

/**
 * ============================================================================
 * DOCUMENTATION / CODE CONSISTENCY
 * ============================================================================
 *
 * Round 4's single most common defect was not a bug in the application. It was
 * a fix applied in one artifact and not in its duplicate:
 *
 *   R4-02  the README quoted `carrierCount: "30",  // confirmed` long after the
 *          code had moved every count to an unfilled token — so the repository's
 *          front page advertised a fabricated business fact the site itself had
 *          already stopped making.
 *   R4-07  three claims in COMMITMENTS.md described behaviour the code no
 *          longer had.
 *   R4-11  the data-sharing promise existed twice, once as a token and once
 *          hard-coded in a page.
 *   R4-17  the README said the Turnstile call had a 10-second timeout; the code
 *          said 8.
 *   R4-21  NOTICE.md described the counts as "illustrative figures", which they
 *          had stopped being.
 *
 * Every one of those is invisible to a test suite that only exercises the
 * running application, and every one of them is a claim a reader would believe.
 * So the claims are asserted here, against the code they describe. A future
 * edit to either side that does not update the other fails this suite.
 *
 * WHAT THIS FILE IS NOT. It is not a spell-checker for prose, and it does not
 * assert that documentation exists. It asserts the specific, checkable
 * statements that have already drifted once.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/**
 * Source scans strip comments first.
 *
 * Several of these rules are now DOCUMENTED in the very files they police —
 * the message thank-you page explains what sentence was removed, globals.css
 * quotes the `/NN` modifiers that silently compiled away. A check that fired on
 * its own explanation would force the explanation out of the code, which is the
 * opposite of what these findings wanted. What matters is what the file DOES,
 * so comments are removed before matching.
 */
const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let failed = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failed = 1;
};

const config = read("src/lib/site.config.ts");
const readme = read("README.md");
const notice = read("NOTICE.md");
const commitments = read("COMMITMENTS.md");
const delivery = read("src/lib/delivery.ts");
const route = read("src/app/api/lead/route.ts");

/* ══ 1. The README's config excerpt is the config ═══════════════════════ */

console.log("\n1 · README's site.config.ts excerpt matches the file it quotes");

const tokenNames = [...config.matchAll(/TOKEN\("([A-Z0-9_]+)"\)/g)].map((m) => m[1]);
const uniqueTokens = new Set(tokenNames);

check(
  "every token in the excerpt is a real token in site.config.ts",
  ["CARRIER_COUNT", "TEAM_SIZE", "NPN", "COMPENSATION_MODEL"].every((t) => uniqueTokens.has(t)),
  ["CARRIER_COUNT", "TEAM_SIZE", "NPN", "COMPENSATION_MODEL"].filter((t) => !uniqueTokens.has(t)).join(", ")
);

// R4-02. The README stated a token count in prose. A count in prose is a fact
// like any other, and this one was wrong by seventeen.
const claimed = readme.match(/one file, (\d+) unfilled tokens/);
check("README states a token count", Boolean(claimed), "the 'one file, N unfilled tokens' line is gone");
if (claimed) {
  check(
    `README's token count (${claimed[1]}) equals site.config.ts's (${uniqueTokens.size})`,
    Number(claimed[1]) === uniqueTokens.size,
    `README says ${claimed[1]}, the file has ${uniqueTokens.size}`
  );
}

/* ══ 2. No document asserts a business fact the code refuses to ═════════ */

console.log("\n2 · no document publishes a business fact the code holds as a token");

/**
 * The exact defect R4-02 was: a documentation file showing one of the token
 * fields with a literal value, which reads as the confirmed answer whatever
 * the surrounding prose says. Matching on the field names rather than on "30"
 * means a future fabricated value is caught too — the point is not that 30 was
 * wrong, it is that a number there is a claim.
 */
const NUMERIC_CLAIM_FIELDS = [
  "carrierCount",
  "additionalCarrierCount",
  "teamSize",
  "yearsInBusiness",
  "yearFounded",
  "npn",
  "residentLicense",
  "agencyLicense",
];

/**
 * SCOPE: FENCED CODE BLOCKS, PLUS A NARROW PROSE SCAN.
 *
 * R4-02 lived in a fenced block — documentation presenting code as the code
 * that is there. That is the asserting context, and it is scanned strictly.
 * Prose is different: the same three files now explain what the old line said
 * and why it was wrong, and a check that cannot tell an assertion from a
 * quotation would either fail on the explanation or force the explanation out
 * of the documentation, which would be the worse outcome. So prose gets a
 * separate, narrow scan for the thing that actually matters — a sentence
 * publishing a count.
 */
const fencedBlocks = (text) =>
  [...text.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((m) => m[1]).join("\n");

for (const [file, text] of [["README.md", readme], ["NOTICE.md", notice], ["COMMITMENTS.md", commitments]]) {
  const fenced = fencedBlocks(text);
  const offenders = NUMERIC_CLAIM_FIELDS.filter((f) =>
    // `carrierCount: "30"` or `carrierCount: 30` — a literal, not TOKEN(...).
    new RegExp(`${f}\\s*:\\s*["'\`]?\\d`).test(fenced)
  );
  check(`${file} code blocks assign no literal value to a token-held fact`, offenders.length === 0, offenders.join(", "));

  // The word that made R4-02 worse: the excerpt annotated the fabricated count
  // as "confirmed".
  check(`${file} code blocks annotate nothing as \`// confirmed\``, !/\/\/\s*confirmed/i.test(fenced));

  // Prose: no sentence may publish a count of carriers, companies or producers.
  const prose = text.replace(/^```[^\n]*\n[\s\S]*?^```/gm, "");
  const published = [
    ...prose.matchAll(/\b\d[\d,]*\+?\s+(?:carriers?|insurance compan\w+|licensed producers?|producers? on|agents? on)/gi),
  ].map((m) => m[0]);
  check(`${file} prose publishes no carrier or producer count`, published.length === 0, published.join(" / "));
}

// R4-21. NOTICE.md described the counts as illustrative figures, which implies
// figures are published. None is.
check(
  "NOTICE.md does not describe the counts as illustrative figures",
  !/illustrative figures?/i.test(notice)
);

/* ══ 3. Timeouts stated in prose are the timeouts in code ═══════════════ */

console.log("\n3 · documented timeouts match the code");

// R4-17.
const turnstileTimeout = route.match(/AbortSignal\.timeout\((\d+)_?(\d*)\)/);
const turnstileMs = turnstileTimeout
  ? Number(`${turnstileTimeout[1]}${turnstileTimeout[2]}`)
  : null;
const readmeTurnstile = readme.match(/an? (\d+)-second timeout/);
check("the Turnstile timeout is stated in the README", Boolean(readmeTurnstile));
check("the Turnstile timeout is set in route.ts", turnstileMs !== null);
if (readmeTurnstile && turnstileMs !== null) {
  check(
    `README's ${readmeTurnstile[1]}s matches route.ts's ${turnstileMs / 1000}s`,
    Number(readmeTurnstile[1]) * 1000 === turnstileMs,
    `README ${readmeTurnstile[1]}s vs code ${turnstileMs / 1000}s`
  );
}

/* ══ 4. The documented failure categories are the code's ════════════════ */

console.log("\n4 · README's failure categories are exactly delivery.ts's union");

const unionBlock = delivery.slice(
  delivery.indexOf("export type FailureCategory ="),
  delivery.indexOf("function categorise(")
);
const codeCategories = new Set([...unionBlock.matchAll(/\|\s*"([a-z-]+)"/g)].map((m) => m[1]));
const readmeCategories = new Set(
  [...(readme.match(/The categories are [^.]+\./s)?.[0] ?? "").matchAll(/`([a-z-]+)`/g)].map(
    (m) => m[1]
  )
);
const missingFromDocs = [...codeCategories].filter((c) => !readmeCategories.has(c));
const missingFromCode = [...readmeCategories].filter((c) => !codeCategories.has(c));
check("README lists no category the code does not have", missingFromCode.length === 0, missingFromCode.join(", "));
check("README omits no category the code has", missingFromDocs.length === 0, missingFromDocs.join(", "));

/* ══ 5. One authoritative rule per behaviour ════════════════════════════ */

console.log("\n5 · rules that exist once, and must keep existing once");

/**
 * R4-11. The data-sharing promise was rendered from `site.dataSharingPractice`
 * in most places and hard-coded as a sentence in the message thank-you page,
 * so filling the token in would have left one page still asserting the old
 * wording. There must be ONE authoritative source for it.
 */
const HARDCODED_DATA_SHARING = /(?:not|never)\s+(?:sold|shared)\s+or\s+(?:listed|sold)/i;
const pageFiles = [
  "src/app/thank-you/message/page.tsx",
  "src/app/thank-you/quote/page.tsx",
  "src/app/thank-you/apply/page.tsx",
  "src/components/ThankYou.tsx",
];
for (const f of pageFiles) {
  check(`${f} does not hard-code the data-sharing claim`, !HARDCODED_DATA_SHARING.test(stripComments(read(f))));
}

/**
 * R4-03/R4-08. The header's height existed as the literal `top-32` in eight
 * files and as nothing at all in the scroll-padding rule. It is now published
 * once, as `--chrome-top`, from the element that actually has the height.
 */
const stickyOffenders = [];
for (const f of [
  "src/components/home/CarrierAccess.tsx",
  "src/app/careers/page.tsx",
  "src/app/careers/apply/page.tsx",
  "src/app/coverage/page.tsx",
  "src/app/quote/page.tsx",
  "src/app/how-it-works/page.tsx",
  "src/app/about/page.tsx",
  "src/app/faq/page.tsx",
]) {
  const text = read(f);
  if (/lg:sticky/.test(text) && !/--chrome-top/.test(text)) stickyOffenders.push(f);
  if (/lg:top-32\b/.test(text)) stickyOffenders.push(`${f} (literal top-32)`);
}
check("every sticky sidebar offsets from --chrome-top, not a literal", stickyOffenders.length === 0, stickyOffenders.join(", "));

const css = read("src/app/globals.css");
check("scroll-padding is published from --chrome-top", /scroll-padding-top:\s*calc\(var\(--chrome-top/.test(css));
check("scroll-padding is published from --chrome-bottom", /scroll-padding-bottom:\s*calc\(var\(--chrome-bottom/.test(css));
check("Header publishes --chrome-top", /--chrome-top/.test(read("src/components/layout/Header.tsx")));
check("MobileCallBar publishes --chrome-bottom", /--chrome-bottom/.test(read("src/components/layout/MobileCallBar.tsx")));

/**
 * R4-14/R4-18 were the same predicate written for two callers. It is now one
 * module, and both must keep importing it rather than growing a local copy.
 */
check("request-identity imports the shared IP classifier", /from "\.\/ip-classify"/.test(read("src/lib/request-identity.ts")));
check("safe-fetch imports the shared IP classifier", /from "\.\/ip-classify"/.test(read("src/lib/safe-fetch.ts")));
check("delivery routes store requests through safeFetch", /safeFetch\(/.test(delivery));
check("delivery makes no bare fetch to the operator URL", !/await fetch\(url/.test(delivery));

/* ══ 6. Tailwind alpha modifiers on bare var() tokens ═══════════════════ */

console.log("\n6 · no alpha modifier on a bare var() colour token (R4-09)");

/**
 * `placeholder:text-muted/60` compiled to NOTHING. Tailwind can only apply
 * `/NN` to a colour it can decompose, and `muted: "var(--muted)"` is opaque to
 * it — so the declaration was silently dropped and the styleguide's swatch
 * showed full-strength text while claiming to show 60%. The failure mode is
 * silence, which is why it needs a test rather than a comment.
 *
 * Scans EVERY source file, not just the two that were wrong.
 */
/**
 * BOTH KEY FORMS. Tailwind config keys with a hyphen must be quoted —
 * `"accent-light": "var(--accent-light)"` — and an earlier version of this
 * scan only matched bare identifiers, so it missed every hyphenated colour in
 * the palette and with them a live `border-accent-light/50` in the footer.
 * A checker that silently covers half its subject is worse than none.
 */
const bareVarColours = [
  ...stripComments(read("tailwind.config.ts")).matchAll(/"?([\w][\w-]*)"?:\s*"var\(--[\w-]+\)"/g),
].map((m) => m[1]);
check("tailwind.config.ts defines bare var() colours (the risky kind)", bareVarColours.length > 0);

const sources = execSync("find src -type f \\( -name '*.tsx' -o -name '*.ts' -o -name '*.css' \\)", {
  cwd: ROOT,
  encoding: "utf8",
})
  .trim()
  .split("\n");

const alphaOffenders = [];
for (const f of sources) {
  const text = stripComments(read(f));
  for (const colour of bareVarColours) {
    // e.g. text-muted/60, placeholder:text-muted/60, border-accent/40
    const re = new RegExp(`[\\w:-]*-${colour}/\\d+`, "g");
    for (const m of text.matchAll(re)) alphaOffenders.push(`${f}: ${m[0]}`);
  }
}
check("no utility applies /NN alpha to a bare var() colour", alphaOffenders.length === 0, alphaOffenders.join(", "));

/* ══ 6b. Test suites do not share caller identities ═════════════════════ */

console.log("\n6b · every suite draws callers from its reserved block");

/**
 * WHY THIS IS A SOURCE CHECK AND NOT A RUNTIME ONE.
 *
 * Rate limits are per-caller and per-minute, and several suites hit the SAME
 * server inside one minute. Two suites that each invent `198.51.100.N` spend
 * each other's budgets — which surfaced as `global-budget.mjs` reporting
 * "1/60 distinct callers were rate limited", a failure that depended on test
 * ORDER and on the wall clock, did not reproduce when the suite ran alone, and
 * looked exactly like a real defect in the application.
 *
 * `tests/identities.mjs` allocates a block per suite. This asserts that
 * everyone uses it. A literal address is allowed only where the address SHAPE
 * is the thing under test — a malformed header, an IPv6 form — and the line
 * must say so with an `identity-literal` marker, so the exception is a
 * decision on the record rather than an oversight.
 */
{
  const testFiles = execSync("find tests -name '*.mjs'", { cwd: ROOT, encoding: "utf8" })
    .trim()
    .split("\n")
    .filter((f) => !f.endsWith("identities.mjs"));

  const offenders = [];
  for (const f of testFiles) {
    const lines = read(f).split("\n");
    lines.forEach((line, i) => {
      if (!/["'\`](?:X-)?[Ff]orwarded-[Ff]or["'\`]?\s*:\s*[\`"][0-9]/.test(line)) return;
      if (line.includes("identity-literal")) return;
      offenders.push(`${f}:${i + 1}`);
    });
  }
  check("no suite hard-codes a caller address", offenders.length === 0, offenders.join(", "));

  // ...and the registry itself allocates each suite a distinct block.
  const registry = read("tests/identities.mjs");
  const prefixes = [...registry.matchAll(/"([\w-]+)":\s*"(\d+\.\d+\.\d+)"/g)].map((m) => m[2]);
  check(
    "every reserved block is distinct",
    new Set(prefixes).size === prefixes.length,
    prefixes.filter((p, i) => prefixes.indexOf(p) !== i).join(", ")
  );
  console.log(`     ${prefixes.length} suites, ${new Set(prefixes).size} distinct blocks`);
}

/* ══ 6c. The README's rate-limit table matches the code ═════════════════ */

console.log("\n6c · README's rate-limit table describes the code that exists (R6-08)");

/**
 * FINDING R6-08. R4-04 moved the submission charge to a single point before
 * delivery, so 403 (Turnstile) and 409 (consent mismatch) began charging the
 * REJECTION budget. The code's own design note was updated; the README's table
 * was not, and still described the pre-R4-04 behaviour of the exact mechanism
 * R4-04 changed — on the repository's front page, about a security control.
 *
 * The two lists are now asserted against each other. A future change to which
 * checks precede the charge has to be made in both places or this fails.
 */
{
  const designNote = route.slice(
    route.indexOf("THE REDESIGN RESTS ON THREE RULES"),
    route.indexOf("2. EVERY CALLER HAS A COUNTING KEY")
  );
  const table = readme.slice(readme.indexOf("| `LEAD_RATE_LIMIT_PER_IDENTITY`"), readme.indexOf("The global ceiling is off"));

  // Every gate the code says precedes the charge must be named in the README.
  const GATES = ["content type", "size", "JSON", "schema", "Turnstile", "honeypot", "consent", "licence footprint"];
  const missing = GATES.filter((g) => {
    const inCode = new RegExp(g.replace(" ", "[ -]?"), "i").test(designNote);
    const inDocs = new RegExp(g.replace(" ", "[ -]?"), "i").test(table);
    return inCode && !inDocs;
  });
  check("the README names every gate the code counts as preceding the charge", missing.length === 0, missing.join(", "));

  // Every status the code charges to the rejection budget must be listed.
  const rejectStatuses = ["415", "413", "400", "422", "403", "409"];
  const undocumented = rejectStatuses.filter((code) => !table.includes(code));
  check("the README lists every status charged to the rejection budget", undocumented.length === 0, undocumented.join(", "));

  // R6-03: the refund is behaviour a reader must know about.
  check("the README documents the delivery-failure refund", /refunded/i.test(table), table.slice(0, 120));
  check("the code implements a refund", /function refundSubmissionBudget/.test(route));
  // Both delivery-failure exits (502 and 503) must go through the refund, and
  // must honour its verdict rather than discarding it — otherwise the refund
  // removes the only ceiling on retries instead of moving it.
  const refundCalls = (route.match(/if \(notDelivered\(\)\) return tooManyRetries\(\);/g) ?? []).length;
  check("both delivery-failure exits refund and stay bounded", refundCalls === 2, String(refundCalls));

  /**
   * ...and `notDelivered` must actually refund. An earlier version of this
   * check asserted only that the helper EXISTED and that both exits CALLED it —
   * both of which stayed true when the refund line was deleted from inside it,
   * so the mutant survived. Assert the body, not the shape.
   */
  const body = route.slice(route.indexOf("const notDelivered = () =>"), route.indexOf("const tooManyRetries"));
  check("...and notDelivered actually calls the refund",
    /refundSubmissionBudget\(identity\)/.test(body), body.slice(0, 160));
}

/* ══ 6d. Every outbound request refuses redirects ══════════════════════ */

console.log("\n6d · no outbound call follows redirects blindly (R6-10)");

/**
 * FINDING R6-10. `safeFetch` guarded the operator-configured store URL. The two
 * hard-coded hosts — Resend and Cloudflare — still used a bare `fetch`, which
 * follows redirects by default. Both requests carry a secret; a fixed hostname
 * is not a guarantee that the response is not a 3xx.
 *
 * The rule: a `fetch(` in src/ either goes through `safeFetch`, or is a
 * same-origin browser call, or declares an explicit `redirect:` policy.
 */
{
  const offenders = [];
  for (const f of sources.filter((x) => x.endsWith(".ts") || x.endsWith(".tsx"))) {
    const text = stripComments(read(f));
    for (const m of text.matchAll(/await fetch\(\s*("([^"]*)"|`([^`]*)`|[A-Za-z_$][\w$]*)/g)) {
      const target = m[2] ?? m[3] ?? m[1];
      if (typeof target === "string" && target.startsWith("/")) continue; // same-origin, from the browser
      const after = text.slice(m.index, m.index + 900);
      if (!/redirect:\s*"(manual|error)"/.test(after)) offenders.push(`${f}: fetch(${String(target).slice(0, 46)})`);
    }
  }
  check("every cross-origin fetch declares a redirect policy", offenders.length === 0, offenders.join(" | "));
  check("delivery still routes the store through safeFetch", /safeFetch\(/.test(delivery));
}

/* ══ 7. COMMITMENTS.md describes behaviour that exists ══════════════════ */

console.log("\n7 · COMMITMENTS.md claims match the code (R4-07)");

// The claim that consent IP recording is conditional on a trusted proxy — the
// code makes it conditional on that AND on the address being routable.
check(
  "COMMITMENTS states IP recording is conditional on TRUST_PROXY_HEADERS",
  /TRUST_PROXY_HEADERS/.test(commitments)
);
check(
  "the code makes IP recording conditional on TRUST_PROXY_HEADERS",
  /TRUST_PROXY_HEADERS && valid/.test(read("src/lib/request-identity.ts"))
);
// R4-07: a `statistics` flag was described that no longer exists.
const flagNames = [...config.matchAll(/^\s{2}(\w+):\s*(?:true|false)/gm)].map((m) => m[1]);
const claimedFlags = [...commitments.matchAll(/`flags\.(\w+)`/g)].map((m) => m[1]);
const phantomFlags = [...new Set(claimedFlags)].filter((f) => !flagNames.includes(f));
check("COMMITMENTS names no flag that does not exist", phantomFlags.length === 0, phantomFlags.join(", "));

console.log("");
console.log(failed ? "DOC CONSISTENCY: FAILURES" : "DOC CONSISTENCY: all checks passed");
process.exit(failed);
