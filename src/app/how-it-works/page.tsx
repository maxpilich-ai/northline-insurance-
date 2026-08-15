import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { flags, site } from "@/lib/site.config";
import { Container, Display, Eyebrow, Section } from "@/components/ui/primitives";
import {
  CtaBand,
  IndexedList,
  PageHero,
  ProductionNote,
  Prose,
  SectionHeading,
} from "@/components/ui/page";
import { Token } from "@/components/ui/Token";
import { BreadcrumbSchema } from "@/lib/schema";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMeta({
  title: "How It Works",
  description:
    "The five stages of arranging life insurance through an independent brokerage — what happens at each one, and how long it actually takes.",
  path: "/how-it-works",
});

/**
 * /how-it-works
 *
 * This page exists to answer the question every visitor arrives with and none
 * of them type: what is the catch, what does this cost me, and how long does
 * it take. Removing friction from the quote form is the entire job.
 *
 * The compensation section is the most persuasive thing that could sit here
 * and it is deliberately withheld — see flags.compensation. Turnaround times
 * that would describe THIS firm rather than the industry are withheld too.
 */

const stages = [
  {
    n: "01",
    title: "A conversation",
    meta: "First contact",
    body: "We talk through who depends on you, what you are trying to protect, and what fits your budget. No application is started, and there is no exhaustive medical questionnaire at this stage.",
  },
  {
    n: "02",
    title: "Needs assessment",
    meta: "Same conversation",
    body: "We work out a coverage figure from arithmetic rather than instinct: income that would need replacing and for how long, debts that would need clearing, and what is already in place through an employer or an existing policy.",
  },
  {
    n: "03",
    title: "Carrier matching",
    meta: undefined,
    body: "This is the part that only an independent brokerage can do. Your profile goes to the carriers whose underwriting guidelines suit it, rather than to whichever single company an agent happens to be contracted with. We come back with options you can compare side by side.",
  },
  {
    n: "04",
    title: "Application and underwriting",
    meta: "Typically 2–6 weeks",
    body: "You complete one application. The carrier reviews it and may request a paramedical exam, medical records from your doctor, or a prescription history. Some carriers offer accelerated paths that skip the exam for applicants who meet their criteria. This stage is the long one, and it is controlled by the carrier rather than by us.",
  },
  {
    n: "05",
    title: "Delivery",
    meta: undefined,
    body: "The policy is issued and delivered. We go through what it actually covers with you and confirm the beneficiary details are right. If your circumstances later change — a move, a new child, a mortgage paid off — a policy that fitted once may not still fit, and you are welcome to come back and have it looked at again.",
  },
];

const prepare = [
  {
    n: "01",
    title: "Who depends on your income",
    body: "Names and ages are enough. We are working out how many years of support would need replacing, not building a file.",
  },
  {
    n: "02",
    title: "What you owe",
    body: "Approximate mortgage balance and any other significant debt. Round numbers are fine.",
  },
  {
    n: "03",
    title: "What you already have",
    body: "Any existing policy, including coverage through an employer. Group cover often ends when the job does, which is worth knowing before you buy more.",
  },
  {
    n: "04",
    title: "A rough sense of your health",
    body: "Nothing detailed. Whether you use tobacco, and anything significant a carrier would ask about. The specifics come later, with a licensed person, not through a form.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <BreadcrumbSchema trail={[{ name: "Home", path: "/" }, { name: "How It Works", path: "/how-it-works" }]} />
      <PageHero
        eyebrow="The process"
        title="What actually happens, and how long it takes."
        standfirst="Life insurance is not an instant product, and any website suggesting otherwise is describing an application rather than a policy. Here is the real sequence, with honest timings."
      />

      {/* ── The five stages ────────────────────────────────────────────── */}
      <Section tone="alt">
        <Container>
          <SectionHeading
            eyebrow="Stage by stage"
            title="Five stages, start to finish."
            standfirst="Most of the elapsed time sits in stage four, and that stage belongs to the insurance carrier rather than to us."
          />
          <div className="mt-16">
            <IndexedList items={stages} />
          </div>
        </Container>
      </Section>

      {/* ── How we are paid ─────────────────────────────────────────────
           The single most persuasive section that could appear on this
           page — and it stays a placeholder until the compensation model
           is confirmed. Writing "the carrier pays, not you" without
           confirmation would be inventing a business fact. ------------- */}
      <Section tone="paper">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <Eyebrow tone="accent">Straight answer</Eyebrow>
              <Display as="h2" size="h2" className="mt-6 max-w-[14ch]">
                How we get paid.
              </Display>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              {flags.compensation ? (
                <Prose>
                  <p>
                    <Token value={site.compensationModel} />
                  </p>
                </Prose>
              ) : (
                <>
                  <Prose>
                    <p className="text-ink">
                      <Token value={site.compensationModel} />
                    </p>
                  </Prose>
                  <ProductionNote>
                    This section is intentionally empty. Being direct about compensation is
                    counter-intuitive and it converts, because every visitor is silently asking and
                    almost no competitor answers. It stays blank until two questions are confirmed:
                    whether compensation is purely carrier-paid or whether any client fees exist,
                    and whether any carrier pays materially more than another for a comparable
                    product. If the second is true, the site must not imply otherwise.
                  </ProductionNote>
                </>
              )}
            </div>
          </div>
        </Container>
      </Section>

      {/* ── What to have ready ─────────────────────────────────────────── */}
      <Section tone="alt">
        <Container>
          <SectionHeading
            eyebrow="Before the call"
            title="What to have ready."
            standfirst="Four things, none of which require paperwork. The conversation goes faster if you have thought about them, and it still works if you have not."
          />
          <div className="mt-16">
            <IndexedList items={prepare} columns={4} />
          </div>
        </Container>
      </Section>

      {/* ── Underwriting ───────────────────────────────────────────────── */}
      <Section tone="paper">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5 lg:sticky lg:top-[calc(var(--chrome-top,8rem)+1.5rem)] lg:self-start">
              <Eyebrow tone="accent">Underwriting</Eyebrow>
              <Display as="h2" size="h2" className="mt-6 max-w-[14ch]">
                The part nobody explains.
              </Display>
            </Reveal>

            <Reveal delay={60} className="lg:col-span-6 lg:col-start-7">
              <Prose>
                <p>
                  Underwriting is how an insurance company decides whether to offer you a policy and
                  at what price. It is not a formality, and it is where the elapsed time goes.
                </p>
                <h3>What a carrier may ask for</h3>
                <p>
                  Depending on the company, the product, your age and the coverage amount, an
                  application can involve any combination of the following:
                </p>
                <ul>
                  <li>
                    A paramedical exam — usually a nurse visiting your home or workplace to take
                    height, weight, blood pressure, and blood and urine samples.
                  </li>
                  <li>
                    Records from your doctor, which the carrier requests directly and which are
                    frequently the slowest part of the whole process.
                  </li>
                  <li>
                    A prescription history and a check of industry databases that insurers share.
                  </li>
                  <li>A phone interview covering medical history, travel and occupation.</li>
                </ul>
                <h3>Accelerated underwriting</h3>
                <p>
                  Some carriers offer paths that skip the exam for applicants who meet their
                  criteria, using data rather than fluids to make the decision. Eligibility varies
                  considerably between companies and is not something you can rely on in advance.
                  Knowing which carriers offer a realistic accelerated route for a given applicant
                  is part of what carrier matching is for.
                </p>
                <h3>What the outcome looks like</h3>
                <p>
                  A carrier can approve an application as applied for, approve it at a different
                  rate class than expected, offer a modified policy, postpone a decision, or decline
                  it. Each of those is that company&rsquo;s judgment against its own filed
                  guidelines — not a verdict shared across the industry.
                </p>
              </Prose>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ── Declined or rated ──────────────────────────────────────────── */}
      <Section tone="dark">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5">
              <Eyebrow tone="light">Where independence pays</Eyebrow>
              <Display as="h2" size="h2" className="mt-6 max-w-[16ch]">
                If you are declined, or rated worse than expected.
              </Display>
            </Reveal>
            <Reveal delay={60} className="lg:col-span-6 lg:col-start-7">
              <Prose tone="dark">
                <p>
                  This is the situation the whole independent model is built for, and it is worth
                  being precise about what does and does not follow.
                </p>
                <p>
                  A decline reflects one company&rsquo;s reading of one file against the guidelines
                  that company has filed. Carriers file different guidelines. They weigh a
                  particular health history, a build, a family history or an occupation differently
                  from one another, and a profile that falls outside one company&rsquo;s appetite
                  can sit comfortably inside another&rsquo;s.
                </p>
                <p>
                  An agent contracted to a single carrier has nowhere to take that file. We do —
                  across <Token value={site.carrierCount} /> companies. What we cannot do is promise
                  that a different carrier will reach a different conclusion. No broker can, and any
                  broker who says otherwise is selling you something.
                </p>
                <p>
                  What we can do is make sure the file goes somewhere its specifics are more likely
                  to be understood, rather than resubmitting it into the same rulebook that already
                  said no.
                </p>
              </Prose>
            </Reveal>
          </div>
        </Container>
      </Section>

      <CtaBand />
    </>
  );
}
