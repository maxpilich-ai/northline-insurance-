import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { isResolved, site } from "@/lib/site.config";
import { Container, Display, Eyebrow, Section } from "@/components/ui/primitives";
import { EmbedSlot, ProductionNote } from "@/components/ui/page";
import { IfResolved, Token } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { BreadcrumbSchema } from "@/lib/schema";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMeta({
  title: "Book a Call",
  description:
    "Book a call with a licensed person. No application, no obligation — a conversation about what you are trying to cover.",
  path: "/schedule",
});

/**
 * /schedule — the SECONDARY conversion.
 *
 * Secondary everywhere without exception; /quote is the primary CTA on every
 * page. What changes deeper in the site is emphasis, not rank.
 *
 * The calendar embed is a designed frame until a booking tool is chosen. The
 * phone number sits alongside rather than beneath it, because a meaningful
 * share of this audience will not use a calendar widget and should not have to.
 */

const agenda = [
  {
    n: "01",
    title: "Who depends on you",
    body: "Names and ages are enough. We are working out how many years of support would need replacing.",
  },
  {
    n: "02",
    title: "What you are covering",
    body: "A mortgage, an income, education, final costs — or working out which of those actually applies.",
  },
  {
    n: "03",
    title: "What already exists",
    body: "Any policy in force, including through an employer. Group coverage usually ends with the job.",
  },
  {
    n: "04",
    title: "What happens next",
    body: "Whether it makes sense to compare carriers, and what that would involve. No pressure to decide on the call.",
  },
];

export default function SchedulePage() {
  const calendarReady = isResolved(site.calendarEmbedUrl);

  return (
    <>
      <BreadcrumbSchema trail={[{ name: "Home", path: "/" }, { name: "Book a Call", path: "/schedule" }]} />
    <Section size="none" className="pb-section pt-14 md:pt-20">
      <Container>
        <Reveal>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-7">
              <Eyebrow tone="accent">Book a call</Eyebrow>
              <Display as="h1" size="h1" className="mt-6 max-w-[16ch]">
                A call with a licensed person.
              </Display>
            </div>
            <div className="lg:col-span-5 lg:self-end">
              <p className="max-w-measure text-body-lg text-muted text-pretty">
                No application, no medical questions, no obligation. A conversation about what you
                are trying to cover and whether it is worth comparing carriers.
              </p>
              {/* The one place a call duration is stated — and only once it is
                  confirmed. It is deliberately absent from every CTA, so the
                  site cannot advertise a length it has not committed to. */}
              <IfResolved values={[site.callLength]}>
                <p className="mt-6 border-t border-[var(--rule)] pt-5 text-small text-muted">
                  Typical length: <Token value={site.callLength} />
                </p>
              </IfResolved>
            </div>
          </div>
        </Reveal>

        <div className="mt-16 grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* ── Calendar ─────────────────────────────────────────────── */}
          <Reveal className="lg:col-span-7">
            {calendarReady ? (
              <div className="overflow-hidden border border-[var(--rule)]">
                <iframe
                  src={site.calendarEmbedUrl}
                  title="Booking calendar"
                  loading="lazy"
                  className="h-[46rem] w-full"
                />
              </div>
            ) : (
              <>
                <EmbedSlot
                  label="Booking calendar"
                  brief="Cal.com or Calendly embed, styled to the site — meeting-type selection, automatic timezone detection, confirmation and reminder emails. Drops into this frame once a tool is chosen."
                  ratio="4 / 5"
                />
                <ProductionNote>
                  Needed to connect this: which booking tool he already uses, if any, and the
                  embed URL. Set{" "}
                  <code className="text-ink">{"{{CALENDAR_EMBED_URL}}"}</code> in{" "}
                  <code className="text-ink">site.config.ts</code> and the frame is replaced by the
                  live calendar with no other change. Until then the phone number beside this is
                  the working route, which is why it is given equal weight rather than tucked
                  underneath.
                </ProductionNote>
              </>
            )}
          </Reveal>

          {/* ── Phone + agenda ───────────────────────────────────────── */}
          <Reveal delay={60} className="lg:col-span-5">
            <div className="border border-[var(--rule)] bg-paper-alt-wash p-8">
              <Eyebrow tone="accent">Or simply call</Eyebrow>
              <p className="mt-5">
                <PhoneLink className="font-display text-h2 text-ink underline decoration-[var(--rule-strong)]
                             underline-offset-[10px] transition-colors hover:decoration-ink"><Token value={site.phone} /></PhoneLink>
              </p>
              <p className="mt-5 text-small text-muted">
                <Token value={site.officeHours} />
              </p>
              {/* Who answers the telephone is a business fact, not an
                  inference from "small brokerage". Renders only when confirmed. */}
              <IfResolved values={[site.phoneHandling]}>
                <p className="mt-5 border-t border-[var(--rule)] pt-5 text-small text-muted">
                  <Token value={site.phoneHandling} />
                </p>
              </IfResolved>
            </div>

            <div className="mt-12">
              <h2 className="font-display text-h3 text-ink">What we will cover</h2>
              <ol className="mt-8">
                {agenda.map((item) => (
                  <li key={item.n} className="border-t border-[var(--rule)] py-6">
                    <div className="flex items-baseline gap-5">
                      <span className="font-sans text-micro font-medium tabular-nums tracking-[0.1em] text-accent">
                        {item.n}
                      </span>
                      <div>
                        <h3 className="font-display text-h4 text-ink">{item.title}</h3>
                        <p className="mt-2 text-base text-muted">{item.body}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>

        <p className="mt-16 max-w-[68ch] border-t border-[var(--rule)] pt-6 text-micro leading-relaxed text-muted">
          Booking a call is not an application for insurance and creates no obligation. Coverage is
          subject to underwriting and approval by the issuing carrier.
        </p>
      </Container>
    </Section>
    </>
  );
}
