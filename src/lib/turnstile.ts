/**
 * ============================================================================
 * CLOUDFLARE TURNSTILE CONFIGURATION
 * ============================================================================
 *
 * Turnstile is enabled only when BOTH keys are present.
 *
 * The earlier arrangement had the browser decide from the public site key and
 * the server decide from the secret. Those are two independent switches, so a
 * deployment with only the public key produced a widget that looked like it was
 * protecting the form while the server verified nothing — a security control
 * that is visible but absent, which is worse than no control at all, because it
 * stops anyone looking further.
 *
 * Now: one switch. `NEXT_PUBLIC_TURNSTILE_ENABLED` is derived at build time in
 * next.config.mjs from the presence of both keys, and the build FAILS if
 * exactly one is set. The browser and the server read the same flag.
 */

/** The public site key. Empty when Turnstile is not configured. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * Set by next.config.mjs, and only when both keys were present at build time.
 * Safe to read on the client.
 */
export const TURNSTILE_ENABLED = process.env.NEXT_PUBLIC_TURNSTILE_ENABLED === "1";

/**
 * Server-side only. Returns the secret when the configuration is coherent.
 *
 * Throws if the flag says enabled but the secret is missing at runtime — a
 * state the build check should already have prevented, so reaching it means
 * the environment changed after build and submissions must stop rather than
 * silently proceed unverified.
 */
export function turnstileSecret(): string {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? "";
  if (TURNSTILE_ENABLED && !secret) {
    throw new Error(
      "Turnstile is enabled but TURNSTILE_SECRET_KEY is missing at runtime. " +
        "Refusing to accept submissions unverified."
    );
  }
  return secret;
}

/**
 * THE SERVER-ONLY HALF LIVES IN `turnstile.server.ts`.
 *
 * This module is imported by a `"use client"` component, so anything evaluated
 * here at module scope is compiled into the browser bundle. The R6-02
 * configuration-coherence logic reads `TURNSTILE_SECRET_KEY` from the runtime
 * environment; as a module-scope constant it put that name into a client chunk
 * for the first time in the project's history. It is a function in a
 * server-only module now — see the note at the top of that file.
 */
