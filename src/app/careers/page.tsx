import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import Link from "next/link";
import { allResolved, flags, isResolved, routes, site } from "@/lib/site.config";
import {
  Arrow,
  Button,
  Container,
  Display,
  Eyebrow,
  Section,
  TextLink,
} from "@/components/ui/primitives";
import { IndexedList, ProductionNote, Prose, SectionHeading } from "@/components/ui/page";
import { Token } from "@/components/ui/Token";
import { BreadcrumbSchema } from "@/lib/schema";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMeta({
  title: "For Agents",
  description:
    "Producer opportunities with an independent life insurance brokerage — the contract terms, what the agency provides, and what it is not.",
  path: "/careers",
});

/**
 * /careers — THE RECRUITING FUNNEL, QUARANTINED.
 *
 * Reached from the utility bar and the footer only. It never appears in the
 * main navigation and never on the homepage body. Consumer trust in this
 * category collapses the moment a site looks like a recruiting operation, and
 * that is the most common way life insurance agency sites destroy their own
 * conversion rate.
 *
 * Assume a cold arrival — from a job board, LinkedIn or a direct link — that
 * sees nothing else on the site. Hence the full standalone pitch.
 *
 * The specificity IS the strategy. Vague agency pages attract volume; concrete
 * ones attract candidates who close. Everything below is therefore a token
 * rather than a plausible-sounding guess: inventing a commission structure
 * would be both dishonest and, once someone joined on the strength of it,
 * genuinely damaging.
 */

const contractTerms = [
  { term: "Commission structure", value: site.commissionStructure },
  { term: "Vesting", value: site.vestingPolicy },
  { term: "Release policy", value: site.releasePolicy },
  { term: "Leads", value: site.leadPolicy },
  { term: "Chargebacks", value: site.chargebackPolicy },
  { term: "Employment status", value: site.employmentStatus },
];

/**
 * FINDING R4-19 — a claim that the page itself disproves.
 *
 * The filter list said "Compensation is set out in full further down this
 * page", and further down the page every one of the six terms rendered as an
 * unfilled {{TOKEN}}. A producer reading top to bottom was told the terms were
 * published and then shown that they were not — on the one page whose entire
 * argument is that this agency publishes what other agencies hide. The same
 * applied to the sentence promising that the recruiting question is "answered
 * plainly further down".
 *
 * Fixed by deriving the claim from the data instead of asserting it in prose.
 * `termsPublished` is computed from the very values the terms table renders, so
 * the sentence and the table cannot disagree: the moment the owner fills the
 * tokens in, the page starts making the stronger claim by itself, and until
 * then it says what is actually true. This is the R4-02/R4-11 pattern — one
 * authoritative source, no second copy of the fact to drift.
 */
const termsPublished = allResolved(...contractTerms.map((row) => row.value));

/** The recruiting-compensation question is answered by its own token. */
const recruitingAnswerPublished = isResolved(site.downlineDisclosure);

const provided = [
  {
    n: "01",
    title: "Carrier access",
    body: (
      <>
        Appointments with <Token value={site.carrierCount} /> insurance companies, without having to
        build those contracts yourself. This is the practical difference between working
        independently and working alone.
      </>
    ),
  },
  {
    n: "02",
    title: "Training and mentorship",
    body: <Token value={site.trainingProgram} />,
  },
  {
    n: "03",
    title: "Technology",
    body: <Token value={site.agentTechStack} />,
  },
  {
    n: "04",
    title: "Back-office support",
    // What back-office support actually exists is his to state, not ours.
    body: <Token value={site.backOfficeSupport} />,
  },
];

export default function CareersPage() {
  const propReady = isResolved(site.recruitingValueProp);

  return (
    <>
      <BreadcrumbSchema trail={[{ name: "Home", path: "/" }, { name: "For Agents", path: "/careers" }]} />
      {/* ── Recruiting hero ─────────────────────────────────────────────── */}
      <Section size="none" className="pb-section-sm pt-14 md:pt-20">
        <Container>
          <Reveal>
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-7">
                <Eyebrow tone="accent">For licensed producers</Eyebrow>
                <Display as="h1" size="display" className="mt-7 max-w-[15ch]">
                  Independent carrier access, without building it yourself.
                </Display>
              </div>
              <div className="lg:col-span-5 lg:self-end">
                <p className="max-w-measure text-body-lg text-muted text-pretty">
                  <Token value={site.recruitingValueProp} />
                </p>
                <div className="mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
                  <Button href={routes.apply}>
                    Apply <Arrow />
                  </Button>
                  <TextLink href="#terms" className="text-small">
                    What we publish up front <Arrow />
                  </TextLink>
                </div>
              </div>
            </div>
          </Reveal>

          {!propReady && (
            <div className="mt-12 max-w-measure">
              <ProductionNote>
                The standfirst above is his pitch in his own words, and it is the single most
                important sentence on this page. Ask him what he actually offers a producer that a
                captive contract or another IMO does not — then use his phrasing rather than
                improving it.
              </ProductionNote>
            </div>
          )}
        </Container>
      </Section>

      {/* ── Who this is for ─────────────────────────────────────────────── */}
      <Section tone="alt">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5 lg:sticky lg:top-[calc(var(--chrome-top,8rem)+1.5rem)] lg:self-start">
              <Eyebrow tone="accent">Fit</Eyebrow>
              <Display as="h2" size="h2" className="mt-6 max-w-[14ch]">
                Who we are looking for.
              </Display>
            </Reveal>

            <Reveal delay={60} className="lg:col-span-6 lg:col-start-7">
              <Prose>
                <h3>Licensed producers</h3>
                <p>
                  Life-licensed and looking for broader carrier access, whether you are currently
                  captive, independent, or somewhere in between. The states we are actively
                  recruiting in: <Token value={site.recruitingStates} />.
                </p>
                <h3>People working toward a license</h3>
                <p>
                  <Token value={site.prelicensingSupport} />
                </p>
                <h3>What we are not looking for</h3>
                <ul>
                  <li>
                    Anyone expecting a salary before reading the terms.{" "}
                    {termsPublished
                      ? "Compensation is set out in full further down this page."
                      : "The compensation terms are set out further down this page as soon as they are confirmed — they are not published yet, and we would rather leave them blank than print a number nobody agreed to."}
                  </li>
                  <li>
                    Anyone whose plan is to recruit rather than to sell.{" "}
                    {recruitingAnswerPublished
                      ? "Whether recruiting forms part of compensation here is answered plainly further down this page."
                      : "Whether recruiting forms part of compensation here is answered plainly further down this page once that term is confirmed."}
                  </li>
                  <li>
                    Anyone uncomfortable telling a client that the honest answer is &ldquo;you do
                    not need this&rdquo;.
                  </li>
                </ul>
              </Prose>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ── The contract, concretely ────────────────────────────────────── */}
      <Section tone="dark" id="terms">
        <Container>
          <SectionHeading
            tone="dark"
            eyebrow="The terms"
            title="What we can set out up front."
            standfirst="Most agency recruiting pages say nothing at all until you are on a call. Publishing what we can filters out the wrong applicants before anyone wastes an afternoon. Anything not covered here is dealt with directly in conversation."
          />

          <Reveal delay={60}>
            <dl className="mt-14 grid gap-x-12 gap-y-9 md:grid-cols-2">
              {contractTerms.map((row) => (
                <div key={row.term} className="border-t border-[var(--rule-dark)] pt-6">
                  <dt className="text-eyebrow font-medium uppercase tracking-[0.14em] text-accent-light">
                    {row.term}
                  </dt>
                  <dd className="mt-3 text-body text-on-dark">
                    <Token value={row.value} />
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <div className="mt-14 max-w-measure">
            <ProductionNote>
              Every field above is a placeholder, deliberately. Commission percentages, vesting and
              release terms are the facts a producer decides on, and inventing plausible ones would
              be worse than leaving them blank — someone could join on the strength of a number
              nobody agreed to. This section blocks the recruiting funnel from launching, and
              nothing else on the site depends on it.
            </ProductionNote>
          </div>
        </Container>
      </Section>

      {/* ── What the agency provides ────────────────────────────────────── */}
      <Section tone="paper">
        <Container>
          <SectionHeading
            eyebrow="What you get"
            title="What the brokerage actually provides."
            standfirst="The first item is the one that is genuinely hard to replicate alone. Carrier appointments take time to build and each one has to be maintained."
          />
          <div className="mt-16">
            <IndexedList items={provided} columns={2} />
          </div>
        </Container>
      </Section>

      {/* ── What it is not ──────────────────────────────────────────────── */}
      <Section tone="alt">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5">
              <Eyebrow tone="accent">Plainly stated</Eyebrow>
              <Display as="h2" size="h2" className="mt-6 max-w-[14ch]">
                What this is not.
              </Display>
              <p className="mt-7 max-w-measure text-body text-muted">
                Answering these three questions upfront is the strongest applicant filter available,
                and it is the section most agency sites leave out precisely because it costs them
                volume.
              </p>
            </Reveal>

            <Reveal delay={60} className="lg:col-span-6 lg:col-start-7">
              <dl className="border-t border-[var(--rule-strong)]">
                {[
                  {
                    q: "Is this employment, or a 1099 contract?",
                    a: site.employmentStatus,
                  },
                  {
                    q: "Is there a base salary?",
                    a: site.commissionStructure,
                  },
                  {
                    q: "Does recruiting a downline form part of compensation?",
                    a: site.downlineDisclosure,
                  },
                ].map((item) => (
                  <div key={item.q} className="border-b border-[var(--rule)] py-7">
                    <dt className="font-display text-h4 text-ink">{item.q}</dt>
                    <dd className="mt-3 max-w-measure text-base text-muted">
                      <Token value={item.a} />
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ── Producer testimonials — flag-gated, renders nothing today ───── */}
      {flags.testimonials && (
        <Section tone="paper">
          <Container>
            <SectionHeading eyebrow="From the team" title="What producers here say." />
          </Container>
        </Section>
      )}

      {/* ── Apply ───────────────────────────────────────────────────────── */}
      <Section tone="dark" className="border-b border-[var(--rule-dark)]">
        <Container>
          <Reveal>
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-6">
                <Eyebrow tone="light">Next step</Eyebrow>
                <Display as="h2" size="h2" className="mt-6 max-w-[16ch]">
                  Apply.
                </Display>
              </div>
              <div className="lg:col-span-5 lg:col-start-8 lg:self-end">
                <p className="max-w-measure text-body text-muted-dark">
                  The application takes a few minutes.{" "}
                  <Token value={site.applicationReviewPractice} />
                </p>
                <div className="mt-10">
                  <Button href={routes.apply} variant="onDark" size="large">
                    Start an application <Arrow />
                  </Button>
                </div>
                <p className="mt-8 text-small text-muted-dark">
                  Looking for insurance rather than a role?{" "}
                  <Link
                    href="/"
                    className="text-on-dark underline decoration-[var(--rule-dark-strong)] underline-offset-[6px] transition-colors hover:decoration-on-dark"
                  >
                    Back to the main site
                  </Link>
                  .
                </p>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>
    </>
  );
}
