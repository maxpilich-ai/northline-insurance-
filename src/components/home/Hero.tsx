import { isResolved, routes, site } from "@/lib/site.config";
import {
  Arrow,
  Button,
  Container,
  Display,
  Eyebrow,
  Section,
  TextLink,
} from "@/components/ui/primitives";
import { Token } from "@/components/ui/Token";
import { Reveal } from "@/components/ui/Reveal";

/**
 * HERO — mechanism, not sentiment.
 *
 * Deliberately typographic. No stock imagery, no gradient, no hero photograph
 * of a family in a field. The headline states how independent brokerage
 * actually works; the "at a glance" panel carries the credibility strip and is
 * built to look correct at two rows as well as four, because any figure the
 * owner cannot substantiate gets deleted rather than softened.
 */

/**
 * `showWhileUnresolved: false` means the row is withheld entirely until the
 * real value exists — per Max's instruction, the Office row only appears once
 * actual office information has been supplied.
 *
 * The other three stay visible as tokens so they cannot be forgotten. If any
 * ultimately cannot be substantiated, delete the row outright — never soften
 * the wording to make an unverifiable figure sound acceptable.
 */
const glance = [
  { term: "Carriers represented", value: site.carrierCount, showWhileUnresolved: true },
  { term: "Licensed in", value: site.licenseStates, showWhileUnresolved: true },
  { term: "Office", value: site.officeCityState, showWhileUnresolved: false },
  { term: "Established", value: site.yearFounded, showWhileUnresolved: true },
].filter((row) => row.showWhileUnresolved || isResolved(row.value));

export function Hero() {
  return (
    <Section size="none" className="pb-section-sm pt-16 md:pt-24 lg:pt-28">
      <Container>
        <div className="grid items-start gap-14 lg:grid-cols-12 lg:gap-10">
          {/* ── Argument ──────────────────────────────────────────────────── */}
          <Reveal className="lg:col-span-7">
            <Eyebrow tone="accent">Independent Life Insurance Brokerage</Eyebrow>

            <Display as="h1" size="display" className="mt-7 max-w-[19ch]">
              Every carrier underwrites differently. We aren&rsquo;t limited to one.
            </Display>

            <p className="mt-8 max-w-measure text-body-lg text-muted text-pretty">
              Each insurance company sets its own underwriting guidelines — how it weighs health
              history, build, family history, occupation. An agent contracted to a single carrier
              can only submit to that company&rsquo;s rules. As an independent brokerage, we can
              look across <Token value={site.carrierCount} /> carriers and apply where your profile
              actually fits.
            </p>

            <div className="mt-11 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
              <Button href={routes.quote} size="large">
                Get Your Quote <Arrow />
              </Button>
              <span className="text-small text-muted">
                Prefer to talk?{" "}
                <TextLink href={routes.schedule}>
                  Book a call <Arrow />
                </TextLink>
              </span>
            </div>

            {/* Deliberately says nothing about cost or compensation — the
                compensation model is unconfirmed. Obligation is a separate,
                safely stated fact. */}
            <p className="mt-7 max-w-measure text-small text-muted">
              A comparison places you under no obligation. Nothing is applied for until you decide
              to move forward.
            </p>
          </Reveal>

          {/* ── At a glance ───────────────────────────────────────────────── */}
          <Reveal delay={80} className="lg:col-span-4 lg:col-start-9">
            <div className="border border-[var(--rule)] bg-paper-alt-wash">
              <div className="border-b border-[var(--rule)] px-7 py-5">
                <Eyebrow>At a glance</Eyebrow>
              </div>
              {/* Stacked rather than term/value on one line: unresolved tokens
                  are long, and a right-aligned value would collide. Stacking
                  also holds up when a row is deleted rather than softened. */}
              <dl>
                {glance.map((row) => (
                  <div
                    key={row.term}
                    className="border-b border-[var(--rule)] px-7 py-5 last:border-b-0"
                  >
                    <dt className="text-micro uppercase tracking-[0.08em] text-muted">
                      {row.term}
                    </dt>
                    <dd className="mt-1.5 font-display text-h4 tabular-nums text-ink">
                      <Token value={row.value} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
