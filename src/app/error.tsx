"use client";

import { useEffect } from "react";
import Link from "next/link";
import { routes, site } from "@/lib/site.config";
import { Arrow, Button, Container, Display, Eyebrow, Section } from "@/components/ui/primitives";
import { Token } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";

/**
 * ROUTE-LEVEL ERROR BOUNDARY.
 *
 * Without one, an uncaught render error shows Next's default page — a bare
 * "Application error: a server-side exception has occurred" and a digest. On a
 * site whose entire argument is that a person will handle your enquiry
 * properly, that is the worst possible moment to look unfinished.
 *
 * The recovery path is deliberately concrete: retry, or telephone. It never
 * claims the error was logged or that anyone was notified, because nothing here
 * does either.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only thing that correlates this page with a server log
    // line. No message or stack is printed: they can carry request content.
    console.error("[ui] render error", { digest: error.digest });
  }, [error]);

  return (
    <Section size="none" className="pb-section pt-24 md:pt-32">
      <Container>
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <Eyebrow tone="accent">Something went wrong</Eyebrow>
            <Display as="h1" size="h1" className="mt-6 max-w-[15ch]">
              That page did not load.
            </Display>
            <p className="mt-8 max-w-measure text-body-lg text-muted text-pretty">
              Not something you did. Try again — and if it keeps happening, the office
              telephone is the faster route.
            </p>

            <div className="mt-11 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
              <button
                type="button"
                onClick={reset}
                className="group inline-flex items-center justify-center gap-2.5 rounded border
                           border-accent bg-accent px-8 py-4 text-base font-medium text-paper
                           transition-colors hover:border-accent-hover hover:bg-accent-hover"
              >
                Try again <Arrow />
              </button>
              <Link
                href="/"
                className="py-1 text-small text-muted underline decoration-[var(--rule-strong)]
                           underline-offset-[6px] transition-colors hover:text-ink hover:decoration-ink"
              >
                Back to the homepage
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <div className="border-t border-[var(--rule-strong)] pt-7">
              <p className="text-micro font-medium uppercase tracking-[0.14em] text-muted">
                Speak to someone
              </p>
              <p className="mt-4 font-display text-h3 text-ink">
                <PhoneLink>
                  <Token value={site.phone} />
                </PhoneLink>
              </p>
              <p className="mt-3 text-small text-muted">
                <Token value={site.officeHours} />
              </p>
              <p className="mt-8">
                <Button href={routes.quote} variant="secondary">
                  Start a quote request <Arrow />
                </Button>
              </p>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
