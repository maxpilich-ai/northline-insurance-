import {
  Arrow,
  Container,
  Display,
  Eyebrow,
  Section,
  TextLink,
} from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/Reveal";
import { isResolved, site } from "@/lib/site.config";

/** Our own turnaround — withheld rather than guessed at. */
const MATCHING_TURNAROUND = isResolved(site.matchingTurnaround)
  ? site.matchingTurnaround
  : undefined;

/**
 * HOW IT WORKS — condensed.
 *
 * Naming the underwriting timeline plainly is a trust signal; most competitor
 * sites hide it because "2–6 weeks" is less appealing than "coverage in
 * minutes". Being the site that says it is worth more than the site that
 * doesn't.
 *
 * Only INDUSTRY timings are stated here. Anything that would be a claim about
 * this firm's own turnaround is withheld until confirmed — see
 * site.matchingTurnaround.
 */

const steps = [
  {
    n: "01",
    title: "A conversation",
    duration: "First contact",
    body: "We talk through who depends on you, what you are trying to cover, and what fits your budget. No application, and no exhaustive medical questionnaire.",
  },
  {
    n: "02",
    title: "Carrier matching",
    duration: MATCHING_TURNAROUND,
    body: "We take your profile to the carriers whose guidelines suit it, then come back with options you can compare side by side.",
  },
  {
    n: "03",
    title: "Application and underwriting",
    duration: "Typically 2–6 weeks",
    body: "You complete one application. The carrier reviews it and may request an exam or medical records. Some carriers offer accelerated paths for certain applicants. Timelines vary by carrier and by applicant.",
  },
  {
    n: "04",
    title: "Delivery",
    duration: undefined,
    body: "The policy is issued and delivered. We go through it with you and confirm the beneficiary details are right. If your circumstances change later, you are welcome to come back and have it reviewed.",
  },
];

export function HowItWorks() {
  return (
    <Section tone="paper" id="how-it-works">
      <Container>
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <Eyebrow tone="accent">The process</Eyebrow>
              <Display as="h2" size="h2" className="mt-6 max-w-[18ch]">
                What actually happens, and how long it takes.
              </Display>
            </div>
            <div className="flex flex-col justify-end lg:col-span-5 lg:col-start-8">
              <p className="max-w-measure text-body text-muted">
                Life insurance is not an instant product, and any site that suggests otherwise is
                describing an application, not a policy. Here is the real sequence.
              </p>
              <div className="mt-7">
                <TextLink href="/how-it-works">
                  The full process <Arrow />
                </TextLink>
              </div>
            </div>
          </div>
        </Reveal>

        <ol className="mt-16 grid gap-x-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Reveal as="li" key={step.n} delay={i * 60}>
              <div className="flex h-full flex-col border-t border-[var(--rule-strong)] pt-7 md:pr-6">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-sans text-micro font-medium tabular-nums tracking-[0.1em] text-accent">{step.n}</span>
                  <span className="text-micro uppercase tracking-[0.08em] tabular-nums text-muted">
                    {step.duration}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-h4 text-ink">{step.title}</h3>
                <p className="mt-4 text-base text-muted">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
