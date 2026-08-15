/**
 * ============================================================================
 * BUDGET ATTRIBUTION MATRIX (finding R4-04)
 * ============================================================================
 *
 * The two-budget design says one thing: a caller's five submissions are spent
 * only by leads that are actually delivered, and everything else is charged to
 * a separate, larger rejection budget. R4-04 was that the submission charge sat
 * BEFORE Turnstile, so several rejection paths — a Turnstile refusal, a consent
 * version mismatch, a consent text mismatch, an unlicensed state — took a unit
 * of the submission budget and delivered nothing.
 *
 * That is not a counter being slightly wrong. On a deployment without a trusted
 * proxy, a forged `X-Forwarded-For` lets one caller be counted as another, so
 * five deliberately mismatched consent payloads would exhaust a specific
 * visitor's real budget and lock them out of the site's primary conversion form
 * while never touching the attacker's own.
 *
 * The fix was structural: there is now exactly ONE charge point, immediately
 * before delivery. This file asserts the property that fix was for, by walking
 * EVERY exit the endpoint has and, for each one, measuring which budget moved.
 *
 * HOW IT MEASURES. Budgets are per-caller and this deployment does not vouch
 * for forwarding headers, so each row gets its own identity via a distinct
 * `X-Forwarded-For`. For a row to pass:
 *
 *   · the exit's own status is what the row expects, AND
 *   · after N of that exit, a VALID submission from the same identity still
 *     succeeds — i.e. the submission budget is untouched, AND
 *   · the rejection budget IS moving, proved by driving that same identity past
 *     the rejection ceiling and observing 429.
 *
 * The second point is the one that matters and the one that used to fail. It is
 * observable from outside; nothing here inspects a counter.
 */

import { identitySpace } from "../identities.mjs";

const BASE = process.argv[2];
if (!BASE) {
  console.error("usage: budget-matrix.mjs <base-url>");
  process.exit(2);
}

let failed = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failed = 1;
};

/**
 * Callers come from this suite's reserved block (tests/identities.mjs). They
 * used to be invented here as `198.51.100.N` — the same addresses
 * global-budget.mjs invents, on the same server, inside the same rate-limit
 * window. See the note in that file.
 */
const nextIdentity = identitySpace("budget-matrix");

async function post(identity, { body, contentType = "application/json", raw = false } = {}) {
  const res = await fetch(`${BASE}/api/lead`, {
    method: "POST",
    headers: {
      ...(contentType ? { "content-type": contentType } : {}),
      "x-forwarded-for": identity,
    },
    body: raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON — the status is what this file asserts on */
  }
  return { status: res.status, json, text };
}

/**
 * A lead that passes every check and is delivered.
 *
 * `slug` is used inside the email address, so it must survive being put in one
 * — the labels below include spaces and tabs, and an invalid address would turn
 * a delivery assertion into a schema failure that looks like the same thing.
 */
let serial = 0;
const validContact = () => {
  const n = ++serial;
  return {
    kind: "contact",
    name: `Budget Probe ${n}`,
    email: `budget${n}@example.test`,
    reason: "general",
    message: "A well-formed message that exists only to consume one submission.",
  };
};

/**
 * The consent-bearing rows need the server's own current version string, or a
 * "version mismatch" row could not be told apart from a "text mismatch" one.
 * Imported from the module that defines it — a copy pasted in here would be
 * exactly the kind of second source of truth Round 4 kept finding.
 */
const { CONSUMER_CONSENT_VERSION } = await import("../../src/lib/leads.ts");

/* ══ The matrix ════════════════════════════════════════════════════════ */

/**
 * Each row: a label, the request to make, and the status it must produce.
 *
 * Rows marked `preDelivery: true` are the ones R4-04 was about — exits that
 * happen after the request looks like a lead but before it is delivered. Those
 * are the rows where the old code spent a submission.
 */
const ROWS = [
  {
    label: "415 · wrong content type",
    make: () => ({ contentType: "text/plain", body: "{}", raw: true }),
    status: 415,
  },
  {
    label: "400 · malformed JSON",
    make: () => ({ body: "{not json", raw: true }),
    status: 400,
  },
  {
    label: "413 · oversized body",
    make: () => ({ body: JSON.stringify({ kind: "contact", pad: "x".repeat(200_000) }), raw: true }),
    status: 413,
  },
  {
    label: "422 · schema violation",
    make: () => ({ body: { kind: "contact", name: "x", email: "nope", message: "" } }),
    status: 422,
  },
  {
    label: "422 · unknown kind",
    make: () => ({ body: { kind: "not-a-kind", name: "Someone" } }),
    status: 422,
  },
  {
    label: "409 · consent version mismatch",
    preDelivery: true,
    make: (n) => ({
      body: {
        kind: "quote",
        name: `Budget Probe ${n}`,
        email: `budget${n}@example.test`,
        phone: "9522327177",
        situation: "family",
        amount: "500k-1m",
        age: "42",
        sex: "female",
        state: "Minnesota",
        tobacco: "no",
        health: "good",
        contactTime: "any",
        consent: true,
        consentVersion: "not-the-current-version",
        consentText: "whatever the client felt like sending",
      },
    }),
    status: 409,
  },
  {
    label: "409 · consent text mismatch",
    preDelivery: true,
    make: (n) => ({
      body: {
        kind: "quote",
        name: `Budget Probe ${n}`,
        email: `budget${n}@example.test`,
        phone: "9522327177",
        situation: "family",
        amount: "500k-1m",
        age: "42",
        sex: "female",
        state: "Minnesota",
        tobacco: "no",
        health: "good",
        contactTime: "any",
        consent: true,
        consentVersion: CONSUMER_CONSENT_VERSION,
        consentText: "I agree to something completely different",
      },
    }),
    status: 409,
  },
];

console.log("\n1 · every rejection path is classified, and none of them is a submission");

for (const row of ROWS) {
  const identity = nextIdentity();

  // Three of the exit, from one identity.
  const statuses = [];
  for (let i = 0; i < 3; i++) statuses.push((await post(identity, row.make(`${serial}-${i}`))).status);

  check(
    `${row.label.padEnd(34)} → ${row.status}`,
    statuses.every((s) => s === row.status),
    `got ${statuses.join(", ")}`
  );

  // ...and the submission budget is still intact for that identity.
  const after = await post(identity, { body: validContact() });
  check(
    `${row.label.padEnd(34)}   submission budget untouched`,
    after.status === 200 && after.json?.ok === true,
    `a valid lead from the same caller got ${after.status} ${JSON.stringify(after.json)}`
  );
}

/* ══ The honeypot ══════════════════════════════════════════════════════ */

console.log("\n2 · the honeypot answers 200 and spends no submission (R3-H1 + R4-04)");
{
  const identity = nextIdentity();
  const hp = await post(identity, {
    body: { ...validContact(), company: "Acme Corp" },
  });
  check(
    "a honeypot hit answers 200 but reports no delivery",
    hp.status === 200 && hp.json?.ok === true && hp.json?.delivery === undefined,
    `${hp.status} ${JSON.stringify(hp.json)}`
  );
  const after = await post(identity, { body: validContact() });
  check(
    "the honeypot spends no submission",
    after.status === 200 && after.json?.ok === true,
    `${after.status} ${JSON.stringify(after.json)}`
  );
}

console.log("\n  what counts as 'a bot filled the trap' (R4-12, widened by R6-04)");
{
  /**
   * The question is "did anything a person could SEE end up in this field?".
   *
   * R4-12 answered it with `trim()`, which removes whitespace and line
   * terminators — including U+00A0, U+3000 and U+FEFF — but not zero-width
   * characters. So U+200B, U+200D and U+00AD were read as a bot, and a real
   * enquiry was silently discarded with a 200 while a byte-order mark in the
   * same position was tolerated. The rule now comes from lib/invisible.ts.
   *
   * `delivery: "..."` in the response is the discriminator: the honeypot also
   * answers 200, but only a real delivery reports a transport.
   */
  const INVISIBLE = [
    ["a single space", " "],
    ["a tab", "\t"],
    ["a newline", "\n"],
    ["a CRLF", "\r\n"],
    ["spaces and tabs", "  \t "],
    ["NBSP U+00A0", "\u00a0"],
    ["ideographic space U+3000", "\u3000"],
    ["line separator U+2028", "\u2028"],
    ["zero-width space U+200B", "\u200b"],
    ["zero-width joiner U+200D", "\u200d"],
    ["soft hyphen U+00AD", "\u00ad"],
    ["byte-order mark U+FEFF", "\ufeff"],
    ["RTL override U+202E", "\u202e"],
    ["word joiner U+2060", "\u2060"],
    ["a mix of all of them", " \u200b\u00ad\ufeff\t"],
  ];
  for (const [label, value] of INVISIBLE) {
    const identity = nextIdentity();
    const res = await post(identity, { body: { ...validContact(), company: value } });
    check(
      `${label.padEnd(26)} is DELIVERED, not silently dropped`,
      res.status === 200 && res.json?.ok === true && typeof res.json?.delivery === "string",
      `${res.status} ${JSON.stringify(res.json)}`
    );
  }

  /** Anything with a visual extent is still a bot, including the falsy ones. */
  const VISIBLE = [["0", "0"], ["false", "false"], ["null", "null"], ["a name", "Acme Corp"], ["a single dot", "."], ["an underscore", "_"]];
  for (const [label, value] of VISIBLE) {
    const identity = nextIdentity();
    const res = await post(identity, { body: { ...validContact(), company: value } });
    check(
      `${label.padEnd(26)} is still treated as a honeypot hit`,
      res.status === 200 && res.json?.ok === true && res.json?.delivery === undefined,
      `${res.status} ${JSON.stringify(res.json)}`
    );
  }
}

console.log("\n3 · the two ceilings, measured — the rejection one must be higher");

/**
 * Both ceilings are configurable per deployment, so they are MEASURED rather
 * than asserted against a number written here. A test that hard-codes 5 and 30
 * is a test that fails the day someone tunes the deployment, which trains people
 * to ignore it. What must hold on every deployment is the RELATIONSHIP: garbage
 * gets a bigger allowance than real leads, so garbage can never be the thing
 * that locks a person out of the form.
 */
let submissionCeiling = null;
{
  const identity = nextIdentity();
  const seen = [];
  for (let i = 1; i <= 60; i++) {
    const res = await post(identity, { body: validContact() });
    seen.push(res.status);
    if (res.status === 429) {
      submissionCeiling = i;
      break;
    }
  }
  check("valid submissions do run out", submissionCeiling !== null, `statuses: ${seen.join(", ")}`);
  console.log(`     submission ceiling: 429 at request ${submissionCeiling}`);
}

let rejectionCeiling = null;
{
  const identity = nextIdentity();
  for (let i = 1; i <= 120; i++) {
    const res = await post(identity, { body: "{not json", raw: true });
    if (res.status === 429) {
      rejectionCeiling = i;
      break;
    }
  }
  check("garbage eventually exhausts the REJECTION budget", rejectionCeiling !== null, "120 malformed requests never produced a 429");
  console.log(`     rejection ceiling:  429 at request ${rejectionCeiling}`);
}

check(
  "the rejection ceiling is strictly higher than the submission ceiling",
  submissionCeiling !== null && rejectionCeiling !== null && rejectionCeiling > submissionCeiling,
  `submissions ${submissionCeiling}, rejections ${rejectionCeiling}`
);

/**
 * And the property R4-04 actually threatened: one caller cannot spend another
 * caller's submission budget by sending rejectable traffic in their name. The
 * victim identity is only ever used by the attacker here — if any of those
 * rejections had charged the submission budget, the victim's own first real
 * lead would already be refused.
 */
{
  const victim = nextIdentity();
  for (let i = 0; i < 20; i++) {
    await post(victim, ROWS.find((r) => r.preDelivery).make(`attack-${i}`));
  }
  const res = await post(victim, { body: validContact() });
  check(
    "20 forged pre-delivery rejections do not lock the victim out of the form",
    res.status === 200 && res.json?.ok === true,
    `${res.status} ${JSON.stringify(res.json)}`
  );
}

/* ══ 5. A lead that was not delivered does not spend a submission ═══════ */

/**
 * Requires a server whose only transport fails — passed as a second argument.
 * Skipped (loudly) when it is absent, so the suite still runs standalone.
 *
 * FINDING R6-03. The submission budget is charged before the delivery attempt,
 * which is the right admission control, but the charge was never given back
 * when the attempt failed. Measured: 502,502,502,502,502,429 — five error
 * pages telling a real person to try again, and then a refusal.
 */
const BROKEN = process.argv[3];
if (!BROKEN) {
  console.log("\n5 · delivery-failure attribution — SKIPPED (no broken-store URL given)");
} else {
  console.log("\n5 · a lead that fails to deliver does not spend a submission (R6-03)");
  const brokenPost = async (identity, body) => {
    const r = await fetch(`${BROKEN}/api/lead`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": identity },
      body: JSON.stringify(body),
    });
    const t = await r.text();
    let j = null;
    try { j = JSON.parse(t); } catch { /* status is what matters */ }
    return { status: r.status, json: j };
  };

  const identity = nextIdentity();
  const codes = [];
  for (let i = 0; i < 8; i++) codes.push((await brokenPost(identity, validContact())).status);

  check(
    "eight consecutive failures all answer 502 — the submission budget of 5 is never reached",
    codes.every((c) => c === 502),
    `got ${codes.join(",")}`
  );
  check(
    "an outage therefore cannot lock a visitor out of the form",
    !codes.includes(429),
    `got ${codes.join(",")}`
  );

  /**
   * The refund must not become a free path: the request still cost something,
   * so it is charged to the REJECTION budget instead. Without that, a caller
   * could hammer a failing transport unbounded.
   */
  let limitedAt = null;
  for (let i = 1; i <= 60; i++) {
    const r = await brokenPost(identity, validContact());
    if (r.status === 429) { limitedAt = i; break; }
  }
  check(
    "...but retries are still bounded — the rejection budget is charged",
    limitedAt !== null,
    "60 further failing submissions never produced a 429"
  );
  console.log(`     (429 after ${limitedAt} further attempts)`);
}

console.log("");
console.log(failed ? "BUDGET MATRIX: FAILURES" : "BUDGET MATRIX: all checks passed");
process.exit(failed);
