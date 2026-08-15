import { flags } from "@/lib/site.config";
import { Container, Display, Eyebrow, Section } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/Reveal";

/**
 * SOCIAL PROOF — built, flag-gated, ships EMPTY.
 *
 * Returns null. This is deliberate and is the point of the component.
 *
 * Several states restrict or condition testimonial use in insurance
 * advertising, and FTC endorsement rules apply regardless. Real testimonials
 * also require written consent from the client. Until verified, consented,
 * compliant material exists, this section renders nothing at all — rather than
 * shipping "Sarah M., Happy Client", which every reader correctly reads as
 * fabricated.
 *
 * Flip flags.testimonials once material exists AND his states have been
 * checked.
 */

export type Testimonial = {
  quote: string;
  attribution: string;
  detail?: string;
};

export function SocialProof({ testimonials = [] }: { testimonials?: Testimonial[] }) {
  if (!flags.testimonials || testimonials.length === 0) return null;

  return (
    <Section tone="paper" id="testimonials">
      <Container>
        <Reveal>
          <Eyebrow tone="accent">In their words</Eyebrow>
          <Display as="h2" size="h2" className="mt-6 max-w-[16ch]">
            What clients say.
          </Display>
        </Reveal>

        <ul className="mt-16 grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal as="li" key={t.attribution} delay={i * 60}>
              <figure className="flex h-full flex-col border-t border-[var(--rule-strong)] pt-7">
                <blockquote className="flex-1">
                  <p className="font-display text-h4 text-ink text-pretty">{t.quote}</p>
                </blockquote>
                <figcaption className="mt-7 text-small text-muted">
                  {t.attribution}
                  {t.detail && <span className="block text-micro">{t.detail}</span>}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
