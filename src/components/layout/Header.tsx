"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { nav, routes, site } from "@/lib/site.config";
import { Button, Container, cx } from "@/components/ui/primitives";
import { Token } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { Wordmark } from "@/components/ui/Wordmark";
import { DemoNotice } from "./DemoNotice";

/**
 * UTILITY BAR + HEADER
 *
 * Recruiting gets exactly ONE entry point per breakpoint, plus the footer:
 *   · desktop — the utility bar link below (hidden under lg)
 *   · mobile  — a single link at the foot of the menu panel, since the utility
 *               bar is not rendered at that width
 * It never enters the main navigation and never appears in the page body.
 */

function UtilityBar() {
  return (
    <div className="hidden bg-ink-deep text-on-dark on-dark lg:block">
      <Container>
        <div className="flex h-10 items-center justify-between text-micro">
          <div className="flex items-center gap-7 text-muted-dark">
            <PhoneLink className="text-on-dark transition-colors hover:text-accent-light" tone="dark"><Token value={site.phone} /></PhoneLink>
            <span className="h-3 w-px bg-[var(--rule-dark)]" aria-hidden="true" />
            <span>
              <Token value={site.officeCityState} />
            </span>
            <span className="h-3 w-px bg-[var(--rule-dark)]" aria-hidden="true" />
            <span>
              Licensed in <Token value={site.licenseStates} />
            </span>
          </div>
          <Link
            href={routes.careers}
            className="group text-muted-dark transition-colors hover:text-accent-light"
          >
            For Agents{" "}
            <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      </Container>
    </div>
  );
}

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  /**
   * Closing returns focus to the control that opened the panel. Without it a
   * keyboard user is dropped at the top of the document with no idea where
   * they are.
   */
  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /**
   * SCROLL LOCK — on BOTH scrolling elements.
   *
   * `body` alone was not enough: with `documentElement` unlocked the page still
   * scrolled behind the open panel, which is how the panel could be scrolled
   * partly into view without ever reaching its end.
   */
  useEffect(() => {
    const root = document.documentElement;
    if (open) {
      document.body.style.overflow = "hidden";
      root.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      root.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      root.style.overflow = "";
    };
  }, [open]);

  /**
   * PUBLISH THE HEADER'S OWN HEIGHT (findings R4-03 and R4-08).
   *
   * Several things need to know how tall the persistent chrome is, and until
   * now every one of them guessed. `lg:top-32` put sticky sidebars 128px from
   * the top while the scrolled header ended at 189px, so a rail's heading sat
   * permanently underneath it; and nothing set `scroll-padding`, so browser
   * scroll-into-view — which is what moves focus during keyboard navigation —
   * happily parked a focused control behind the header or under the fixed call
   * bar.
   *
   * One measured value, republished on every resize and on the scrolled/unscrolled
   * transition, consumed by CSS. Guessing is what produced both defects.
   */
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty(
        "--chrome-top",
        `${Math.round(el.getBoundingClientRect().height)}px`
      );
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener("resize", publish);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", publish);
    };
  }, [scrolled]);

  /**
   * CAP THE PANEL TO THE SPACE ACTUALLY AVAILABLE BELOW IT (finding R3-H2).
   *
   * The header is sticky and stacks a demonstration notice, a utility bar and
   * the main bar above this panel, and each of those changes height with the
   * viewport and the scroll state. A hard-coded offset would be wrong on most
   * devices, so the panel measures its own distance from the top of the
   * viewport and takes exactly the rest.
   *
   * Measured rather than assumed because the failure this fixes was a 336px
   * overhang on a landscape phone that hid the primary call to action, with the
   * page scroll-locked so it could not be reached. The CSS `max-h-[80dvh]`
   * class remains as the pre-measurement and no-JS fallback.
   */
  const [panelMaxHeight, setPanelMaxHeight] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = panelRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      // Never below a usable floor: if the chrome above is so tall that almost
      // nothing is left, a very short scroll area still beats a clipped one.
      setPanelMaxHeight(`${Math.max(120, Math.round(window.innerHeight - top))}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [open]);

  /**
   * CLOSE THE PANEL WHEN THE LAYOUT STOPS BEING MOBILE (finding R2-04).
   *
   * The panel and its toggle are both `lg:hidden`. Opening the menu at 390px
   * and then widening the viewport — rotating a tablet, un-zooming, dragging a
   * window wider — left `open` true with nothing visible: the body stayed
   * scroll-locked, the focus trap below stayed armed, and there was no visible
   * control to close it. Escape recovered, if the visitor happened to try it.
   *
   * `lg` is 1024px in the Tailwind config; the query mirrors it.
   */
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (desktop.matches) {
        setOpen(false);
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
      }
    };
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);

  /**
   * While the panel is open it is the only thing on screen — the page behind it
   * is scroll-locked and visually covered. Focus has to behave the same way:
   *
   *   · Escape closes it, which is what every keyboard user tries first.
   *   · Tab cycles within the panel and its trigger, instead of walking off
   *     into links the user cannot see.
   *
   * Both are handled here rather than with a focus-trap dependency; the panel
   * has a handful of focusable children and the whole behaviour is 20 lines.
   */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const toggle = toggleRef.current;
      const panel = panelRef.current;
      if (!toggle || !panel) return;

      const focusable = [
        toggle,
        ...Array.from(
          panel.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ),
      ].filter((el) => el.offsetParent !== null || el === toggle);

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && (active === first || !focusable.includes(active as HTMLElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !focusable.includes(active as HTMLElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    /*
      STICKY, EXCEPT WHERE IT WOULD EAT THE SCREEN (finding R3-M12).

      The header stacks a demonstration notice, a utility bar and the main bar.
      On a phone held sideways that is 37% of a 568x320 viewport and 49% of
      667x375 — against the 30% budget this project sets itself — before the
      mobile call bar, which is already hidden at these heights, is counted at
      all. Persistent chrome taking half the screen stops being navigation and
      becomes an obstruction, and landscape is where someone is most likely to
      be reading something long.

      Below 500px of viewport height the header simply scrolls away with the
      page. Nothing is removed: it is still the first thing on the page, and
      scrolling up brings it back.
    */
    <header ref={headerRef} className="sticky top-0 z-50 [@media(max-height:500px)]:static">
      <DemoNotice />
      <UtilityBar />

      <div
        className={cx(
          // Opaque, not translucent. A blurred strip of the dark section showing
          // through a sticky header reads as an accident, not a material.
          "border-b bg-paper transition-[height,border-color] duration-300 ease-editorial",
          scrolled ? "border-b-[var(--rule)]" : "border-b-transparent"
        )}
      >
        <Container>
          <div
            className={cx(
              "flex items-center justify-between transition-[height] duration-300 ease-editorial",
              scrolled ? "h-16" : "h-20 md:h-24"
            )}
          >
            <Wordmark />

            {/* Desktop navigation — consumer only */}
            <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative py-2 text-small text-ink transition-colors hover:text-accent
                             after:absolute after:bottom-0 after:left-0 after:h-px after:w-0
                             after:bg-accent after:transition-[width] after:duration-200
                             after:ease-editorial hover:after:w-full"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="hidden items-center gap-6 lg:flex">
              {/* Secondary CTA is a text link, never a competing button. */}
              <Link
                href={routes.schedule}
                className="text-small text-muted underline decoration-[var(--rule-strong)]
                           underline-offset-[6px] transition-colors hover:text-ink hover:decoration-ink"
              >
                Book a call
              </Link>
              <Button href={routes.quote}>Get Your Quote</Button>
            </div>

            {/* Mobile trigger */}
            <button
              type="button"
              ref={toggleRef}
              onClick={() => (open ? close() : setOpen(true))}
              aria-expanded={open}
              aria-controls="mobile-nav"
              className="-mr-2 flex h-11 w-11 items-center justify-center lg:hidden"
            >
              <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
              <span aria-hidden="true" className="relative block h-3.5 w-6">
                <span
                  className={cx(
                    "absolute left-0 block h-px w-full bg-ink transition-transform duration-300 ease-editorial",
                    open ? "top-1.5 rotate-45" : "top-0"
                  )}
                />
                <span
                  className={cx(
                    "absolute left-0 block h-px w-full bg-ink transition-transform duration-300 ease-editorial",
                    open ? "top-1.5 -rotate-45" : "top-3"
                  )}
                />
              </span>
            </button>
          </div>
        </Container>
      </div>

      {/*
        Mobile panel.

        SCROLLABLE, AND CAPPED TO THE VIEWPORT (finding R3-H2). The panel used
        to be an ordinary block with `overflow-y: visible` and no height limit,
        while opening it locked page scrolling. On any viewport shorter than the
        panel, everything past the fold was simply unreachable — measured at
        667x375 (a phone in landscape) the panel ran to 711px against a 375px
        viewport, putting Contact, Book a call, For Agents and "Get Your Quote"
        — the site's primary call to action — 336px below the bottom edge with
        no way to scroll to them. Portrait was not safe either: at 390x667 the
        panel ended 5px above the fold, so any real browser chrome pushed it
        over.

        `max-h` + `overflow-y-auto` makes the panel itself the scroll container.
        `dvh` rather than `vh` so the dynamic mobile toolbars are accounted for,
        with a `vh` fallback ordered first for anything that lacks it.
        `overscroll-contain` stops a scroll that reaches the end of the panel
        from chaining to the locked page behind it.
      */}
      <div
        id="mobile-nav"
        ref={panelRef}
        hidden={!open}
        style={panelMaxHeight ? { maxHeight: panelMaxHeight } : undefined}
        className="max-h-[80dvh] overflow-y-auto overscroll-contain border-b
                   border-[var(--rule)] bg-paper lg:hidden"
      >
        <Container>
          <nav aria-label="Mobile" className="flex flex-col py-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-[var(--rule)] py-4 font-display text-h4 text-ink last:border-0"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-3 pb-8 pt-4">
            <Button href={routes.quote} size="large" className="w-full">
              Get Your Quote
            </Button>
            <Button href={routes.schedule} variant="secondary" size="large" className="w-full">
              Book a call
            </Button>
            <Link
              href={routes.careers}
              onClick={() => setOpen(false)}
              className="mt-2 text-center text-small text-muted underline underline-offset-4"
            >
              For Agents
            </Link>
          </div>
        </Container>
      </div>
    </header>
  );
}
