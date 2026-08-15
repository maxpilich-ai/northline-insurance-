/**
 * API contract tests against a running production build.
 *
 * A local HTTP collector stands in for LEAD_STORE_URL, so the production
 * delivery path is genuinely exercised — a real transport, a real 2xx, a real
 * stored payload that can be inspected.
 */

import { identitySpace, namedIdentity } from "./identities.mjs";

// One caller stream for this suite, from its reserved block — see identities.mjs.
const nextCaller = identitySpace("api-contract");

const BASE = process.argv[2];
const COLLECTOR_PORT = 1; // records come from the shared collector file

import { readFileSync } from "node:fs";

/**
 * Records written by tests/collector.mjs.
 *
 * REQUIRED, NOT DEFAULTED (finding R3-L3). This used to fall back to a fixed
 * path in /tmp. Running a suite standalone — the invocation each file documents
 * in its own header — then silently validated whatever a previous run had left
 * behind: a 174-record file from nine hours earlier, built from different
 * source on a different port, produced seven confident failures that had
 * nothing to do with the code under test. Tests that are wrong for reasons
 * unrelated to the code get muted, and a muted test is worse than no test.
 * run-all.sh exports COLLECTOR_FILE; standalone runs must say which file they
 * mean.
 */
const RECORDS_FILE = process.env.COLLECTOR_FILE;
if (!RECORDS_FILE) {
  console.error(
    "\n  COLLECTOR_FILE is not set. This suite asserts on records the running\n" +
    "  server actually stored, so it must be told which collector file belongs\n" +
    "  to THIS run. Use `npm test`, or set COLLECTOR_FILE explicitly.\n"
  );
  process.exit(1);
}
function allRecords() {
  try { return JSON.parse(readFileSync(RECORDS_FILE, "utf8")); } catch { return []; }
}

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
};

const CONSUMER_VERSION = "consumer-tcpa-v1";
const AGENT_VERSION = "agent-tcpa-v1";

// Pull the canonical consent strings straight off the rendered pages so the
// test uses what a real browser would send, not a hand-copied string.
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();

/** Exactly what a visitor sees, taken from the DOM. */
async function consentTextFrom(path, checkboxId, walkWizard = false) {
  await page.goto(BASE + path, { waitUntil: "load" });
  if (walkWizard) {
    // The consent block is on step 5; it is not in the DOM until you get there.
    await page.getByText("People depend on my income").click();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByText("$500,000 – $1 million").click();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.fill("#age", "42");
    await page.getByText("Female", { exact: true }).click();
    await page.selectOption("#state", "Minnesota");
    await page.getByText("No", { exact: true }).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByText("Good", { exact: true }).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForSelector("#consent");
  }
  return page.evaluate((id) => {
    const input = document.getElementById(id);
    const label = input?.closest("label");
    if (!label) return null;
    const span = label.querySelector("span:last-of-type") ?? label;
    return span.textContent?.trim() ?? null;
  }, checkboxId);
}

async function post(payload, headers = {}) {
  const res = await fetch(BASE + "/api/lead", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: BASE + "/quote",
      "X-Forwarded-For": nextCaller(),
      ...headers,
    },
    body: JSON.stringify(payload),
  });
  // Give the collector a moment to write, so a test that inspects the stored
  // record is not racing the delivery it just triggered.
  await new Promise((r) => setTimeout(r, 60));
  return res;
}

const quoteBase = (over = {}) => ({
  kind: "quote", situation: "family", amount: "500k-1m", age: "42", sex: "female",
  state: "Minnesota", tobacco: "no", health: "good",
  name: "Test Person", email: "test@example.com", phone: "5125550123",
  contactTime: "any", notes: "", consent: true,
  consentVersion: CONSUMER_VERSION, consentText: "", company: "", turnstileToken: "",
  ...over,
});

console.log(`\n=== API contract · ${BASE} ===`);

const consumerText = await consentTextFrom("/quote", "consent", true);
const agentText = await consentTextFrom("/careers/apply", "a-consent");
check("consumer consent text scraped from /quote", Boolean(consumerText));
check("agent consent text scraped from /careers/apply", Boolean(agentText));
check("the two consent texts differ", consumerText !== agentText);
check("agent text mentions producer opportunities", /producer opportunities/.test(agentText ?? ""));
check("consumer text mentions life insurance", /about life insurance/.test(consumerText ?? ""));

// ── Happy path ─────────────────────────────────────────────────────────────
{
  const res = await post(quoteBase({ consentText: consumerText }));
  const json = await res.json().catch(() => ({}));
  check("valid quote accepted", res.status === 200, `got ${res.status} ${JSON.stringify(json)}`);
  check("response declares delivery mode", ["delivered", "simulated"].includes(json.delivery), JSON.stringify(json));
  if (COLLECTOR_PORT) {
    check("delivery reported as real (not simulated)", json.delivery === "delivered", JSON.stringify(json));
    check("store transport actually received the record", allRecords().length > 0);
    const rec = allRecords().at(-1);
    if (rec) {
      check("stored record has server-generated requestId", typeof rec.requestId === "string" && rec.requestId.length > 20);
      check("stored record has server receivedAt", typeof rec.receivedAt === "string" && !Number.isNaN(Date.parse(rec.receivedAt)));
      check("stored consent uses the SERVER text", rec.consent?.text === consumerText);
      check("stored consent version is consumer", rec.consent?.version === CONSUMER_VERSION);
      // The IP is recorded only when the deployment vouches for its forwarding
      // headers (TRUST_PROXY_HEADERS=1). This server does not, so the correct
      // stored value is null WITH a stated reason — never a spoofable header.
      check("stored consent states how much the IP is trusted",
        ["proxy", "observed", "unattributed"].includes(rec.consent?.ipTrust),
        String(rec.consent?.ipTrust));
      check("stored consent explains in words why the IP was or was not recorded",
        typeof rec.consent?.ipReason === "string" && rec.consent.ipReason.length > 10,
        String(rec.consent?.ipReason));
      // Written so it CANNOT pass vacuously: this server does not trust its
      // forwarding headers, so the trust level is asserted positively and the
      // null IP is required, rather than implied by an `!== "..."` that an
      // undefined field would satisfy. The previous revision of this check read
      // `rec.consent?.ipSource !== "untrusted" || ...` and went on passing after
      // the field was renamed — finding R2-11 in the suite itself.
      check("this untrusted-proxy server records NO ip, and says so",
        rec.consent?.ipTrust === "observed" && rec.consent?.ip === null,
        `ipTrust=${rec.consent?.ipTrust} ip=${JSON.stringify(rec.consent?.ip)}`);
      check("the source URL is stated as derived, not claimed",
        typeof rec.consent?.sourceUrlReason === "string" &&
          rec.consent.sourceUrlReason.includes("server"),
        String(rec.consent?.sourceUrlReason));
      check("the user agent is filed as UNVERIFIED, not as evidence",
        typeof rec.consent?.unverified?.userAgent === "string" && !("userAgent" in rec.consent));
      check("stored sourceUrl is the server's canonical form URL",
        rec.consent?.sourceUrl === `${BASE}/quote`, String(rec.consent?.sourceUrl));
      check("client echo fields stripped from stored payload", rec.fields.consentText === undefined && rec.fields.consentVersion === undefined);
      check("honeypot + turnstile stripped from stored payload", rec.fields.company === undefined && rec.fields.turnstileToken === undefined);
    }
  }
}

// ── Consent enforcement ────────────────────────────────────────────────────
{
  const r = await post(quoteBase({ consentText: consumerText, consentVersion: "tampered-v9" }));
  check("wrong consent VERSION rejected (409)", r.status === 409, `got ${r.status}`);
}
{
  const r = await post(quoteBase({ consentText: "I agree to something else entirely." }));
  check("wrong consent TEXT rejected (409)", r.status === 409, `got ${r.status}`);
}
{
  const r = await post(quoteBase({ consentText: consumerText, consent: false }));
  check("consent=false rejected (422)", r.status === 422, `got ${r.status}`);
}
{
  // The agent contract must not be accepted on a quote submission.
  const r = await post(quoteBase({ consentText: agentText, consentVersion: AGENT_VERSION }));
  check("agent consent contract rejected on a quote (409)", r.status === 409, `got ${r.status}`);
}
{
  // Client-supplied timestamp/sourceUrl must be ignored, not honoured.
  const before = allRecords().length;
  const r = await post(quoteBase({
    consentText: consumerText,
    submittedAt: "1999-01-01T00:00:00.000Z",
    sourceUrl: "https://evil.example.com/phish",
  }));
  const ok = r.status === 200;
  check("extra client fields do not break submission", ok, `got ${r.status}`);
  // Asserted unconditionally: skipping these when no record arrived would hide
  // the very failure they exist to catch (R2-11).
  check("the submission with extra fields produced a stored record",
    allRecords().length > before, `${before} -> ${allRecords().length}`);
  {
    const rec = allRecords().at(-1);
    check("client submittedAt ignored",
      typeof rec?.receivedAt === "string" && rec.receivedAt !== "1999-01-01T00:00:00.000Z",
      String(rec?.receivedAt));
    check("client sourceUrl ignored",
      typeof rec?.consent?.sourceUrl === "string" &&
        !rec.consent.sourceUrl.includes("evil.example.com"),
      String(rec?.consent?.sourceUrl));
  }
}
{
  const r = await post(quoteBase({ consentText: consumerText }), { Referer: "https://evil.example.com/x" });
  check("cross-origin Referer accepted but not trusted", r.status === 200, `got ${r.status}`);
  if (COLLECTOR_PORT) {
    const rec = allRecords().at(-1);
    // sourceUrl no longer comes from the Referer at all, so a cross-origin one
    // cannot influence it; it is filed under `unverified` and dropped there.
    check("cross-origin Referer cannot influence the stored source URL",
      rec?.consent?.sourceUrl === `${BASE}/quote`, String(rec?.consent?.sourceUrl));
    check("cross-origin Referer is not even kept as unverified",
      rec?.consent?.unverified?.clientReportedPage === null,
      String(rec?.consent?.unverified?.clientReportedPage));
  }
}

// ── Licensed-state enforcement ─────────────────────────────────────────────
{
  const r = await post(quoteBase({ consentText: consumerText, state: "Texas" }));
  check("unlicensed state rejected server-side (422)", r.status === 422, `got ${r.status}`);
}
{
  const r = await post(quoteBase({ consentText: consumerText, state: "minnesota" }));
  check("licensed state accepted case-insensitively", r.status === 200, `got ${r.status}`);
  if (COLLECTOR_PORT) check("state canonicalised on storage", allRecords().at(-1)?.fields.state === "Minnesota");
}

// ── Honeypot ───────────────────────────────────────────────────────────────
{
  const before = allRecords().length;
  const r = await post(quoteBase({ consentText: consumerText, company: "bot corp" }));
  check("honeypot returns 200 (learns nothing)", r.status === 200, `got ${r.status}`);
  check("honeypot submission NOT delivered", allRecords().length === before);
}

// ── Malformed input ────────────────────────────────────────────────────────
{
  const r = await fetch(BASE + "/api/lead", { method: "POST", headers: { "Content-Type": "text/plain", "X-Forwarded-For": namedIdentity("api-contract", 201) }, body: "x" });
  check("non-JSON content type rejected (415)", r.status === 415, `got ${r.status}`);
}
{
  const r = await fetch(BASE + "/api/lead", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": namedIdentity("api-contract", 202) }, body: "{oops" });
  check("malformed JSON rejected (400)", r.status === 400, `got ${r.status}`);
}
{
  const r = await post({ kind: "nonsense" });
  check("unknown kind rejected (422)", r.status === 422, `got ${r.status}`);
}
{
  const r = await post(quoteBase({ consentText: consumerText, email: "not-an-email" }));
  const body = await r.json().catch(() => ({}));
  check("invalid email rejected (422)", r.status === 422, `got ${r.status}`);
  check("error body leaks no submitted values", !JSON.stringify(body).includes("not-an-email"), JSON.stringify(body));
}
{
  const r = await post(quoteBase({ consentText: consumerText, notes: "x".repeat(5000) }));
  check("oversized field rejected (422)", r.status === 422, `got ${r.status}`);
}

// ── Agent form uses the agent contract ─────────────────────────────────────
{
  const agent = {
    kind: "agent", name: "Test Producer", email: "a@example.com", phone: "5125550123",
    states: "Minnesota", licensed: "licensed", licenseNumber: "", experience: "3-10",
    currentAffiliation: "", motivation: "Looking for broader carrier access than I have now.",
    availability: "immediately", resumeUrl: "", consent: true,
    consentVersion: AGENT_VERSION, consentText: agentText, company: "", turnstileToken: "",
  };
  const r = await post(agent, { Referer: BASE + "/careers/apply" });
  check("valid agent application accepted", r.status === 200, `got ${r.status}`);
  if (COLLECTOR_PORT) {
    const rec = allRecords().at(-1);
    check("agent record stores AGENT consent version", rec?.consent?.version === AGENT_VERSION);
    check("agent record stores AGENT consent text", rec?.consent?.text === agentText);
    // Written as "is a string AND differs" rather than a bare `!==`: with no
    // record at all, `undefined !== consumerText` is true and the check would
    // pass while proving nothing (finding R2-11).
    check("agent consent text is not the consumer text",
      typeof rec?.consent?.text === "string" && rec.consent.text !== consumerText,
      `stored text was ${JSON.stringify(rec?.consent?.text)?.slice(0, 60)}`);
  }
  const bad = { ...agent, consentVersion: CONSUMER_VERSION, consentText: consumerText };
  const r2 = await post(bad, { Referer: BASE + "/careers/apply" });
  check("consumer consent contract rejected on an agent application (409)", r2.status === 409, `got ${r2.status}`);
}

// ── Contact form carries no consent record ─────────────────────────────────
{
  const r = await post({
    kind: "contact", name: "Test Person", email: "t@example.com", phone: "",
    reason: "general", message: "Checking how this works.", company: "", turnstileToken: "",
  }, { Referer: BASE + "/contact" });
  check("valid contact message accepted", r.status === 200, `got ${r.status}`);
  {
    // "no consent block" must be asserted ON A REAL CONTACT RECORD. Written as
    // `at(-1)?.consent === undefined` alone it also passes when no record was
    // stored at all, which is the opposite of what it claims to prove (R2-11).
    const rec = allRecords().at(-1);
    check("contact record has NO consent block",
      rec?.kind === "contact" && !("consent" in rec),
      `last record kind=${rec?.kind} consent=${JSON.stringify(rec?.consent)}`);
  }
}
{
  const r = await post({ kind: "contact", name: "T", email: "t@example.com", reason: "agent", message: "hello there" });
  check("removed contact reason 'agent' rejected (422)", r.status === 422, `got ${r.status}`);
}

// ── Rate limiting ──────────────────────────────────────────────────────────
{
  const burstStatuses = [];
  for (let i = 0; i < 9; i++) {
    const r = await fetch(BASE + "/api/lead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: BASE + "/quote",
        "X-Forwarded-For": namedIdentity("api-contract", 203), // one fixed address
      },
      body: JSON.stringify(quoteBase({ consentText: consumerText })),
    });
    burstStatuses.push(r.status);
  }
  // R2-11: this used to read `check(..., sawLimit || true, ...)`, which could
  // never fail. The limiter's behaviour is covered properly in
  // tests/regression/rate-limit.mjs against dedicated servers; what belongs
  // HERE is the property this suite can actually assert — that a burst from one
  // identity is answered coherently and never with a server error.
  check(
    "a fixed-IP burst returns only well-formed statuses (never 5xx)",
    burstStatuses.every((s) => [200, 409, 422, 429].includes(s)),
    burstStatuses.join(" ")
  );
}

console.log(`\n  ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
