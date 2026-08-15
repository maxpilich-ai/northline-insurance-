import {
  Arrow,
  Container,
  Display,
  Eyebrow,
  Section,
  TextLink,
} from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/Reveal";

/**
 * COVERAGE ORIENTATION
 *
 * Framed as the QUESTIONS a visitor is trying to answer — never as products.
 * No product line has been confirmed, and a card promising a coverage outcome
 * ("coverage that lasts your whole life") implies an offering. These are open
 * questions that route to the educational /coverage page, where a licensed
 * person — not the website — determines what actually fits.
 */

const questions = [
  {
    n: "01",
    q: "How much coverage do I actually need?",
    a: "The answer comes from arithmetic more than instinct: income that would need replacing, debts that would need clearing, and how many years the people depending on you would need support.",
    href: "/coverage#how-much",
  },
  {
    n: "02",
    q: "Should coverage run for a set period, or for life?",
    a: "Term and permanent policies solve different problems. Which one fits depends largely on whether the need you are covering has an end date — and whether cash value matters to you.",
    href: "/coverage#term-or-permanent",
  },
  {
    n: "03",
    q: "What if I have been declined or rated before?",
    a: "A decline is one company’s reading of one file against one set of guidelines. It is not a verdict from the industry, and it is the situation where working across carriers matters most.",
    href: "/coverage#declined",
  },
];

export function CoverageOrientation() {
  return (
    <Section tone="alt" id="coverage">
      <Container>
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Eyebrow tone="accent">Where to start</Eyebrow>
              <Display as="h2" size="h2" className="mt-6 max-w-[16ch]">
                Three questions worth answering first.
              </Display>
            </div>
            <p className="max-w-measure text-body text-muted lg:col-span-6 lg:col-start-7 lg:self-end">
              Most people arrive knowing they need life insurance and not much else. These are the
              questions that determine everything afterwards — and none of them require talking to
              anyone yet.
            </p>
          </div>
        </Reveal>

        <ul className="mt-16 grid gap-px border-t border-[var(--rule)] md:grid-cols-3 md:border-t-0">
          {questions.map((item, i) => (
            <Reveal as="li" key={item.n} delay={i * 60}>
              <article className="flex h-full flex-col border-b border-[var(--rule)] py-8 md:border-b-0 md:border-t md:pr-8 md:pt-8">
                <span className="font-sans text-micro font-medium tabular-nums tracking-[0.1em] text-accent">{item.n}</span>
                <h3 className="mt-6 font-display text-h3 text-ink text-balance">{item.q}</h3>
                <p className="mt-5 flex-1 text-base text-muted">{item.a}</p>
                <div className="mt-8">
                  <TextLink href={item.href}>
                    Read more <Arrow />
                  </TextLink>
                </div>
              </article>
            </Reveal>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
