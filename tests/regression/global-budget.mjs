/**
 * REGRESSION TESTS — the optional global submission budget.
 *
 * R2-01 was a global counter that ANY caller could exhaust with garbage,
 * producing 429 for every other visitor on the site. The redesign keeps a
 * global counter only as an opt-in runaway guard with three properties that
 * this file pins down:
 *
 *   1. It is OFF unless an operator sets LEAD_RATE_LIMIT_GLOBAL.
 *   2. When on, only WELL-FORMED submissions charge it. No volume of malformed,
 *      oversized, wrong-content-type or empty requests can move it.
 *   3. When on, it still actually engages — otherwise property 2 would be
 *      trivially satisfied by a counter that never counts, and this suite would
 *      be incapable of failing (finding R2-11).
 *
 *   node tests/regression/global-budget.mjs http://127.0.0.1:PORT <off|N>
 */
import { identitySpace, namedIdentity } from "../identities.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:4804";
const LIMIT = process.argv[3] ?? "off";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

const valid = (n) => ({
  kind: "contact", name: `Global Probe ${n}`, email: "glob@example.com", phone: "",
  reason: "general", message: "Global budget regression probe.",
});

async function post(body, headers = {}, rawBody) {
  const res = await fetch(BASE + "/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: rawBody !== undefined ? rawBody : JSON.stringify(body),
  });
  await res.text();
  return res.status;
}

/**
 * A fresh identity per call, so the per-identity budget is never the cause.
 *
 * Drawn from this suite's RESERVED block rather than picked here. Both this
 * file and budget-matrix.mjs used to pick `198.51.100.N` independently, run
 * against the same server in the same minute, and quietly spend each other's
 * budgets — which showed up as exactly one of sixty "distinct" callers being
 * rate limited. See tests/identities.mjs.
 */
const nextAddress = identitySpace("global-budget");
const nextIdentity = () => ({ "X-Forwarded-For": nextAddress() });

console.log(`\n=== global submission budget (LEAD_RATE_LIMIT_GLOBAL=${LIMIT}) ===`);

if (LIMIT === "off") {
  /* Default configuration: no global gate at all. Many distinct callers, each
     well inside its own budget, must ALL get through. */
  const codes = [];
  for (let i = 0; i < 60; i++) codes.push(await post(valid(i), nextIdentity()));
  check("with no global limit configured, 60 distinct callers are all served",
    !codes.includes(429),
    `${codes.filter((s) => s === 429).length}/60 were rate limited`);
} else {
  const max = Number(LIMIT);

  /* ── Garbage must not move the global counter ────────────────────────── */
  const abuser = { "X-Forwarded-For": namedIdentity("global-budget", 254) };
  for (let i = 0; i < 50; i++) await post(null, abuser, "{not json");
  for (let i = 0; i < 50; i++) await post(valid(i), { ...abuser, "Content-Type": "text/plain" });
  for (let i = 0; i < 25; i++)
    await post(null, abuser, JSON.stringify({ kind: "contact", x: "A".repeat(70_000) }));
  for (let i = 0; i < 25; i++)
    await fetch(BASE + "/api/lead", { method: "POST", headers: abuser }).then((r) => r.text());

  const victim = await post(valid("victim"), nextIdentity());
  check("150 invalid requests do not consume ANY of the global budget",
    victim !== 429,
    `a fresh caller got ${victim} after 150 malformed/oversized/wrong-type/empty requests`);

  /* ── But the guard is real: valid submissions do charge it ───────────── */
  const codes = [];
  for (let i = 0; i < max + 6; i++) codes.push(await post(valid(`g-${i}`), nextIdentity()));
  check(`the global guard engages once ${max} valid submissions are exceeded`,
    codes.includes(429),
    `${codes.filter((s) => s === 429).length} of ${codes.length} were limited — the guard never fired, so the test above proves nothing`);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
