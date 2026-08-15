import type { ReactNode } from "react";
import { site } from "@/lib/site.config";
import {
  Arrow,
  Button,
  Container,
  Display,
  Eyebrow,
  Section,
} from "@/components/ui/primitives";
import { Token } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { Reveal } from "@/components/ui/Reveal";
import { FocusOnMount } from "@/components/ui/FocusOnMount";

/**
 * Confirmation page.
 *
 * Each form gets its OWN thank-you route rather than a shared one. Without a
 * distinct destination per form you cannot tell which CTA is working, and the
 * recruiting funnel's numbers end up blended into the consumer funnel's — at
 * which point both figures mean nothing.
 */
export function ThankYou({
  eyebrow,
  title,
  body,
  next,
  showPhone = true,
}: {
  eyebrow: string;
  title: string;
  body: ReactNode;
  next: { label: string; detail: ReactNode }[];
  showPhone?: boolean;
}) {
  return (
    <Section size="none" className="pb-section pt-20 md:pt-28">
      <Container>
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-6">
            {/* The form navigated here client-side, which does not move focus.
                Focusing the heading is what tells a screen-reader user the
                submission actually went through. */}
            <FocusOnMount>
              <Eyebrow tone="accent">{eyebrow}</Eyebrow>
              <Display as="h1" size="h1" className="mt-6 max-w-[15ch]">
                {title}
              </Display>
            </FocusOnMount>
            <p className="mt-8 max-w-measure text-body-lg text-muted text-pretty">{body}</p>

            <div className="mt-11 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
              <Button href="/">
                Back to the homepage <Arrow />
              </Button>
              {showPhone && (
                <span className="text-small text-muted">
                  Or call{" "}
                  <PhoneLink className="text-ink underline decoration-[var(--rule-strong)] underline-offset-[6px] transition-colors hover:decoration-ink"><Token value={site.phone} /></PhoneLink>
                </span>
              )}
            </div>
          </Reveal>

          <Reveal delay={70} className="lg:col-span-5 lg:col-start-8">
            <div className="border border-[var(--rule)] bg-paper-alt-wash">
              <div className="border-b border-[var(--rule)] px-7 py-5">
                <Eyebrow>What happens now</Eyebrow>
              </div>
              <ol>
                {next.map((item, i) => (
                  <li
                    key={item.label}
                    className="border-b border-[var(--rule)] px-7 py-6 last:border-b-0"
                  >
                    <span className="font-sans text-micro font-medium tabular-nums tracking-[0.1em] text-accent">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="mt-3 font-display text-h4 text-ink">{item.label}</p>
                    <div className="mt-2 text-small text-muted">{item.detail}</div>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
