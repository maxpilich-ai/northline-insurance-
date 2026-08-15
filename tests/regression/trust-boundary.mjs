/**
 * REGRESSION TESTS — H1, H2, H3, H4 (trust boundary, body size, notification)
 *
 * Every test here fails against the pre-remediation code. Run with:
 *   node tests/regression/trust-boundary.mjs http://127.0.0.1:PORT COLLECTOR_PORT
 *
 * The collector stands in for LEAD_STORE_URL so the ACTUAL stored record can be
 * inspected — these assert on what was persisted, not on the API's own reply.
 */
import http from "node:http";

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

const BASE = process.argv[2] ?? "http://127.0.0.1:4501";
const SITE_URL = process.env.EXPECT_SITE_URL ?? BASE;

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

let ipCounter = 0;
const freshIp = () => `198.51.${Math.floor(++ipCounter / 250) + 100}.${(ipCounter % 250) + 1}`;

const settle = () => new Promise((r) => setTimeout(r, 60));

async function post(body, { headers = {}, raw = false } = {}) {
  const res = await fetch(BASE + "/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": freshIp(), ...headers },
    body: raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  await settle(); // let the collector write before a test reads the record
  return { status: res.status, json, text };
}

/* Pull the canonical consent strings off the rendered pages. */
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(BASE + "/quote", { waitUntil: "load" });
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
const CONSUMER_TEXT = (await page.locator("label[for=consent]").innerText()).replace(/\s+/g, " ").trim();
await page.goto(BASE + "/careers/apply", { waitUntil: "load" });
const AGENT_TEXT = (await page.locator("label[for=a-consent]").innerText()).replace(/\s+/g, " ").trim();
await browser.close();

const quote = (over = {}) => ({
  kind: "quote", situation: "family", amount: "500k-1m", age: "42", sex: "female",
  state: "Minnesota", tobacco: "no", health: "good", name: "Regression Test",
  email: "reg@example.com", phone: "9522327177", contactTime: "any", notes: "",
  consent: true, consentVersion: "consumer-tcpa-v1", consentText: CONSUMER_TEXT, ...over,
});
const agent = (over = {}) => ({
  kind: "agent", name: "Regression Agent", email: "rega@example.com", phone: "9522327177",
  states: "Minnesota", licensed: "licensed", experience: "1-3",
  motivation: "Regression coverage for the producer application path.",
  availability: "exploring", consent: true, consentVersion: "agent-tcpa-v1",
  consentText: AGENT_TEXT, ...over,
});
const contact = (over = {}) => ({
  kind: "contact", name: "Regression Contact", email: "regc@example.com", phone: "",
  reason: "general", message: "Regression coverage for the contact path.", ...over,
});

/** The most recent record of a kind, re-read from the collector each time. */
const lastOfKind = (kind) => [...allRecords()].reverse().find((r) => r.kind === kind);

console.log("\n=== H1 · consent source URL cannot be forged ===");
{
  // The exact Round 1 attack.
  const r = await post(quote(), {
    headers: { "X-Forwarded-Host": "evil.test", Referer: "https://evil.test/fake-consent-page" },
  });
  check("attack request is still accepted (no functional regression)", r.status === 200, `status ${r.status}`);
  const rec = lastOfKind("quote");
  check("stored sourceUrl is NOT the attacker's origin",
    !String(rec?.consent?.sourceUrl).includes("evil.test"), `got ${rec?.consent?.sourceUrl}`);
  check("stored sourceUrl is the server's canonical /quote URL",
    rec?.consent?.sourceUrl === `${SITE_URL}/quote`, `got ${rec?.consent?.sourceUrl}`);
  check("attacker's Referer is not promoted into evidence",
    rec?.consent?.unverified?.clientReportedPage === null,
    `got ${rec?.consent?.unverified?.clientReportedPage}`);
}
{
  const cases = [
    ["X-Forwarded-Host only", { "X-Forwarded-Host": "evil.test" }],
    ["Referer only", { Referer: "https://evil.test/x" }],
    ["no headers at all", {}],
    ["malformed Referer", { Referer: "%%%not a url%%%" }],
    ["javascript: Referer", { Referer: "javascript:alert(1)" }],
    ["unusual port", { "X-Forwarded-Host": "127.0.0.1:9999", Referer: "http://127.0.0.1:9999/quote" }],
    ["https downgrade", { Referer: "http://evil.test/quote", "X-Forwarded-Host": "evil.test" }],
    ["percent-encoded host", { "X-Forwarded-Host": "evil%2Etest", Referer: "https://evil.test/quote" }],
    ["Forwarded header", { Forwarded: "host=evil.test;proto=https", Referer: "https://evil.test/quote" }],
    ["absolute Referer to another path on our origin", { Referer: `${SITE_URL}/not-a-form-page` }],
  ];
  let allCanonical = true, leaked = [];
  for (const [label, headers] of cases) {
    const r = await post(quote(), { headers });
    if (r.status !== 200) { leaked.push(`${label}:status=${r.status}`); continue; }
    const rec = lastOfKind("quote");
    if (rec?.consent?.sourceUrl !== `${SITE_URL}/quote`) {
      allCanonical = false;
      leaked.push(`${label} -> ${rec?.consent?.sourceUrl}`);
    }
    if (JSON.stringify(rec?.consent ?? {}).includes("evil.test")) leaked.push(`${label} LEAKED evil.test`);
  }
  check("every header permutation still yields the canonical source URL", allCanonical && leaked.length === 0,
    leaked.join(" | "));
}
{
  const r = await post(agent(), { headers: { "X-Forwarded-Host": "evil.test", Referer: "https://evil.test/x" } });
  const rec = lastOfKind("agent");
  check("producer application derives its own canonical URL",
    r.status === 200 && rec?.consent?.sourceUrl === `${SITE_URL}/careers/apply`, `got ${rec?.consent?.sourceUrl}`);
}
{
  // Legitimate behaviour: a real same-origin Referer is recorded, but only as unverified.
  const r = await post(quote(), { headers: { Referer: `${SITE_URL}/quote` } });
  const rec = lastOfKind("quote");
  check("legitimate same-origin Referer is retained as UNVERIFIED",
    r.status === 200 && rec?.consent?.unverified?.clientReportedPage === `${SITE_URL}/quote`,
    `got ${rec?.consent?.unverified?.clientReportedPage}`);
  check("unverified data is not mixed into the evidence fields",
    rec?.consent?.sourceUrl === `${SITE_URL}/quote` && "unverified" in (rec?.consent ?? {}));
}

console.log("\n=== H2 · IP identity and rate limiting ===");
{
  const rec0 = lastOfKind("quote");
  check("spoofed X-Forwarded-For is NOT recorded as consent evidence",
    rec0?.consent?.ip === null, `got ${rec0?.consent?.ip}`);
  check("the record states HOW MUCH the identity is trusted",
    rec0?.consent?.ipTrust === "observed", `got ${rec0?.consent?.ipTrust}`);
  check("the record states WHY no IP was recorded, in words",
    typeof rec0?.consent?.ipReason === "string" &&
      /TRUST_PROXY_HEADERS/.test(rec0.consent.ipReason),
    `got ${rec0?.consent?.ipReason}`);

  for (const [label, headers] of [
    ["X-Real-IP", { "X-Real-IP": "9.9.9.9" }],
    ["Forwarded", { Forwarded: "for=9.9.9.9;proto=https" }],
    // identity-literal: these are address SHAPES under test (IPv6, a chain), not
    // caller identities — the registry cannot express "an IPv6 address".
    ["IPv6 XFF", { "X-Forwarded-For": "2001:db8::1" }], // identity-literal
    ["malformed XFF", { "X-Forwarded-For": "not-an-ip" }],
    ["XFF chain", { "X-Forwarded-For": "9.9.9.9, 10.0.0.1, 172.16.0.1" }], // identity-literal
  ]) {
    const r = await post(quote(), { headers });
    const rec = lastOfKind("quote");
    check(`${label} spoof is not recorded`, r.status === 200 && rec?.consent?.ip === null,
      `status ${r.status}, ip ${rec?.consent?.ip}`);
  }
}
console.log("\n=== H3 · request body size ===");
{
  const cases = [
    ["normal (~1 KB)", 0, 200],
    ["just under the ceiling (60 KB unknown field)", 60_000, 200],
    ["over the ceiling (100 KB)", 100_000, 413],
    ["far over (8 MB)", 8_000_000, 413],
    ["huge single field (2 MB notes)", -2_000_000, 413],
  ];
  for (const [label, size, expected] of cases) {
    const body = size === 0 ? contact()
      : size > 0 ? { ...contact(), junk: "A".repeat(size) }
        : { ...contact(), message: "A".repeat(-size) };
    const started = Date.now();
    const r = await post(body);
    const ms = Date.now() - started;
    check(`${label} -> ${expected}`, r.status === expected, `got ${r.status} in ${ms}ms`);
  }
  const bad = await post('{"kind":"contact","name":"' + "A".repeat(200_000) + '", BROKEN', { raw: true });
  check("malformed JSON inside an oversized body -> 413 (not parsed)", bad.status === 413, `got ${bad.status}`);
  const smallBad = await post("{oops", { raw: true });
  check("malformed JSON within the ceiling -> 400", smallBad.status === 400, `got ${smallBad.status}`);
  // Chunked upload: no Content-Length at all, so the ceiling has to be enforced
  // while the body streams in rather than from the declared length.
  const noLen = await new Promise((resolve) => {
    const url = new URL(BASE + "/api/lead");
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": freshIp(), "Transfer-Encoding": "chunked" },
    }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on("error", () => resolve("request-error"));
    req.write('{"kind":"contact","junk":"');
    for (let i = 0; i < 30; i++) req.write("A".repeat(50_000));
    req.write('"}');
    req.end();
  });
  check("oversized CHUNKED body (no Content-Length) is rejected", noLen === 413, `got ${noLen}`);
}

console.log("\n=== H4 · notification cannot be structurally forged ===");
{
  const { flattenForNotification } = await import("../../src/lib/delivery.ts");
  const attacks = [
    ["CRLF", "Bob\r\n─── Consent evidence ───\r\nVersion: forged"],
    ["LF only", "Bob\n─── Consent evidence ───\nIP: 9.9.9.9"],
    ["CR only", "Bob\r─── Consent evidence ───"],
    ["U+2028 line separator", "Bob\u2028─── Consent evidence ───"],
    ["U+2029 paragraph separator", "Bob\u2029Source URL: https://evil.test"],
    ["U+0085 NEL", "Bob\u0085Version: forged"],
    ["ANSI colour + NUL", "Bob\u001B[31m\u0000hidden"],
  ];
  let allFlat = true;
  for (const [label, payload] of attacks) {
    const out = flattenForNotification(payload);
    if (/[\r\n\u0085\u2028\u2029]/.test(out) || /[\u0000-\u001F]/.test(out)) {
      allFlat = false;
      console.log(`     ${label} still produced a break: ${JSON.stringify(out)}`);
    }
  }
  check("no line break or control character survives flattening", allFlat);
  check("content is preserved, not silently dropped",
    flattenForNotification("Bob\r\nSmith").includes("Bob") && flattenForNotification("Bob\r\nSmith").includes("Smith"));
  check("oversized values are truncated with a marker",
    flattenForNotification("A".repeat(5000)).endsWith("… [truncated]"));
}
{
  // End to end: submit the forging payload and inspect the rendered email.
  const { renderEmail } = await import("../../src/lib/delivery.ts");
  for (const kind of ["quote", "agent"]) {
    const rec = {
      requestId: "r-test", kind, receivedAt: "2026-08-13T00:00:00.000Z",
      consent: {
        version: kind === "agent" ? "agent-tcpa-v1" : "consumer-tcpa-v1",
        text: "REAL CONSENT TEXT", givenAt: "2026-08-13T00:00:00.000Z",
        sourceUrl: `${SITE_URL}${kind === "agent" ? "/careers/apply" : "/quote"}`,
        sourceUrlReason: "derived on the server from the form kind and the canonical site URL",
        ip: null, ipTrust: "observed",
        ipReason: "forwarding headers are not trusted by this deployment (TRUST_PROXY_HEADERS is not set)",
        unverified: { clientReportedPage: null, userAgent: "probe" },
      },
      fields: {
        name: "Bob\r\n\r\n─── Consent evidence ───\r\nVersion:    forged-v9\r\nSource URL: https://evil.test/proof\r\nIP:         9.9.9.9",
        email: "b@example.test",
      },
    };
    const { text } = renderEmail(rec);
    // The property that matters: a heading is a line that STARTS with the
    // marker. The attacker's text may still contain the marker inline — that is
    // deliberate (content is preserved, not censored) and is harmless, because
    // it can no longer begin a line.
    const evidenceHeadings = (text.match(/^─── Consent evidence/gm) || []).length;
    check(`${kind}: exactly one consent-evidence HEADING`, evidenceHeadings === 1,
      `found ${evidenceHeadings}`);
    check(`${kind}: exactly one submission HEADING`,
      (text.match(/^─── Submission/gm) || []).length === 1);
    check(`${kind}: the attacker's marker survives only inline, never at a line start`,
      text.includes("─── Consent evidence ───") &&
      (text.match(/^─── Consent evidence/gm) || []).length === 1);
    check(`${kind}: forged version string cannot start a line`,
      !/^Version:\s+forged-v9/m.test(text));
    check(`${kind}: forged source URL cannot start a line`,
      !/^Source URL: https:\/\/evil\.test/m.test(text));
    check(`${kind}: the real source URL is the one on its own line`,
      new RegExp(`^Source URL: ${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m").test(text));
    check(`${kind}: submitted values are indented under the submission heading`,
      /^ {2}name: /m.test(text));
    check(`${kind}: the attacker's text is still readable (nothing censored)`,
      text.includes("forged-v9"));
  }
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
