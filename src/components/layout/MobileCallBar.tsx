"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { routes, site } from "@/lib/site.config";
import { Token } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { cx } from "@/components/ui/primitives";

/**
 * PERSISTENT MOBILE CALL BAR
 *
 * Phone is a first-class conversion, not a fallback. Life insurance skews
 * toward buyers who would rather call than fill in a form, and a visible
 * number costs nothing to offer.
 *
 * Appears after ~25% scroll so it never covers the hero, and never sits
 * behind a form.
 */
export function MobileCallBar() {
  const [shown, setShown] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  /**
   * PUBLISH THIS BAR'S HEIGHT (finding R4-03).
   *
   * The bar is `position: fixed` at the bottom, so it sits on top of whatever
   * the page scrolls under it — including a link the browser has just scrolled
   * into view because the user tabbed to it. Measured at 390x844, the footer's
   * "About" link landed at 794..810 while this bar occupied 779..844: the
   * focused element was 100% covered, and `elementFromPoint` at its centre
   * returned the bar. That is WCAG 2.2 SC 2.4.11 (Focus Not Obscured, AA), on
   * a site that states AA conformance on /terms.
   *
   * The fix is `scroll-padding-bottom` in globals.css, which needs this number.
   *
   * IT IS PUBLISHED WHENEVER THE BAR CAN APPEAR, NOT ONLY WHILE IT IS SHOWING
   * (finding R6-06). The first version reported 0 until `shown` became true,
   * which looked right and was not: the bar appears ON SCROLL, and a focus
   * scroll is a scroll. Tabbing into the message box on /contact at 375x667
   * scrolled using the 16px padding that applied at rest, the bar then slid up,
   * and 65px — 54% of the focused textarea, including where the caret sits —
   * ended up underneath it. Reproduced 3 times out of 3. Nothing re-scrolls
   * after the bar arrives, so the reservation has to exist BEFORE the scroll is
   * computed.
   *
   * `getBoundingClientRect().height` is the bar's laid-out height, which is
   * unaffected by the `translate-y-full` that parks it off screen — so this
   * reads the same number whether or not the bar is currently visible. It reads
   * 0 only when the element is genuinely absent from layout: `lg:hidden` on
   * desktop, and `[@media(max-height:640px)]:hidden` on short viewports. Those
   * are the cases where reserving space would be reserving it for nothing.
   *
   * THE COST, STATED: on a phone, roughly 81px at the bottom of the scroll
   * viewport is kept clear for a bar that is not on screen yet. A focused
   * element therefore lands slightly higher than it strictly needs to. That is
   * a small and constant imprecision; the alternative is a control that is half
   * covered at the moment a keyboard user reaches it.
   */
  useEffect(() => {
    const publish = () => {
      const el = barRef.current;
      // `display: none` (desktop, or a viewport too short for the bar) is the
      // only state in which there is nothing to reserve.
      const laidOut = el !== null && getComputedStyle(el).display !== "none";
      const h = laidOut ? Math.round(el.getBoundingClientRect().height) : 0;
      document.documentElement.style.setProperty("--chrome-bottom", `${h}px`);
    };
    publish();
    window.addEventListener("resize", publish);
    return () => {
      window.removeEventListener("resize", publish);
      document.documentElement.style.setProperty("--chrome-bottom", "0px");
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setShown(height > 0 && scrolled / height > 0.08 && scrolled > window.innerHeight * 0.25);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    /*
      `inert` while off-screen (finding R3-L8).

      The bar is moved out of view with `translate-y-full`, which hides it
      visually but leaves it in the layout, in the accessibility tree and in the
      tab order — a keyboard user could tab into two links sitting 64px below
      the fold with nothing to show for it, and a screen reader announced them
      as available. `inert` removes it from both until it is actually shown, and
      aria-hidden says the same thing to older agents.
    */
    <div
      ref={barRef}
      inert={!shown}
      aria-hidden={!shown || undefined}
      className={cx(
        "fixed inset-x-0 bottom-0 z-40 border-t border-[var(--rule-dark)] bg-ink-deep",
        "transition-transform duration-300 ease-editorial lg:hidden",
        /*
          NOT ON A SHORT VIEWPORT (finding R3-M12).

          Sticky header plus this bar consumed 62% of a 667x375 landscape phone
          and 55% of 844x390, against a 30% budget the project sets itself. A
          persistent call-to-action that eats half the screen stops being an
          offer and becomes an obstruction — and landscape is exactly where
          someone is most likely to be reading a table or a long answer. The
          number stays in the header and the footer on every route, so nothing
          is lost.
        */
        /*
          The guard is on the SPACE AVAILABLE, not on one axis (finding R4-10).

          It used to be `max-height:500px`, which covered landscape phones and
          missed 320x568 portrait — an iPhone SE and many older Androids, where
          the sticky header (125px) plus this bar (65px) came to 190px, or 33.4%
          of the viewport, against the project's own 30% budget. Adding a second
          hard-coded breakpoint would have been the same mistake again, one
          device later.

          `max-height:640px` covers every viewport where 190px of chrome breaks
          the budget, which is the actual rule: below that height the number is
          in the header and the footer, and the bar earns its place back as soon
          as there is room for it.
        */
        "[@media(max-height:640px)]:hidden",
        "pb-[env(safe-area-inset-bottom)]",
        shown ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="grid grid-cols-2 divide-x divide-[var(--rule-dark)]">
        <PhoneLink className="flex flex-col items-center justify-center py-3.5 text-on-dark" tone="dark"><span className="text-eyebrow uppercase tracking-[0.14em] text-muted-dark">Call</span>
          <span className="mt-1 text-small">
            <Token value={site.phone} />
          </span></PhoneLink>
        <Link
          href={routes.quote}
          className="flex items-center justify-center bg-accent py-3.5 text-small font-medium text-paper"
        >
          Get Your Quote
        </Link>
      </div>
    </div>
  );
}
