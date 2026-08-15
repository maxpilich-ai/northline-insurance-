/**
 * ============================================================================
 * TURNSTILE CONFIGURATION COHERENCE (finding R6-02)
 * ============================================================================
 *
 * `NEXT_PUBLIC_TURNSTILE_ENABLED` is inlined when the image is BUILT.
 * `process.env` is what the container was handed when it STARTED. Build one
 * image and inject configuration per environment — the ordinary way a Next.js
 * app is deployed — and the two can disagree.
 *
 * They did. `describeTurnstileConfig()` answered from `process.env` alone,
 * while the request path gated on the build-time flag. A deployment built
 * without keys and started with both produced:
 *
 *     [lead] configuration { turnstile: 'Turnstile enabled.', ... }
 *     POST /api/lead   (no token at all)  ->  200 {"ok":true,"delivery":"delivered"}
 *
 * The log asserted the control was on while nothing was verified. That is the
 * failure the module's own header says it exists to prevent.
 *
 * This asserts the function now describes BEHAVIOUR rather than INTENT, across
 * the whole matrix of (build flag) x (runtime keys), and that the state which
 * used to fail open is the one that now fails closed.
 *
 *   node --import ./tests/ts-resolve.mjs --experimental-strip-types \
 *        tests/regression/turnstile-config-unit.mjs
 */
const { describeTurnstileConfig, turnstileKeysInRuntimeEnv, turnstileIntendedButInert } =
  await import("../../src/lib/turnstile.server.ts");

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

const SITE = "1x00000000000000000000AA";
const SECRET = "1x0000000000000000000000000000000AA";
const env = (site, secret) => ({
  ...(site ? { NEXT_PUBLIC_TURNSTILE_SITE_KEY: SITE } : {}),
  ...(secret ? { TURNSTILE_SECRET_KEY: SECRET } : {}),
});

console.log("\n=== the full (build flag) x (runtime keys) matrix ===");

/**
 * [buildEnabled, siteKeyAtRuntime, secretAtRuntime, expect.ok, expect.enabled, why]
 *
 * `ok` is the operator-facing verdict: false means "this deployment is
 * misconfigured and submissions are refused".
 */
const MATRIX = [
  [false, false, false, true,  false, "nothing configured anywhere — honeypot and rate limiting only"],
  [true,  true,  true,  true,  true,  "built with keys, running with keys — the working case"],

  // The state that used to report "Turnstile enabled." while verifying nothing.
  [false, true,  true,  false, false, "KEYS AT RUNTIME, NOT AT BUILD — the R6-02 state"],
  [false, true,  false, false, false, "site key injected at runtime only"],
  [false, false, true,  false, false, "secret injected at runtime only"],

  // The mirror image, already handled by turnstileSecret() throwing.
  [true,  true,  false, false, true,  "built enabled, secret removed at runtime"],
];

for (const [build, site, secret, wantOk, wantEnabled, why] of MATRIX) {
  const r = describeTurnstileConfig(env(site, secret), build);
  check(
    `build=${String(build).padEnd(5)} site=${String(site).padEnd(5)} secret=${String(secret).padEnd(5)} -> ok=${wantOk} enabled=${wantEnabled}  (${why})`,
    r.ok === wantOk && r.enabled === wantEnabled,
    `got ok=${r.ok} enabled=${r.enabled} :: ${r.message}`
  );
}

console.log("\n=== the dangerous state is never described as working ===");
{
  const r = describeTurnstileConfig(env(true, true), false);
  check("it is not reported as 'Turnstile enabled.'", r.message !== "Turnstile enabled.", r.message);
  check("it is flagged as not ok", r.ok === false);
  check("it does not claim to be enabled", r.enabled === false);
  check("the message says submissions are refused", /refused/i.test(r.message), r.message);
  check("the message tells the operator what to do", /rebuild/i.test(r.message), r.message);
}

console.log("\n=== the honest states still read honestly ===");
{
  const off = describeTurnstileConfig(env(false, false), false);
  check("nothing configured -> ok, not enabled", off.ok === true && off.enabled === false, off.message);
  check("...and says so plainly", /not configured/i.test(off.message), off.message);
  const on = describeTurnstileConfig(env(true, true), true);
  check("fully configured -> 'Turnstile enabled.'", on.message === "Turnstile enabled.", on.message);
}

console.log("\n=== turnstileKeysInRuntimeEnv ===");
{
  check("both keys -> true", turnstileKeysInRuntimeEnv(env(true, true)) === true);
  check("site only -> true", turnstileKeysInRuntimeEnv(env(true, false)) === true);
  check("secret only -> true", turnstileKeysInRuntimeEnv(env(false, true)) === true);
  check("neither -> false", turnstileKeysInRuntimeEnv(env(false, false)) === false);
  check("empty strings are not keys", turnstileKeysInRuntimeEnv({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET_KEY: "" }) === false);
}

console.log("\n=== the refusal predicate the request path actually calls ===");
{
  // TURNSTILE_ENABLED is false in this process (no build flag), so any runtime
  // key means "intended but inert".
  check("both keys at runtime -> inert", turnstileIntendedButInert(env(true, true)) === true);
  check("site key only -> inert", turnstileIntendedButInert(env(true, false)) === true);
  check("secret only -> inert", turnstileIntendedButInert(env(false, true)) === true);
  check("no keys -> not inert (the honest 'off' state)", turnstileIntendedButInert(env(false, false)) === false);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
