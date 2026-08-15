import { routes, site } from "@/lib/site.config";
import {
  Arrow,
  Button,
  Container,
  Display,
  Eyebrow,
  Section,
  TextLink,
} from "@/components/ui/primitives";
import { Token } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { Reveal } from "@/components/ui/Reveal";

/**
 * FINAL CTA BAND
 *
 * Primary → /quote, always. Secondary → /schedule, always subordinate.
 * Phone sits alongside as a third route, never behind a form.
 */
export function FinalCta() {
  return (
    <Section tone="dark" size="default" className="border-b border-[var(--rule-dark)]">
      <Container>
        <Reveal>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-6">
              <Eyebrow tone="light">Start here</Eyebrow>
              <Display as="h2" size="h2" className="mt-6 max-w-[16ch]">
                One conversation. Then options you can actually compare.
              </Display>
            </div>

            <div className="lg:col-span-5 lg:col-start-8 lg:self-end">
              <p className="max-w-measure text-body text-muted-dark">
                Tell us a little about who depends on you and what you are covering. We will come
                back with what the carriers we work with can offer someone in your circumstances.
              </p>

              <div className="mt-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
                <Button href={routes.quote} variant="onDark" size="large">
                  Get Your Quote <Arrow />
                </Button>
                <TextLink href={routes.schedule} tone="dark" className="text-small">
                  Book a call <Arrow />
                </TextLink>
              </div>

              <p className="mt-9 border-t border-[var(--rule-dark)] pt-6 text-small text-muted-dark">
                Or call the office directly —{" "}
                <PhoneLink className="text-on-dark underline decoration-[var(--rule-dark-strong)]
                             underline-offset-[6px] transition-colors hover:decoration-on-dark" tone="dark"><Token value={site.phone} /></PhoneLink>
                <span className="mt-1 block text-micro">
                  <Token value={site.officeHours} />
                </span>
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
