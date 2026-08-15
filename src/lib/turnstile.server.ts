import { TURNSTILE_ENABLED } from "./turnstile";

/**
 * ============================================================================
 * TURNSTILE — THE SERVER HALF
 * ============================================================================
 *
 * WHY THIS FILE IS SEPARATE FROM `turnstile.ts`.
 *
 * `turnstile.ts` is imported by `components/forms/Turnstile.tsx`, which is a
 * `"use client"` component — so everything that file evaluates at module scope
 * is compiled into the browser bundle.
 *
 * The R6-02 fix originally put `TURNSTILE_INTENDED_BUT_INERT` there as a
 * module-scope constant. A constant cannot be tree-shaken away, so its
 * initialiser shipped to the client, and the string `TURNSTILE_SECRET_KEY`
 * appeared in a client chunk for the first time:
 *
 *     !function(e=...env){e.NEXT_PUBLIC_TURNSTILE_SITE_KEY||e.TURNSTILE_SECRET_KEY}()
 *
 * The VALUE was never exposed — `process.env` is an empty object in the browser
 * and Next inlines only `NEXT_PUBLIC_*` — so this was the name of a secret, not
 * a secret. But the repository's own security probe asserts that no secret NAME
 * reaches a client chunk, the pre-fix build had zero occurrences and the
 * post-fix build had one, and shipping dead server-only logic to every visitor
 * is worth avoiding on its own merits.
 *
 * So the server-only half lives here, in a module no client component imports,
 * and is exposed as a FUNCTION rather than a constant — a function is
 * tree-shakeable, so even an accidental future import from a client component
 * cannot drag the environment read into the bundle unless it is also called.
 */

/**
 * True when the runtime environment carries either Turnstile key.
 *
 * NOT the same question as `TURNSTILE_ENABLED`. That was inlined when the image
 * was built; this is what the container was given when it started. Build one
 * image and inject configuration per environment — the ordinary way a Next.js
 * application is deployed — and the two can disagree.
 */
export function turnstileKeysInRuntimeEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) || Boolean(env.TURNSTILE_SECRET_KEY);
}

/**
 * The deployment is incoherent: the running process was given Turnstile keys,
 * but the image it is running was built without them, so `TURNSTILE_ENABLED` is
 * false and NOTHING IS VERIFIED (finding R6-02).
 *
 * WHY THIS IS REFUSED RATHER THAN WARNED ABOUT. An operator who sets both keys
 * has stated an intention: this deployment should be protected. It is not. The
 * previous behaviour accepted submissions carrying no token at all while the
 * startup log said `turnstile: 'Turnstile enabled.'` — because the log read
 * `process.env` and the gate read the build-time constant. Measured: a POST
 * with no `turnstileToken` returned `200 {"delivery":"delivered"}`. A control
 * that reports itself active while being inert is the exact failure this
 * module's sibling says it exists to prevent, and it is worse than no control,
 * because it stops anyone looking further.
 *
 * The codebase already refuses in the mirror-image case (`turnstileSecret()`
 * throws when the flag is on and the secret has gone missing at runtime) and
 * when the canonical URL is unavailable in production. This applies the same
 * rule to the remaining direction, so all three incoherent states fail closed
 * instead of one of them failing open.
 *
 * The remedy for an operator who hits this is to rebuild with the keys present,
 * which is what `next.config.mjs` has always required.
 */
export function turnstileIntendedButInert(env: NodeJS.ProcessEnv = process.env): boolean {
  return !TURNSTILE_ENABLED && turnstileKeysInRuntimeEnv(env);
}

/**
 * Human-readable description of the configuration state, used by the build
 * check and by the API's startup log so the deployed state is never a guess.
 *
 * `buildEnabled` defaults to the build-time flag that actually gates
 * verification. Passing it explicitly is for the build check in
 * next.config.mjs, which runs before any flag exists, and for tests.
 *
 * FINDING R6-02: this used to answer purely from `env`, so it described the
 * operator's INTENT rather than the deployment's BEHAVIOUR. It now reports what
 * the request path will actually do.
 */
export function describeTurnstileConfig(
  env: NodeJS.ProcessEnv = process.env,
  buildEnabled: boolean = TURNSTILE_ENABLED
) {
  const site = Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const secret = Boolean(env.TURNSTILE_SECRET_KEY);

  // The dangerous state: keys in the environment, no gate in the build.
  if (!buildEnabled && (site || secret)) {
    return {
      ok: false,
      enabled: false,
      message:
        "INCOHERENT — Turnstile keys are present in the environment but this " +
        "image was BUILT without them, so no token is ever verified. " +
        "Submissions are refused. Rebuild with both keys set.",
    } as const;
  }

  if (buildEnabled) {
    // The build gate is on. `turnstileSecret()` refuses at request time if the
    // secret has since disappeared, so the only thing left to describe is
    // whether it is still there.
    return secret
      ? ({ ok: true, enabled: true, message: "Turnstile enabled." } as const)
      : ({
          ok: false,
          enabled: true,
          message:
            "Turnstile was enabled at build time but TURNSTILE_SECRET_KEY is " +
            "missing at runtime. Submissions are refused.",
        } as const);
  }

  if (!site && !secret)
    return {
      ok: true,
      enabled: false,
      message: "Turnstile not configured — honeypot and rate limiting only.",
    } as const;

  // Unreachable given the branches above; kept so the build-time caller in
  // next.config.mjs (which passes buildEnabled=false with one key set) still
  // gets the specific half-configured wording.
  return {
    ok: false,
    enabled: false,
    message: site
      ? "NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is missing. " +
        "The widget would render while the server verified nothing."
      : "TURNSTILE_SECRET_KEY is set but NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing. " +
        "The server would demand a token the browser never produces.",
  } as const;
}
