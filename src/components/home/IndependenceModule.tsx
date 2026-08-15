import { site } from "@/lib/site.config";
import { Container, Display, Eyebrow, Section } from "@/components/ui/primitives";
import { Token } from "@/components/ui/Token";
import { Reveal } from "@/components/ui/Reveal";

/**
 * THE INDEPENDENCE MODULE — the core block of the entire site.
 *
 * Deliberately a sober comparison table, not three icon cards. Placed on the
 * dark ground so it reads as the page's anchor.
 *
 * COMPLIANCE: there is no pricing row and no savings row, by design. Every
 * comparison below is about MECHANISM — whose guidelines apply, what happens
 * on a decline, how many applications get completed. Nothing here promises an
 * outcome, a premium, or a saving.
 */

const rows = [
  {
    criterion: "Whose underwriting guidelines apply",
    single: "One company’s. That company’s rules are the only ones that matter.",
    independent: (
      <>
        Those of <Token value={site.carrierCount} /> companies. We submit where the guidelines fit
        the applicant.
      </>
    ),
  },
  {
    criterion: "If the application is declined",
    single: "The application ends there. Trying elsewhere means starting a new application.",
    independent:
      "We can take the same file to a carrier whose guidelines treat that situation differently.",
  },
  {
    criterion: "If the offer comes back rated differently than expected",
    single: "You accept the policy as issued, or begin again somewhere else.",
    independent:
      "We can compare how other carriers assess the same profile before you decide anything.",
  },
  {
    criterion: "How many applications you complete",
    single: "One for each company you approach.",
    independent: "One conversation covers the search.",
  },
];

export function IndependenceModule() {
  return (
    <Section tone="dark" id="independence">
      <Container>
        <Reveal>
          <Eyebrow tone="light">Why independence matters</Eyebrow>
          <Display as="h2" size="h2" className="mt-6 max-w-[20ch]">
            The same person can be assessed differently by different carriers.
          </Display>
          <p className="mt-7 max-w-measure text-body-lg text-muted-dark text-pretty">
            This is not a marketing distinction. It is how the industry is built: every carrier
            files its own underwriting guidelines, and those guidelines disagree with one another.
            Where you apply changes who is reading your file.
          </p>
        </Reveal>

        {/* ── Desktop: comparison table ─────────────────────────────────── */}
        <Reveal delay={60}>
          <table className="mt-16 hidden w-full border-collapse text-left md:table">
            <caption className="sr-only">
              Comparison of working with a single insurance carrier versus an independent brokerage
            </caption>
            <thead>
              <tr className="border-b border-[var(--rule-dark-strong)]">
                <th scope="col" className="w-[28%] pb-5 pr-8 align-bottom">
                  <span className="sr-only">Consideration</span>
                </th>
                <th scope="col" className="w-[33%] pb-5 pr-8 align-bottom">
                  <span className="text-eyebrow font-medium uppercase tracking-[0.14em] text-muted-dark">
                    With one carrier
                  </span>
                </th>
                <th scope="col" className="w-[39%] pb-5 align-bottom">
                  <span className="text-eyebrow font-medium uppercase tracking-[0.14em] text-accent-light">
                    With an independent brokerage
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.criterion} className="border-b border-[var(--rule-dark)] align-top">
                  <th scope="row" className="py-8 pr-8 font-display text-h4 font-normal text-on-dark">
                    {row.criterion}
                  </th>
                  <td className="py-8 pr-8 text-base text-muted-dark">{row.single}</td>
                  <td className="bg-[rgba(143,196,168,0.05)] px-6 py-8 text-base text-on-dark">
                    {row.independent}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>

        {/* ── Mobile: stacked ───────────────────────────────────────────── */}
        <div className="mt-12 md:hidden">
          {rows.map((row, i) => (
            <Reveal key={row.criterion} delay={i * 40}>
              <div className="border-t border-[var(--rule-dark)] py-8">
                <h3 className="font-display text-h4 text-on-dark">{row.criterion}</h3>
                <dl className="mt-5 space-y-5">
                  <div>
                    <dt className="text-eyebrow font-medium uppercase tracking-[0.14em] text-muted-dark">
                      With one carrier
                    </dt>
                    <dd className="mt-2 text-base text-muted-dark">{row.single}</dd>
                  </div>
                  <div className="border-l-2 border-accent-light pl-4">
                    <dt className="text-eyebrow font-medium uppercase tracking-[0.14em] text-accent-light">
                      With an independent brokerage
                    </dt>
                    <dd className="mt-2 text-base text-on-dark">{row.independent}</dd>
                  </div>
                </dl>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-12 max-w-[68ch] border-t border-[var(--rule-dark)] pt-6 text-micro leading-relaxed text-muted-dark">
          Underwriting outcomes depend on the applicant&rsquo;s individual circumstances and on each
          carrier&rsquo;s own guidelines. Comparing carriers does not guarantee approval, eligibility,
          or any particular premium.
        </p>
      </Container>
    </Section>
  );
}
