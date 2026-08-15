"use client";

import { site } from "@/lib/site.config";
import { PhoneLink } from "@/components/ui/PhoneLink";

/**
 * WHAT A VISITOR SEES WHEN THE SPAM CHECK CANNOT LOAD (finding R3-H3).
 *
 * Turnstile fails open on the SERVER — if the API cannot reach Cloudflare it
 * lets the submission through. It cannot do the same for the BROWSER: no token
 * exists to verify, and accepting a client that simply says "the widget didn't
 * load, trust me" would hand every bot the same sentence. So the honest
 * position is that this particular visitor cannot use this particular form
 * right now, and the only decent thing to do is say so and hand them a route
 * that actually works.
 *
 * Before this existed, the failure looked like: fill in the whole form, press
 * Send, get "We could not send that just now. Please try again" — and try
 * again, forever, because nothing they could do would ever produce a token.
 *
 * WHAT THIS DELIBERATELY IS NOT. There is no "skip verification" checkbox and
 * no client-supplied bypass flag. The fallback is the telephone, which is a
 * channel the business already staffs, and it collects nothing — in particular
 * none of the health-adjacent answers the quote form asks for, which have no
 * business travelling through a degraded path.
 *
 * ACCESSIBILITY. `role="alert"` announces it the moment it appears, which is
 * the point: it appears while the visitor is still reading the form, not after
 * they have filled it in. The retry is a real button, reachable by keyboard,
 * and the telephone number is a `tel:` link so it dials on a phone.
 */
export function VerificationUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      data-verification-unavailable=""
      className="rounded border border-[var(--rule-strong)] bg-paper-alt p-5"
    >
      <p className="font-display text-h5 text-ink">This form cannot be sent right now</p>

      <p className="mt-2 text-small text-muted">
        The spam check this form uses could not load in your browser. That is almost always an
        ad-blocker, a privacy extension or a network filter blocking{" "}
        <span className="whitespace-nowrap">challenges.cloudflare.com</span> — not a problem with
        anything you have entered.
      </p>

      <p className="mt-4 text-small text-ink">
        <strong className="font-medium">Two ways forward.</strong> Allow that domain and try
        again, or simply call the office — we will take your details on the phone, and it is
        usually quicker.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-ink px-5 py-2.5 text-small font-medium text-ink
                     transition-colors hover:bg-ink hover:text-paper"
        >
          Try the check again
        </button>

        <PhoneLink className="text-small font-medium text-ink underline underline-offset-4">
          Call {site.phone}
        </PhoneLink>
      </div>
    </div>
  );
}
