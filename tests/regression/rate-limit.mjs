/**
 * REGRESSION TESTS — the rate limiter.
 *
 * This component has now produced a vulnerability in each direction it has been
 * changed, so it is tested from both sides at once:
 *
 *   Round 1 H2  rotating a forwarding header bypassed the per-caller bucket
 *   Round 1 M8  a shared "unknown" bucket let one visitor lock out everyone
 *   Round 2 R2-01  cheap invalid traffic exhausted a GLOBAL budget and returned
 *                  429 to every other visitor on the site
 *   Round 2 R2-02  a malformed forwarding header made the caller unattributable
 *                  and therefore exempt from per-caller limiting
 *
 * The properties asserted below are the ones that must hold simultaneously.
 *
 *   node tests/regression/rate-limit.mjs http://127.0.0.1:PORT <untrusted|trusted>
 */
import { namedIdentity } from "../identities.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:4802";
const MODE = process.argv[3] ?? "untrusted";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

const valid = (n) => ({
  kind: "contact", name: `Limiter Probe ${n}`, email: "lim@example.com", phone: "",
  reason: "general", message: "Rate limiter regression probe.",
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
/** The cheapest possible request: no body, no content-type. */
const junk = (headers = {}) =>
  fetch(BASE + "/api/lead", { method: "POST", headers }).then((r) => { r.text(); return r.status; });

// Addresses come from this suite's reserved block. They used to be picked
// here as 203.0.113.x — the same range global-budget.mjs and api-contract.mjs
// picked, on the same servers, inside the same rate-limit window. See
// tests/identities.mjs.
const VICTIM = { "X-Forwarded-For": namedIdentity("rate-limit", 240) };
const ATTACKER = { "X-Forwarded-For": namedIdentity("rate-limit", 254) };

/**
 * Each abuse probe group gets its OWN identity.
 *
 * The first version of this file ran all four groups from one identity (Next
 * synthesises an X-Forwarded-For, so omitting the header does not mean
 * "anonymous" — it means "the same bucket as everyone else omitting it"). The
 * later groups therefore started with their rejection budget already spent, and
 * assertions of the form "the first malformed request answers 400" failed for a
 * reason that had nothing to do with the property under test. Order-dependent
 * assertions are worse than no assertions: they fail without meaning, so they
 * get muted. Distinct identities make each group's first request genuinely its
 * first.
 */
const ABUSER = {
  empty: { "X-Forwarded-For": namedIdentity("rate-limit", 221) },
  malformed: { "X-Forwarded-For": namedIdentity("rate-limit", 222) },
  oversized: { "X-Forwarded-For": namedIdentity("rate-limit", 223) },
  badType: { "X-Forwarded-For": namedIdentity("rate-limit", 224) },
};

/* ════════════════════════════════════════════════════════════════════════
   R2-01 · cheap invalid traffic must not deny service to anyone else
   ════════════════════════════════════════════════════════════════════════ */
console.log(`\n=== R2-01 · invalid traffic must not consume the submission budget (${MODE}) ===`);
{
  const before = await post(valid("victim-before"), VICTIM);
  check("a legitimate visitor can submit before the attack", before !== 429, `status ${before}`);

  // 1. empty POSTs   2. malformed JSON   3. oversized bodies   4. bad content types
  const empties = [];
  for (let i = 0; i < 100; i++) empties.push(await junk(ABUSER.empty));
  const malformed = [];
  for (let i = 0; i < 100; i++) malformed.push(await post(null, ABUSER.malformed, "{not json"));
  const oversized = [];
  for (let i = 0; i < 100; i++) {
    // Genuinely oversized: let fetch set the length, so the server (not the
    // client) is the thing deciding to reject it.
    oversized.push(
      await post(null, ABUSER.oversized, JSON.stringify({ kind: "contact", x: "A".repeat(70_000) }))
    );
  }
  const badTypes = [];
  for (let i = 0; i < 100; i++)
    badTypes.push(await post(valid(i), { ...ABUSER.badType, "Content-Type": "text/plain" }));

  const after = await post(valid("victim-after"), VICTIM);
  check("400 legitimate-capacity-free abusive requests do NOT block a real visitor",
    after !== 429,
    `victim got ${after} after 100 empty + 100 malformed + 100 oversized + 100 wrong-content-type requests`);

  // Each abuser must be throttled on its OWN rejection budget — checked per
  // group, so "one of them happened to trip" cannot stand in for all four.
  const groups = [
    ["empty POSTs", empties], ["malformed JSON", malformed],
    ["oversized bodies", oversized], ["wrong content types", badTypes],
  ];
  for (const [label, codes] of groups) {
    check(`the ${label} caller is throttled on its own rejection budget`,
      codes.includes(429), `429s: ${codes.filter((s) => s === 429).length}/100`);
  }

  // Statuses before the ceiling must still be the correct rejection codes —
  // each group's own first request, on its own untouched budget.
  check("empty POSTs answer 415 before the rejection ceiling", empties[0] === 415, `first=${empties[0]}`);
  check("malformed JSON answers 400 before the ceiling", malformed[0] === 400, `first=${malformed[0]}`);
  check("oversized bodies answer 413 before the ceiling", oversized[0] === 413, `first=${oversized[0]}`);
  check("wrong content type answers 415 before the ceiling", badTypes[0] === 415, `first=${badTypes[0]}`);

  // A rejected request must never have consumed submission capacity: each
  // abuser, having burned its rejection budget on garbage, must still be able
  // to submit a genuine lead.
  const reformed = await post(valid("reformed-abuser"), ABUSER.malformed);
  check("an abuser's SUBMISSION budget survives its own garbage",
    reformed !== 429,
    `a caller that sent 100 malformed requests then one valid lead got ${reformed}`);
}

/* ════════════════════════════════════════════════════════════════════════
   R2-02 · a malformed identity must not get MORE capacity than a valid one
   ════════════════════════════════════════════════════════════════════════ */
console.log("\n=== R2-02 · identity cannot be dropped to escape limiting ===");
{
  /**
   * REACHABILITY CAVEAT, stated rather than hidden. Next synthesises an
   * `x-forwarded-for` from the socket, so over HTTP the "Forwarded only" and
   * "no headers at all" rows do NOT exercise the branches their labels name —
   * both arrive carrying an XFF of 127.0.0.1 and therefore share one bucket.
   * Their value here is the weaker property that neither is EXEMPT. The actual
   * branches are covered directly in regression/identity-unit.mjs, which calls
   * the resolver as a function and can construct header sets this transport
   * cannot produce.
   */
  const shapes = [
    ["valid IPv4", { "X-Forwarded-For": namedIdentity("rate-limit", 211) }],
    ["malformed value", { "X-Forwarded-For": "not-an-ip" }],
    ["empty value", { "X-Forwarded-For": "" }],
    // identity-literal: malformed strings ARE the subject here — the point is
    // that an unparseable header is still counted, so they cannot come from a
    // registry of valid addresses.
    ["malformed IPv4", { "X-Forwarded-For": "999.999.999.999" }], // identity-literal
    ["malformed IPv6", { "X-Forwarded-For": "2001:db8:::::1" }], // identity-literal
    ["X-Real-IP only", { "X-Real-IP": namedIdentity("rate-limit", 212) }],
    ["Forwarded only", { Forwarded: `for=${namedIdentity("rate-limit", 213)};proto=https` }],
    ["multiple addresses", { "X-Forwarded-For": `${namedIdentity("rate-limit", 214)}, 10.0.0.1, 172.16.0.1` }],
    ["no headers at all", {}],
  ];
  const results = [];
  for (const [label, headers] of shapes) {
    const codes = [];
    for (let i = 0; i < 12; i++) codes.push(await post(valid(`${label}-${i}`), headers));
    const accepted = codes.filter((s) => s !== 429).length;
    results.push({ label, accepted, codes });
    console.log(`     ${label.padEnd(20)} accepted ${String(accepted).padStart(2)}/12  ${codes.join(" ")}`);
  }
  const valid4 = results.find((r) => r.label === "valid IPv4").accepted;
  const worst = Math.max(...results.map((r) => r.accepted));
  check("no identity shape gets more submissions than a valid IP",
    worst <= valid4,
    `valid IPv4 allowed ${valid4}; the most permissive shape allowed ${worst}`);
  check("every identity shape is limited (none is exempt)",
    results.every((r) => r.codes.includes(429)),
    results.filter((r) => !r.codes.includes(429)).map((r) => r.label).join(", ") || "all limited");
}

/* ════════════════════════════════════════════════════════════════════════
   M8 · one caller must never lock out another
   ════════════════════════════════════════════════════════════════════════ */
console.log("\n=== M8 · isolation between callers ===");
{
  // Exhaust one identity completely.
  for (let i = 0; i < 15; i++) await post(valid(`noisy-${i}`), ATTACKER);
  const noisy = await post(valid("noisy-final"), ATTACKER);
  const other = await post(valid("bystander"), { "X-Forwarded-For": namedIdentity("rate-limit", 215) });
  check("the noisy caller is throttled", noisy === 429, `status ${noisy}`);
  check("a different caller is unaffected", other !== 429, `status ${other}`);
}

/* ════════════════════════════════════════════════════════════════════════
   Concurrency · counters must not be raced past
   ════════════════════════════════════════════════════════════════════════ */
console.log("\n=== concurrency ===");
{
  const key = { "X-Forwarded-For": namedIdentity("rate-limit", 201) };
  const burst = await Promise.all(Array.from({ length: 25 }, (_, i) => post(valid(`conc-${i}`), key)));
  const accepted = burst.filter((s) => s !== 429).length;
  check("a concurrent burst from one identity is still bounded", burst.includes(429),
    `${accepted}/25 accepted`);
  const fresh = await post(valid("fresh-after-burst"), { "X-Forwarded-For": namedIdentity("rate-limit", 216) });
  check("a fresh identity still gets through after someone else's burst", fresh !== 429, `status ${fresh}`);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
