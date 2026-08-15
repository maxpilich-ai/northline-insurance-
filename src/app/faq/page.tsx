import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { allFaqItems, faqGroups } from "@/lib/faq";
import { flags, site } from "@/lib/site.config";
import { Container, Eyebrow, Section } from "@/components/ui/primitives";
import { CtaBand, PageHero, ProductionNote } from "@/components/ui/page";
import { Accordion } from "@/components/ui/Accordion";
import { FaqSchema, BreadcrumbSchema } from "@/lib/schema";
import { Token } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMeta({
  title: "Frequently Asked Questions",
  description:
    "Straight answers about working with an independent life insurance brokerage: the process, what underwriting involves, and being declined.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <BreadcrumbSchema trail={[{ name: "Home", path: "/" }, { name: "Frequently Asked Questions", path: "/faq" }]} />
      {/* Emits only the questions whose answers contain no unresolved tokens,
          and only if at least two survive. Today that filter removes several. */}
      <FaqSchema items={allFaqItems} />

      <PageHero
        eyebrow="Questions"
        title="Straight answers, including the awkward ones."
        standfirst="If something you want to know is not here, call the office and ask. We would rather answer it directly than have you guess."
      />

      {faqGroups.map((group, i) => (
        <Section key={group.heading} tone={i % 2 === 0 ? "alt" : "paper"}>
          <Container>
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
              <Reveal className="lg:col-span-4 lg:sticky lg:top-[calc(var(--chrome-top,8rem)+1.5rem)] lg:self-start">
                <Eyebrow tone="accent">{`0${i + 1}`}</Eyebrow>
                <h2 className="mt-5 font-display text-h2 text-ink text-balance">{group.heading}</h2>
              </Reveal>

              <Reveal delay={60} className="lg:col-span-7 lg:col-start-6">
                <Accordion items={group.items} openFirst={i === 0} />
              </Reveal>
            </div>
          </Container>
        </Section>
      ))}

      {/* The absent question, made explicit rather than quietly omitted. */}
      {!flags.compensation && (
        <Section tone="paper" size="sm">
          <Container>
            <div className="grid lg:grid-cols-12">
              <div className="lg:col-span-7 lg:col-start-6">
                <ProductionNote>
                  One question is deliberately missing from this page:{" "}
                  <em>what does it cost to work with you</em>. It is the most common objection in
                  the category and the strongest trust signal available — and it stays absent until
                  the compensation model is confirmed. It appears automatically, here and on the
                  homepage, once <code className="text-ink">flags.compensation</code> is turned on
                  and <code className="text-ink">{"{{COMPENSATION_MODEL}}"}</code> is filled in.
                </ProductionNote>
              </div>
            </div>
          </Container>
        </Section>
      )}

      <Section tone="alt" size="sm">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Eyebrow tone="accent">Still unanswered</Eyebrow>
              <h2 className="mt-5 font-display text-h3 text-ink">Ask a person.</h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <p className="max-w-measure text-body text-muted">
                The phone is not a second-class route here. It is listed on every page rather than
                buried behind a form.
              </p>
              <p className="mt-6">
                <PhoneLink className="font-display text-h3 text-ink underline decoration-[var(--rule-strong)] underline-offset-[8px] transition-colors hover:decoration-ink"><Token value={site.phone} /></PhoneLink>
                <span className="mt-3 block text-small text-muted">
                  <Token value={site.officeHours} />
                </span>
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <CtaBand />
    </>
  );
}
