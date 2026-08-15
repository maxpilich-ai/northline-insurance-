"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TURNSTILE_ENABLED, TURNSTILE_SITE_KEY } from "@/lib/turnstile";

/**
 * CLOUDFLARE TURNSTILE — invisible spam protection.
 *
 * Chosen over reCAPTCHA because the reCAPTCHA badge is a permanent visual
 * liability on a site built around restraint, and Turnstile's challenge is
 * usually invisible.
 *
 * ONE SWITCH. `TURNSTILE_ENABLED` is derived at build time from the presence
 * of BOTH keys, and the build fails if only one is set — see next.config.mjs.
 * The browser and the server read that same flag, so they cannot disagree
 * about whether the check is active.
 *
 * With Turnstile off this renders nothing and the forms keep working on the
 * honeypot and the server-side rate limiter alone.
 *
 * ============================================================================
 * WHEN THE BROWSER CANNOT REACH CLOUDFLARE (finding R3-H3)
 * ============================================================================
 *
 * The README described Turnstile as failing OPEN. That was only ever true of
 * the server: if the API cannot reach the siteverify endpoint it allows the
 * submission through and logs it. The BROWSER side failed closed, and silently.
 * An ad-blocker, a privacy extension, a corporate filter or a regional block
 * stops the widget script loading; no token is ever produced; the server
 * answers 403; and the visitor sees "We could not send that just now. Please
 * try again" — advice that could never work, on a form that would never accept
 * anything they did. Reproduced with the script blocked at the network layer:
 *
 *     script tag injected: true | window.turnstile: false | iframes: 0
 *     submit -> stays on /contact, no token, 403, generic retry message
 *
 * This component now REPORTS that state instead of failing quietly. It tells
 * the form, through `onStatus`, whether verification is pending, ready, or
 * unavailable, and the form is then able to say something true and offer a
 * route that works — see VerificationUnavailable.
 *
 * It deliberately does NOT invent a client-side bypass. A flag from the browser
 * saying "Turnstile was unavailable, please let me through" is a flag any bot
 * would also send; that would not be a fallback, it would be the end of the
 * protection. The fallback is a real human channel, which is a thing the
 * business already has.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * How long to wait for a token before declaring the widget unavailable.
 *
 * Generous: a slow connection on a busy network can legitimately take several
 * seconds, and calling it too early would send people to the telephone who did
 * not need to go. Long enough that reaching it means something is actually
 * wrong, short enough that nobody sits looking at a form they cannot submit.
 */
const READY_TIMEOUT_MS = 12_000;

export type TurnstileStatus = "disabled" | "pending" | "ready" | "unavailable";

/**
 * `onToken` and `onStatus` must be STABLE references — the effect that loads
 * the script depends on them, so a fresh lambda on every render would tear the
 * widget down and rebuild it in a loop. All three forms pass `useState`
 * setters, which React guarantees are stable.
 */
export function Turnstile({
  onToken,
  onStatus,
}: {
  onToken: (token: string) => void;
  onStatus?: (status: TurnstileStatus) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const enabled = TURNSTILE_ENABLED;

  /**
   * Loading the script and rendering the widget are one effect, not two joined
   * by a `ready` flag. The flag only existed to pass "script has loaded" from
   * one effect to the other, and setting it synchronously in an effect body
   * causes a cascading render. Here the mount runs from the script's own load
   * callback — which is what an effect subscribing to an external system is
   * supposed to look like.
   */
  useEffect(() => {
    if (!enabled) {
      onStatus?.("disabled");
      return;
    }

    let cancelled = false;
    let settled = false;
    onStatus?.("pending");

    const settle = (status: "ready" | "unavailable") => {
      if (cancelled || settled) return;
      settled = true;
      onStatus?.(status);
    };

    /* A widget that never produces a token is indistinguishable, from the
       visitor's seat, from one that failed outright. Both end in a form that
       cannot be sent, so both are reported the same way. */
    const timer = window.setTimeout(() => settle("unavailable"), READY_TIMEOUT_MS);

    const mount = () => {
      if (cancelled || !ref.current || widgetId.current) return;
      const api = window.turnstile;
      if (!api) {
        settle("unavailable");
        return;
      }
      try {
        widgetId.current = api.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "light",
          appearance: "interaction-only",
          callback: (token: string) => {
            onToken(token);
            settle("ready");
          },
          // A rejected site key, an expired challenge, a network failure part
          // way through: all of these end with no usable token.
          "error-callback": () => {
            onToken("");
            settle("unavailable");
          },
          "expired-callback": () => {
            onToken("");
            // Not "unavailable": expiry means it worked and needs redoing.
            api.reset?.(widgetId.current ?? undefined);
          },
        });
      } catch {
        settle("unavailable");
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    let script: HTMLScriptElement;

    const onError = () => settle("unavailable");

    if (existing) {
      script = existing;
      // Another form on the page already requested it.
      if (window.turnstile) mount();
      else {
        existing.addEventListener("load", mount);
        existing.addEventListener("error", onError);
      }
    } else {
      script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", mount);
      script.addEventListener("error", onError);
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      script.removeEventListener("load", mount);
      script.removeEventListener("error", onError);
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [enabled, onToken, onStatus]);

  if (!enabled) return null;
  return <div ref={ref} data-turnstile-slot="" className="mt-2" />;
}

/**
 * A form offers "try again" by remounting the widget under a new key. That is
 * the only retry with any meaning: the script may have loaded since, or the
 * visitor may have turned an extension off and wants another go without losing
 * everything they have typed.
 */
export function useTurnstileRetry() {
  const [key, setKey] = useState(0);
  return { key, retry: useCallback(() => setKey((n) => n + 1), []) };
}
