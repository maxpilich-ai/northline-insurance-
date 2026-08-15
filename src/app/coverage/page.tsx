import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { flags, productLines, site } from "@/lib/site.config";
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
  title: "Coverage",
  description:
    "How much coverage you need, whether it should run for a set period or for life, and what happens if you have been declined before.",
  path: "/coverage",
});

/**
 * /coverage — MODE A (educational).
 *
 * ============================ IMPORTANT ============================
 * No product line has been confirmed for this business. This page therefore
 * explains the LANDSCAPE — it never claims what the firm places.
 *
 * Every heading is framed as a decision the reader is making, and every
 * section routes to a licensed person rather than to a product. Nothing here
 * says "we offer", "our policies", or names a product as an offering.
 *
 * MODE B: as each line is confirmed, add it to `productLines` in site.config.
 * The block at the foot of this page then renders those products with a
 * "we can place this" treatment, and each becomes eligible for promotion to
 * its own route at /coverage/[slug]. Promoting a product later is a config
 * change plus a copy pass — not a rebuild.
 * ===================================================================
 */

const pricingFactors = [
  {
    n: "01",
    title: "Age",
    body: "The single largest factor in almost every case. Premiums for a given amount of coverage rise as you get older, which is why the advice to sort it out sooner is not merely a sales line.",
  },
  {
    n: "02",
    title: "Health and health history",
    body: "Current condition, medical history, family history, height and weight, and prescription record. How heavily each of these counts is the thing that differs most from carrier to carrier.",
  },
  {
    n: "03",
    title: "Tobacco and nicotine use",
    body: "Usually assessed as a separate rate class. Definitions of what counts, and how long you must have stopped, vary between companies.",
  },
  {
    n: "04",
    title: "Coverage amount and duration",
    body: "How much cover, and for how long. A longer term or a larger face amount costs more, and permanent coverage costs more than temporary coverage for the same face amount.",
  },
];

export default function CoveragePage() {
  return (
    <>
      <BreadcrumbSchema trail={[{ name: "Home", path: "/" }, { name: "Coverage", path: "/coverage" }]} />
      <PageHero
        eyebrow="Where to start"
        title="How to think about it, before anyone sells you anything."
        standfirst="Three decisions sit underneath every life insurance purchase. None of them require talking to a person, and getting them straight first makes the conversation afterwards much shorter."
      />

      {/* ── 01 · How much ──────────────────────────────────────────────── */}
      <Section tone="alt" id="how-much">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5 lg:sticky lg:top-[calc(var(--chrome-top,8rem)+1.5rem)] lg:self-start">
              <span className="font-sans text-micro font-medium tabular-nums tracking-[0.1em] text-accent">
                01
              </span>
              <Display as="h2" size="h2" className="mt-6 max-w-[14ch]">
                How much coverage do I actually need?
              </Display>
            </Reveal>

            <Reveal delay={60} className="lg:col-span-6 lg:col-start-7">
              <Prose>
                <p>
                  The answer comes from arithmetic rather than instinct, and the arithmetic is not
                  complicated. You are working out what would need paying for if your income
                  stopped.
                </p>
                <h3>The four inputs</h3>
                <ul>
                  <li>
                    <strong>Income replacement.</strong> Annual income, multiplied by the number of
                    years the people who depend on you would need support. That number is usually
                    driven by the age of the youngest child, or by how long until a partner reaches
                    retirement.
                  </li>
                  <li>
                    <strong>Debt.</strong> Mortgage balance, plus anything else that would not
                    disappear — loans, and any debt someone else has co-signed.
                  </li>
                  <li>
                    <strong>Future costs you intend to fund.</strong> Education is the common one.
                  </li>
                  <li>
                    <strong>What already exists.</strong> Subtract coverage already in force,
                    including through an employer — noting that group coverage generally ends when
                    the job does, which is a good reason not to treat it as permanent.
                  </li>
                </ul>
                <h3>Rules of thumb, and their limits</h3>
                <p>
                  You will see multiples of income quoted as shorthand. They are a starting point,
                  not an answer: two households with identical incomes can need very different
                  amounts depending on how many years of support are left and how much is already
                  covered. Use the arithmetic above, then sanity-check it against the shorthand
                  rather than the other way round.
                </p>
              </Prose>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ── 02 · Term or permanent ─────────────────────────────────────── */}
      <Section tone="paper" id="term-or-permanent">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5 lg:sticky lg:top-[calc(var(--chrome-top,8rem)+1.5rem)] lg:self-start">
              <span className="font-sans text-micro font-medium tabular-nums tracking-[0.1em] text-accent">
                02
              </span>
              <Display as="h2" size="h2" className="mt-6 max-w-[14ch]">
                A set period, or for life?
              </Display>
            </Reveal>

            <Reveal delay={60} className="lg:col-span-6 lg:col-start-7">
              <Prose>
                <p>
                  Life insurance divides into two broad families. They solve different problems, and
                  the honest way to choose between them is to ask whether the need you are covering
                  has an end date.
                </p>
                <h3>Term life insurance</h3>
                <p>
                  Coverage for a fixed number of years — commonly ten, fifteen, twenty or thirty. If
                  the insured person dies during that term, the policy pays. If the term ends first,
                  the coverage ends with it and nothing is paid out. Because the insurer is only on
                  risk for a defined window, term coverage costs substantially less than permanent
                  coverage for the same face amount.
                </p>
                <p>
                  It suits needs with a horizon: years until the children are independent, years
                  left on a mortgage, years until retirement assets are sufficient on their own.
                </p>
                <h3>Permanent life insurance</h3>
                <p>
                  Designed to remain in force for life provided the policy is funded as required.
                  Most permanent policies build a cash value that grows over time and can generally
                  be borrowed against, though doing so reduces what is eventually paid out. Whole
                  life, universal life and indexed universal life are variations on this idea, and
                  they differ in how the premium, the cash value and the guarantees are structured.
                </p>
                <p>
                  It suits needs with no end date — a dependant who will always require support, an
                  estate consideration, or a deliberate decision to hold coverage for life.
                </p>
                <h3>The decision, put plainly</h3>
                <p>
                  Permanent coverage costs more for the same face amount, and buying it means either
                  a larger budget or a smaller death benefit. Neither family is better than the
                  other in the abstract. The question is whether what you are covering ends, and
                  whether the cash value component is something you actually want.
                </p>
              </Prose>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ── What affects what you pay ─────────────────────────────────── */}
      <Section tone="alt">
        <Container>
          <SectionHeading
            eyebrow="Pricing"
            title="What affects what you pay."
            standfirst="Four factors do most of the work. The second is where independence matters, because it is the one carriers disagree about most."
          />
          <div className="mt-16">
            <IndexedList items={pricingFactors} columns={4} />
          </div>
          <p className="mt-12 max-w-[68ch] border-t border-[var(--rule)] pt-6 text-micro leading-relaxed text-muted">
            No premium figures appear on this page. Pricing is set by the issuing carrier and
            depends on underwriting, so any number published here would be a guess presented as a
            fact.
          </p>
        </Container>
      </Section>

      {/* ── 03 · Declined ──────────────────────────────────────────────── */}
      <Section tone="dark" id="declined">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5 lg:sticky lg:top-[calc(var(--chrome-top,8rem)+1.5rem)] lg:self-start">
              <span className="font-sans text-micro font-medium tabular-nums tracking-[0.1em] text-accent-light">
                03
              </span>
              <Display as="h2" size="h2" className="mt-6 max-w-[14ch]">
                What if I have been declined or rated before?
              </Display>
            </Reveal>

            <Reveal delay={60} className="lg:col-span-6 lg:col-start-7">
              <Prose tone="dark">
                <p>
                  A decline is one company&rsquo;s reading of one file against one set of filed
                  guidelines. It is not a verdict from the industry, and it does not make you
                  uninsurable.
                </p>
                <p>
                  Carriers genuinely disagree. A condition that one company treats as
                  disqualifying may be routine at another with more experience of it. Some insurers
                  build their business around profiles that others avoid.
                </p>
                <p>
                  The practical difference an independent brokerage makes here is simply that there
                  is somewhere else to go: the same file can be taken to a company whose guidelines
                  treat the situation differently, rather than resubmitted into the rulebook that
                  already declined it. Across <Token value={site.carrierCount} /> carriers, that is
                  a real option rather than a theoretical one.
                </p>
                <p>
                  What nobody can honestly promise is a different answer. Comparing carriers does
                  not guarantee approval, eligibility or any particular premium — it changes who is
                  reading the file, which is the only lever anyone actually has.
                </p>
              </Prose>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ── Type and carrier are two questions ─────────────────────────── */}
      <Section tone="paper">
        <Container>
          <Reveal>
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <Eyebrow tone="accent">The part people miss</Eyebrow>
                <Display as="h2" size="h2" className="mt-6 max-w-[16ch]">
                  Which type, and which company, are separate decisions.
                </Display>
              </div>
              <div className="lg:col-span-6 lg:col-start-7">
                <Prose>
                  <p>
                    Almost everything written about life insurance stops at the first question —
                    term or permanent, and how much. That is the easier half.
                  </p>
                  <p>
                    The second question is which company should receive the application, and it is
                    the one that changes the outcome for anyone whose file is not perfectly
                    straightforward. Two carriers offering the same kind of policy can assess the
                    same applicant differently, because each files its own guidelines about how to
                    read a health history.
                  </p>
                  <p>
                    Work out the first question here, on your own, with no pressure. The second is
                    what an independent brokerage is actually for.
                  </p>
                </Prose>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* ── PRODUCT LINES ───────────────────────────────────────────────
           TWO MODES, and which one renders is decided by an explicit flag,
           never by the mere presence of data.

           flags.productsConfirmed = false (today)
             The list is demonstration content. The heading says so, the copy
             describes the CATEGORY rather than claiming this firm places it,
             and a labelled note sits above the list. A fictional configuration
             cannot quietly read as a verified offering.

           flags.productsConfirmed = true
             Someone has confirmed the actual appointments. The section becomes
             the plain "what we place" treatment.
        -------------------------------------------------------------- */}
      {productLines.length > 0 && (
        <Section tone="alt">
          <Container>
            {flags.productsConfirmed ? (
              <SectionHeading eyebrow="What we place" title="The coverage we can arrange." />
            ) : (
              <SectionHeading
                eyebrow="Demonstration content"
                title="The three shapes life insurance comes in."
              />
            )}

            {!flags.productsConfirmed && (
              <div className="mt-8">
                <ProductionNote>
                  <strong className="font-medium">
                    These are category descriptions, not an offering.
                  </strong>{" "}
                  No product line has been confirmed for this business, so nothing here says what{" "}
                  <Token value={site.companyName} /> can place. Which of these a broker can actually
                  arrange depends on the carrier appointments they hold — confirm those first, then
                  set <code className="font-sans text-micro">flags.productsConfirmed</code> and this
                  section becomes a statement about the firm rather than about the category.
                </ProductionNote>
              </div>
            )}

            <div className="mt-16">
              <IndexedList
                columns={2}
                items={productLines.map((p, i) => ({
                  n: String(i + 1).padStart(2, "0"),
                  title: p.name,
                  body: p.summary,
                }))}
              />
            </div>
          </Container>
        </Section>
      )}

      <CtaBand
        title="Worked out the first question? We handle the second."
        body="Tell us what you have concluded so far — or nothing at all, if you would rather start from scratch. Either way the next step is a conversation, not an application."
      />
    </>
  );
}
