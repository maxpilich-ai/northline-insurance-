import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { site } from "@/lib/site.config";
import { Container, Display, Eyebrow, Section } from "@/components/ui/primitives";
import { Token } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { QuoteForm } from "@/components/forms/QuoteForm";
import { BreadcrumbSchema } from "@/lib/schema";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMeta({
  title: "Request a Quote",
  description:
    "Tell us about your situation and a licensed person will compare what the carriers we work with can offer someone in your circumstances.",
  path: "/quote",
});

/**
 * /quote — the primary conversion.
 *
 * The CTA everywhere says "Get Your Quote" because that is the phrase people
 * search for. The PAGE is titled "Request your personalised quote", and the
 * standfirst says a person reviews it. That gap is deliberate: implying an
 * instant bindable quote is both an advertising-compliance problem and a
 * disappointment problem, and disappointed people do not answer the phone.
 */

const reassurance = [
  {
    title: "Five short steps",
    body: "About two minutes. You can go back at any point, and a refresh will not lose what you have entered.",
  },
  {
    title: "One health question",
    body: "This form does not ask about conditions, medications or family history. We would rather discuss that with a licensed person.",
  },
  {
    title: "No application is started",
    body: "This is a request for a comparison. Nothing is submitted to an insurance company until you decide to move forward.",
  },
];

export default function QuotePage() {
  return (
    <>
      <BreadcrumbSchema trail={[{ name: "Home", path: "/" }, { name: "Get Your Quote", path: "/quote" }]} />
      <Section size="none" className="pb-section-sm pt-14 md:pt-20">
        <Container>
          <div className="grid gap-14 lg:grid-cols-12 lg:gap-12">
            {/* ── The form ─────────────────────────────────────────────── */}
            <div className="lg:col-span-7">
              <Reveal>
                <Eyebrow tone="accent">Request a comparison</Eyebrow>
                <Display as="h1" size="h1" className="mt-6 max-w-[16ch]">
                  Request your personalised quote.
                </Display>
                <p className="mt-7 max-w-measure text-body-lg text-muted text-pretty">
                  Answer five short questions and a licensed person will compare what the carriers
                  we work with can offer someone in your circumstances. Nothing here is an
                  application.
                </p>
              </Reveal>

              <Reveal delay={60} className="mt-12">
                <QuoteForm />
              </Reveal>
            </div>

            {/* ── Aside ────────────────────────────────────────────────── */}
            <Reveal delay={100} className="lg:col-span-4 lg:col-start-9">
              <div className="lg:sticky lg:top-[calc(var(--chrome-top,8rem)+1.5rem)]">
                <div className="border border-[var(--rule)] bg-paper-alt-wash">
                  <div className="border-b border-[var(--rule)] px-7 py-5">
                    <Eyebrow>What happens next</Eyebrow>
                  </div>
                  <dl>
                    {reassurance.map((item) => (
                      <div
                        key={item.title}
                        className="border-b border-[var(--rule)] px-7 py-6 last:border-b-0"
                      >
                        <dt className="font-display text-h4 text-ink">{item.title}</dt>
                        <dd className="mt-2 text-small text-muted">{item.body}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="mt-8 border-t border-[var(--rule-strong)] pt-7">
                  <Eyebrow tone="accent">Would rather talk?</Eyebrow>
                  <p className="mt-4 text-small text-muted">
                    The phone is not a second-class route here — it is offered alongside the form
                    rather than beneath it.
                  </p>
                  <p className="mt-5">
                    <PhoneLink className="font-display text-h3 text-ink underline decoration-[var(--rule-strong)]
                                 underline-offset-[8px] transition-colors hover:decoration-ink"><Token value={site.phone} /></PhoneLink>
                    <span className="mt-3 block text-small text-muted">
                      <Token value={site.officeHours} />
                    </span>
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>
    </>
  );
}
