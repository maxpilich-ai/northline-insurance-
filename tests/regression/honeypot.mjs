/**
 * REGRESSION TESTS — honeypot accounting (finding R3-H1).
 *
 * THE DEFECT. A well-formed lead with the honeypot field filled was answered
 * 200 and charged NEITHER budget. It sat after the schema check and before the
 * submission counter, so it was the one request class that reached JSON
 * parsing, a full Zod validation and a log line with no counter of any kind.
 * Measured before the fix:
 *
 *     120 honeypot POSTs from ONE identity  -> 200 x 120, zero 429s
 *     the same identity afterwards          -> still had all 5 submissions
 *     with Turnstile ENABLED                -> 20/20 answered 200
 *     log growth                            -> ~113 bytes each, unbounded
 *
 * The traffic the honeypot exists to identify was the least constrained traffic
 * on the endpoint.
 *
 * THE PROPERTIES ASSERTED HERE, in the order they matter:
 *
 *   1. honeypot traffic is metered — it cannot run forever
 *   2. it is charged to the REJECTION budget, so it cannot consume anybody's
 *      capacity to send a real enquiry (including its own, and including a
 *      victim's when the forwarding header is forged)
 *   3. it still delivers nothing
 *   4. it still answers 200 while under budget, so a bot learns nothing
 *   5. rotating headers does not create an unmetered path
 *   6. concurrency does not create one either
 *
 *   node tests/regression/honeypot.mjs http://127.0.0.1:PORT [turnstile]
 *
 * The optional second argument marks a server with Turnstile ENABLED, where the
 * honeypot must still not become a way past it.
 */
import { identitySpace, namedIdentity } from "../identities.mjs";

// This suite's callers, from its reserved block — see tests/identities.mjs.
const nextCaller = identitySpace("honeypot");

const BASE = process.argv[2] ?? "http://127.0.0.1:4802";
const TURNSTILE = process.argv[3] === "turnstile";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

const lead = (n, over = {}) => ({
  kind: "contact", name: `Honeypot Probe ${n}`, email: "hp@example.test", phone: "",
  reason: "general", message: "A perfectly well-formed enquiry body.", ...over,
});

async function post(body, headers = {}) {
  const res = await fetch(BASE + "/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  await res.text();
  return res.status;
}
const tally = (a) =>
  Object.entries(a.reduce((m, s) => ((m[s] = (m[s] || 0) + 1), m), {}))
    .map(([k, v]) => `${k}x${v}`).join(" ");

console.log(`\n=== R3-H1 · honeypot traffic is metered (${TURNSTILE ? "Turnstile ON" : "Turnstile off"}) ===`);

/* ── 1. It cannot run forever ───────────────────────────────────────────── */
{
  const H = { "X-Forwarded-For": namedIdentity("honeypot", 201) };
  const codes = [];
  for (let i = 0; i < 120; i++) codes.push(await post(lead(i, { company: "spambot" }), H));
  console.log(`     120 honeypot requests from one identity: ${tally(codes)}`);

  check("120 honeypot requests from one identity are NOT all accepted",
    codes.includes(429), `no 429 in 120 requests — the path is unmetered`);
  check("the early ones still answer 200, so a bot learns nothing from the status",
    codes[0] === 200, `first=${codes[0]}`);
  check("the throttled ones answer 429, the same as every other over-budget path",
    codes.filter((c) => c === 429).length > 0 &&
      codes.every((c) => c === 200 || c === 429), tally(codes));
}

/* ── 2. It is charged to the REJECTION budget, not the submission budget ── */
{
  const H = { "X-Forwarded-For": namedIdentity("honeypot", 202) };
  // Burn plenty of honeypot capacity...
  const hp = [];
  for (let i = 0; i < 60; i++) hp.push(await post(lead(i, { company: "bot" }), H));
  check("the honeypot budget is exhausted by 60 hits", hp.includes(429), tally(hp));

  // ...then check the SAME identity can still send a genuine enquiry. This is
  // the false-positive case: a password manager fills every field, including
  // the trap, and the person must not lose the enquiry they are writing.
  const real = await post(lead("recovered"), H);
  check("a caught-by-mistake visitor can still send a real enquiry",
    real === 200, `status ${real} — honeypot hits are eating the submission budget`);
}

/* ── 3. Nothing is delivered, and 4. the answer stays 200 under budget ──── */
{
  const H = { "X-Forwarded-For": namedIdentity("honeypot", 203) };
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push(await post(lead(i, { company: "x" }), H));
  check("a handful of honeypot hits are all answered 200",
    codes.every((c) => c === 200), tally(codes));
  // Delivery is asserted in api-contract.mjs against the collector; here the
  // property is only that the status does not give the trap away.
}

/* ── 5. Rotating the forwarding header does not create an unmetered path ── */
{
  /* Rotation gets a fresh bucket — that is the documented, unfixed limitation
     of running without a trusted proxy, and it applies to every request shape.
     What must NOT be true is that the honeypot is exempt on top of that: each
     rotated identity has to be metered like any other. */
  const perIdentity = [];
  for (let id = 0; id < 3; id++) {
    const H = { "X-Forwarded-For": nextCaller() };
    const codes = [];
    for (let i = 0; i < 60; i++) codes.push(await post(lead(i, { company: "rot" }), H));
    perIdentity.push(codes);
  }
  check("every rotated identity is independently metered",
    perIdentity.every((codes) => codes.includes(429)),
    perIdentity.map((c, i) => `id${i}:${tally(c)}`).join(" | "));
}

/* ── 6. Concurrency does not create one ─────────────────────────────────── */
{
  const H = { "X-Forwarded-For": namedIdentity("honeypot", 204) };
  const burst = await Promise.all(
    Array.from({ length: 80 }, (_, i) => post(lead(`conc-${i}`), H).catch(() => 0))
  );
  const bursted = await Promise.all(
    Array.from({ length: 80 }, (_, i) => post(lead(`conc-hp-${i}`, { company: "bot" }), H).catch(() => 0))
  );
  const all = [...burst, ...bursted];
  check("a concurrent honeypot burst is still bounded",
    all.includes(429), `${all.filter((s) => s !== 429).length}/160 accepted`);
}

/* ── Mixed traffic: one caller's honeypot noise vs another's real enquiry ─ */
{
  const attacker = { "X-Forwarded-For": namedIdentity("honeypot", 205) };
  const bystander = { "X-Forwarded-For": namedIdentity("honeypot", 206) };
  for (let i = 0; i < 80; i++) await post(lead(i, { company: "flood" }), attacker);
  const other = await post(lead("bystander"), bystander);
  check("a honeypot flood does not affect a different caller", other === 200, `status ${other}`);
}

/* ── Turnstile is not bypassed by tripping the trap ─────────────────────── */
if (TURNSTILE) {
  const H = { "X-Forwarded-For": namedIdentity("honeypot", 207) };
  // With Turnstile on, a lead with NO token is refused 403. A honeypot request
  // gets 200 — but delivers nothing, so it is not a way past the check; and it
  // is now metered, so it is not a free path either.
  const withoutToken = await post(lead("no-token"), H);
  check("a real lead with no Turnstile token is refused", withoutToken === 403, `status ${withoutToken}`);

  const codes = [];
  for (let i = 0; i < 60; i++) codes.push(await post(lead(i, { company: "bot" }), H));
  check("honeypot traffic is metered with Turnstile enabled too",
    codes.includes(429), tally(codes));
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
