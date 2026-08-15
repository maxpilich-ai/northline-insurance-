/**
 * ============================================================================
 * CALLER IDENTITY SPACES — so two suites can never spend each other's budget
 * ============================================================================
 *
 * Rate limits are per-caller and per-minute, and several suites run against the
 * SAME server inside the same minute. A suite that invents its own
 * `X-Forwarded-For` addresses is therefore sharing a namespace with every other
 * suite, silently.
 *
 * That is not hypothetical. `budget-matrix.mjs` and `global-budget.mjs` both
 * chose `198.51.100.N`, both ran against the limit-configured server, and the
 * second one's "60 distinct callers are all served" assertion failed on
 * precisely one of the sixty — the one whose budget the first suite had already
 * spent. A failure that depends on test ORDER and on the wall clock is worse
 * than a plain failure: it looks like a real defect, it does not reproduce
 * alone, and the natural response is to stop believing the test.
 *
 * So the namespace is allocated here, once, and every suite asks for its own.
 * Adding a suite means adding a line to RESERVED — which will collide loudly at
 * startup if the block is already taken, rather than quietly at run time.
 *
 * The addresses are drawn from 198.51.100.0/24 and 203.0.113.0/24 (TEST-NET-2
 * and TEST-NET-3, RFC 5737) — reserved for documentation and examples, so they
 * cannot be confused with a real caller. Note that these are NOT recordable as
 * consent evidence (finding R4-18): they are counting keys, which is all a
 * rate-limit test needs. A suite that needs an address the server will RECORD
 * must use a publicly routable one and say so.
 */

/**
 * suite name → third octet. One /24-sixteenth each; 250 addresses per block is
 * far more than any suite here uses.
 */
const RESERVED = {
  "budget-matrix": "198.51.100",
  "global-budget": "203.0.113",
  "rate-limit": "198.18.10",
  "honeypot": "198.18.11",
  "trust-boundary": "198.18.12",
  "api-contract": "198.18.13",
  "form-flows": "198.18.14",
  "turnstile-ui": "198.18.15",
};

/**
 * Returns a generator of distinct caller addresses for one suite.
 *
 *   const nextCaller = identitySpace("budget-matrix");
 *   nextCaller();  // "198.51.100.1"
 */
export function identitySpace(suite) {
  const prefix = RESERVED[suite];
  if (!prefix) {
    throw new Error(
      `no identity space reserved for "${suite}" — add one to tests/identities.mjs ` +
        `rather than inventing addresses, or this suite will spend another suite's budget`
    );
  }
  let n = 0;
  return () => {
    // 1-200 for the stream, cycling. A suite that makes more than 200 requests
    // reuses its OWN addresses, which is its business; what this module
    // guarantees is that it never reuses another suite's.
    n = (n % 200) + 1;
    return `${prefix}.${n}`;
  };
}

/**
 * A stable address at a fixed slot in a suite's block.
 *
 * For suites that need NAMED callers — "the victim", "a bystander" — rather
 * than a stream of fresh ones.
 *
 * Slots are 201-254, which is deliberately DISJOINT from the 1-200 the
 * sequential generator cycles through. Without that split a long-running suite
 * would eventually wrap onto its own named victim and spend its budget, which
 * is the same class of bug as two suites sharing a range — just harder to see,
 * because it depends on how many requests the suite happened to make.
 */
export function namedIdentity(suite, slot) {
  const prefix = RESERVED[suite];
  if (!prefix) {
    throw new Error(`no identity space reserved for "${suite}" — add one to tests/identities.mjs`);
  }
  if (!Number.isInteger(slot) || slot < 201 || slot > 254) {
    throw new Error(
      `named slots are 201-254 (1-200 belong to the sequential stream), got ${slot}`
    );
  }
  return `${prefix}.${slot}`;
}

/** Every reserved prefix, for the collision check below. */
export const RESERVED_PREFIXES = Object.freeze({ ...RESERVED });

const seen = new Set();
for (const [suite, prefix] of Object.entries(RESERVED)) {
  if (seen.has(prefix)) {
    throw new Error(`two suites reserve ${prefix}; the second is "${suite}"`);
  }
  seen.add(prefix);
}
