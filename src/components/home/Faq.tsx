import { homepageFaq } from "@/lib/faq";
import {
  Arrow,
  Container,
  Display,
  Eyebrow,
  Section,
  TextLink,
} from "@/components/ui/primitives";
import { Accordion } from "@/components/ui/Accordion";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Homepage FAQ — the five real objections, drawn from lib/faq so the copy,
 * the /faq page and the FAQPage structured data never drift apart.
 */
export function Faq() {
  return (
    <Section tone="paper" id="faq">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-4">
            <Eyebrow tone="accent">Common questions</Eyebrow>
            <Display as="h2" size="h2" className="mt-6 max-w-[14ch]">
              The things people actually ask.
            </Display>
            <div className="mt-9">
              <TextLink href="/faq">
                All questions <Arrow />
              </TextLink>
            </div>
          </Reveal>

          <Reveal delay={60} className="lg:col-span-7 lg:col-start-6">
            <Accordion items={homepageFaq} openFirst />
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
