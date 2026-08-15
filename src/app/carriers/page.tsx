import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { flags, isResolved, site } from "@/lib/site.config";
import { Container, Display, Eyebrow, Section, cx } from "@/components/ui/primitives";
import {
  CtaBand,
  IndexedList,
  PageHero,
  ProductionNote,
  Prose,
  SectionHeading,
} from "@/components/ui/page";
import { Token } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { BreadcrumbSchema } from "@/lib/schema";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMeta({
  title: "Carriers",
  description:
    "What it means to hold appointments with many carriers, how a carrier earns a place, and why the right company depends on the applicant.",
  path: "/carriers",
});

/**
 * /carriers — ZERO-PERMISSION RENDER STATE.
 *
 * Carrier advertising rules vary and commonly require written permission, often
 * with advertising pre-approval, before an appointed agent may display a
 * carrier's name or logo. Some prohibit it outright.
 *
 * This page is therefore built so the ARGUMENT carries it and logos are never
 * the structural backbone. Three states:
 *
 *   Zero names publishable  → what renders today. No grid at all.
 *   Partial permission      → named grid + "{{ADDITIONAL_CARRIER_COUNT}} more".
 *   Full permission         → full grid.
 *
 * Flip flags.carrierLogos only once permission is confirmed carrier by carrier,
 * and populate the list. Never invent a carrier name to fill the grid.
 */

const criteria = [
  {
    n: "01",
    title: "Underwriting guidelines",
    body: "How a company treats a specific health history, build, prescription record or occupation. These are filed independently by each carrier, and they are the reason the same applicant can be assessed differently in different places.",
  },
  {
    n: "02",
    title: "Financial strength",
    body: "Independent rating agencies assess an insurer's ability to meet its obligations to policyholders over the long term. A life policy is a promise measured in decades, so the assessment matters more here than in most kinds of insurance.",
  },
  {
    n: "03",
    title: "Product design",
    body: "How a policy is structured, which term lengths and face amounts are available, what riders can be attached, and how conversion options work if a term policy is later turned into permanent coverage.",
  },
  {
    n: "04",
    title: "Service and claims",
    body: "How the company handles policyholders once a policy is in force — servicing, beneficiary changes, and how the claim itself is handled, at the moment a family is least able to chase anyone.",
  },
];

export default function CarriersPage() {
  const countResolved = isResolved(site.carrierCount);

  return (
    <>
      <BreadcrumbSchema trail={[{ name: "Home", path: "/" }, { name: "Carriers", path: "/carriers" }]} />
      <PageHero
        eyebrow="Carrier access"
        title="Not tied to one company's rulebook."
        standfirst="An independent brokerage holds contracts with many insurance companies rather than one. That single structural fact is what makes comparison possible at all."
      />

      {/* ── The figure ─────────────────────────────────────────────────── */}
      <Section tone="alt">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5">
              <Eyebrow tone="accent">Appointments held</Eyebrow>
              <p
                className={cx(
                  "mt-8 font-display leading-[0.9] text-ink",
                  countResolved ? "text-numeral" : "text-h1 break-words"
                )}
              >
                <Token value={site.carrierCount} />
              </p>
              <p className="mt-5 max-w-measure-tight text-body text-muted">
                insurance carriers, each with its own underwriting guidelines, product design and
                claims record.
              </p>
            </Reveal>

            <Reveal delay={60} className="lg:col-span-6 lg:col-start-7">
              <Prose>
                <h2>What an appointment actually is</h2>
                <p>
                  An appointment is a contract between a brokerage and an insurance company that
                  authorises the brokerage to submit business to it. It is a real commercial
                  relationship, not a directory listing, and each one has to be established and
                  maintained separately.
                </p>
                <p>
                  The practical consequence is straightforward. The more appointments a brokerage
                  holds, the more sets of guidelines an application can be measured against — and
                  the more places there are to look when one company&rsquo;s rules turn out to be a
                  poor fit for a particular applicant.
                </p>
                <h3>What it is not</h3>
                <p>
                  Holding an appointment does not mean a carrier will accept any application sent to
                  it. Each company still applies its own underwriting to every file. Breadth changes
                  where an application can go; it does not change what the receiving company decides.
                </p>
              </Prose>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ── Selection criteria ─────────────────────────────────────────── */}
      <Section tone="paper">
        <Container>
          <SectionHeading
            eyebrow="What separates one carrier from another"
            title="Four things worth comparing."
            standfirst="These are the dimensions on which insurance companies genuinely differ. The first is the one that decides most individual cases."
          />
          <div className="mt-16">
            <IndexedList items={criteria} columns={2} />
          </div>
        </Container>
      </Section>

      {/* ── Different carriers, different answers ──────────────────────── */}
      <Section tone="dark">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5">
              <Eyebrow tone="light">The point of the list</Eyebrow>
              <Display as="h2" size="h2" className="mt-6 max-w-[16ch]">
                There is no best carrier. There is a best carrier for you.
              </Display>
            </Reveal>
            <Reveal delay={60} className="lg:col-span-6 lg:col-start-7">
              <Prose tone="dark">
                <p>
                  It is tempting to want a ranking — a single company at the top of the list that is
                  simply better than the others. The industry does not work that way, and a
                  brokerage that offered you one would be telling you something untrue.
                </p>
                <p>
                  Carriers specialise. One may have unusually deep experience of a particular health
                  condition and price it accordingly. Another may take a more generous view of a
                  particular occupation, or of a family history, or of an applicant who takes a
                  specific medication. A third may simply have the strongest product design for the
                  term length you need.
                </p>
                <p>
                  Which of them is right depends entirely on the person applying. That is why the
                  useful question is never &ldquo;who is the best insurer&rdquo; but &ldquo;who is
                  most likely to read this particular file well&rdquo; — and answering it is the
                  work.
                </p>
              </Prose>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ── Carrier grid — conditional ─────────────────────────────────── */}
      <Section tone="paper">
        <Container>
          <SectionHeading
            eyebrow="The companies themselves"
            title="Which carriers we can name."
          />
          <div className="mt-14 grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              <Prose>
                <p>
                  Insurance companies set their own rules about how agents and brokerages may use
                  their names and marks. Many require written permission, and frequently require
                  advertising to be submitted for approval before it is published. Some do not
                  permit it at all.
                </p>
                <p>
                  We would rather show you an accurate list than a decorative one, so no carrier
                  appears on this page until permission for that specific company has been
                  confirmed. If you want to know whether we hold an appointment with a particular
                  insurer, ask — we will tell you directly.
                </p>
              </Prose>
              {!flags.carrierLogos && (
                <ProductionNote>
                  This section renders no logo grid because{" "}
                  <code className="text-ink">flags.carrierLogos</code> is off. Turning it on
                  requires the carrier list plus confirmation of which companies have granted
                  written permission — and, where applicable, advertising approval. The grid is
                  designed to look correct at six logos, not only at a full roster, so partial
                  permission is a supported outcome rather than a broken one. Never populate it with
                  invented names.
                </ProductionNote>
              )}
            </div>

            <Reveal delay={60} className="lg:col-span-5">
              <div className="border border-[var(--rule)] bg-paper-alt-wash p-8">
                <Eyebrow>Ask directly</Eyebrow>
                <p className="mt-5 text-body text-muted">
                  Call the office and ask whether we work with a specific insurer. It is a question
                  with a one-word answer.
                </p>
                <p className="mt-6 border-t border-[var(--rule)] pt-6">
                  <PhoneLink className="font-display text-h3 text-ink underline decoration-[var(--rule-strong)] underline-offset-[8px] transition-colors hover:decoration-ink"><Token value={site.phone} /></PhoneLink>
                  <span className="mt-3 block text-small text-muted">
                    <Token value={site.officeHours} />
                  </span>
                </p>
              </div>
            </Reveal>
          </div>

          <p className="mt-14 max-w-[68ch] border-t border-[var(--rule)] pt-6 text-micro leading-relaxed text-muted">
            Financial strength ratings, where published, are issued by independent rating agencies,
            are current only as of the date shown, and are subject to change. A rating is an opinion
            about an insurer&rsquo;s financial condition — it is not a guarantee, and it is not a
            recommendation of any particular policy.
          </p>
        </Container>
      </Section>

      <CtaBand
        title="The useful question is which carrier fits you."
        body="Answering it takes a conversation about your situation, not an application. We will tell you what the companies we work with can offer someone in your circumstances."
      />
    </>
  );
}
