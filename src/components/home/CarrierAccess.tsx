import { isResolved, site } from "@/lib/site.config";
import {
  Arrow,
  Container,
  Display,
  Eyebrow,
  Section,
  TextLink,
  cx,
} from "@/components/ui/primitives";
import { Token } from "@/components/ui/Token";
import { Reveal } from "@/components/ui/Reveal";

/**
 * CARRIER ACCESS — the zero-permission render state.
 *
 * Carrier advertising rules commonly require written permission and often
 * advertising pre-approval before an appointed agent may display a carrier's
 * name or logo. We assume at build time that we may be able to publish few
 * names or none, so the argument carries this block and logos are never its
 * structural backbone.
 *
 * The four factors below are general industry structure — what distinguishes
 * any carrier from any other — not claims about this firm's process.
 */

const factors = [
  {
    n: "01",
    title: "Underwriting guidelines",
    body: "How a company treats a specific health history, build, prescription record or occupation. These differ from carrier to carrier, and they are filed independently by each one.",
  },
  {
    n: "02",
    title: "Financial strength",
    body: "Independent agencies publish ratings assessing an insurer’s ability to meet its obligations to policyholders over the long term.",
  },
  {
    n: "03",
    title: "Product design",
    body: "How a policy is structured, what term lengths and face amounts are available, and which riders a company offers on a given contract.",
  },
  {
    n: "04",
    title: "Service after issue",
    body: "How the company handles policyholders once a policy is in force — servicing, beneficiary changes, and the claims process itself.",
  },
];

export function CarrierAccess() {
  const countResolved = isResolved(site.carrierCount);

  return (
    <Section tone="paper" id="carriers">
      <Container>
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-12">
          {/* ── The figure, treated typographically ────────────────────── */}
          {/* Sticky on wide screens: the factor list on the right is much
              taller than this column, and an editorial spread should not leave
              a void. The figure stays in view while the factors scroll past. */}
          <Reveal className="lg:col-span-5 lg:sticky lg:top-[calc(var(--chrome-top,8rem)+1.5rem)] lg:self-start">
            <Eyebrow tone="accent">Carrier access</Eyebrow>

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

            <div className="mt-10">
              <TextLink href="/carriers" tone="accent">
                How we work with carriers <Arrow />
              </TextLink>
            </div>
          </Reveal>

          {/* ── What separates one carrier from another ─────────────────── */}
          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal>
              <Display as="h2" size="h3" className="max-w-[24ch]">
                What an appointment actually buys you.
              </Display>
              <p className="mt-6 max-w-measure text-body text-muted text-pretty">
                An appointment is a contract between a brokerage and an insurance company that
                allows the brokerage to submit business to it. The more appointments a brokerage
                holds, the more sets of guidelines an application can be measured against — and the
                more places there are to look when one company&rsquo;s rules are a poor fit for a
                particular applicant.
              </p>
            </Reveal>

            <dl className="mt-12">
              {factors.map((f, i) => (
                <Reveal key={f.n} delay={i * 50}>
                  <div className="grid grid-cols-[auto_1fr] gap-x-6 border-t border-[var(--rule)] py-7">
                    <dt className="col-span-2 grid grid-cols-[auto_1fr] gap-x-6">
                      <span className="pt-1 font-sans text-micro font-medium tabular-nums tracking-[0.1em] text-accent">
                        {f.n}
                      </span>
                      <span className="font-display text-h4 text-ink">{f.title}</span>
                    </dt>
                    <dd className="col-start-2 mt-3 max-w-measure text-base text-muted">{f.body}</dd>
                  </div>
                </Reveal>
              ))}
            </dl>
          </div>
        </div>
      </Container>
    </Section>
  );
}
