import Link from "next/link";
import { flags, isEmailAddress, isResolved, routes, site } from "@/lib/site.config";
import { Container, Rule, Section } from "@/components/ui/primitives";
import { Token } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { Wordmark } from "@/components/ui/Wordmark";

const columns = [
  {
    heading: "The Firm",
    links: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "Coverage", href: "/coverage" },
      { label: "Carriers", href: "/carriers" },
      { label: "About", href: "/about" },
      { label: "Frequently Asked Questions", href: "/faq" },
    ],
  },
  {
    heading: "Get Started",
    links: [
      { label: "Get Your Quote", href: routes.quote },
      { label: "Book a Call", href: routes.schedule },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function Footer() {
  return (
    <Section as="footer" tone="dark" size="none" className="pb-24 pt-section-sm lg:pb-14">
      <Container>
        {/* ── Masthead + navigation ───────────────────────────────────────── */}
        <div className="grid gap-14 md:grid-cols-12">
          <div className="md:col-span-5 lg:col-span-4">
            <Wordmark tone="dark" withDescriptor />
            <p className="mt-6 max-w-measure-tight font-display text-h4 text-on-dark text-pretty">
              {site.tagline}
            </p>
            <p className="mt-5 max-w-measure-tight text-small text-muted-dark">
              An independent brokerage. We are not tied to a single insurance company, so we can
              compare how different carriers assess the same applicant.
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-3 md:col-span-7 lg:col-span-8 lg:pl-8">
            {columns.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <h2 className="text-eyebrow font-medium uppercase tracking-[0.14em] text-muted-dark">
                  {col.heading}
                </h2>
                <ul className="mt-5 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="text-small text-on-dark transition-colors hover:text-accent-light"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            <div>
              <h2 className="text-eyebrow font-medium uppercase tracking-[0.14em] text-muted-dark">
                Office
              </h2>
              <address className="mt-5 space-y-3 text-small not-italic text-on-dark">
                <p>
                  <Token value={site.officeAddress} />
                </p>
                <p>
                  <PhoneLink className="transition-colors hover:text-accent-light" tone="dark"><Token value={site.phone} /></PhoneLink>
                </p>
                <p>
                  {isEmailAddress(site.email) ? (
                    <a
                      href={`mailto:${site.email}`}
                      className="transition-colors hover:text-accent-light"
                    >
                      <Token value={site.email} />
                    </a>
                  ) : (
                    <Token value={site.email} />
                  )}
                </p>
                <p className="text-muted-dark">
                  <Token value={site.officeHours} />
                </p>
              </address>
            </div>
          </div>
        </div>

        <Rule tone="dark" className="my-12" />

        {/* ── Licensing & disclosures ─────────────────────────────────────────
             Requirements are state-specific. Even where not strictly mandated,
             regulators recommend publishing business name, address, states of
             licensure, license type and number. Verify with counsel before
             launch. Folded in here rather than given its own route — unless the
             state list outgrows a footer block. ------------------------------ */}
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-3">
            <h2 className="text-eyebrow font-medium uppercase tracking-[0.14em] text-muted-dark">
              Licensing &amp; Disclosures
            </h2>
            {flags.demo && (
              <p className="mt-4 max-w-[34ch] border-l-2 border-accent-light-rule pl-4 text-micro leading-relaxed text-muted-dark">
                <span className="font-medium text-accent-light">Demonstration content.</span> The
                details below are illustrative. No licence number or National Producer Number is
                shown, because inventing a government-issued identifier is the one placeholder a
                prototype must never fake.
              </p>
            )}
          </div>

          <div className="md:col-span-9">
            <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { term: "Licensed entity", value: site.companyName },
                {
                  term: flags.demo ? "States of licensure · demo" : "States of licensure",
                  value: site.licenseStates,
                },
                { term: "Resident license no.", value: site.residentLicense },
                { term: "National Producer No.", value: site.npn },
                { term: "Agency license no.", value: site.agencyLicense },
                { term: "Principal office", value: site.officeAddress },
              ].map((row) => (
                <div key={row.term}>
                  <dt className="text-micro uppercase tracking-[0.08em] text-muted-dark">
                    {row.term}
                  </dt>
                  <dd className="mt-1 text-small tabular-nums text-on-dark">
                    <Token value={row.value} />
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 max-w-[62ch] space-y-4 text-micro leading-relaxed text-muted-dark">
              <p>
                <Token value={site.companyName} /> is an independent insurance brokerage. Policies
                are issued by the insurance company named in the policy contract. Coverage,
                premiums, terms and availability are determined by the issuing carrier and are
                subject to underwriting approval. Not all applicants will qualify.
              </p>
              <p>
                Nothing on this website constitutes an offer of insurance, a binding quote, or a
                guarantee of coverage or of any particular premium. Product availability varies by
                state. This website is not affiliated with or endorsed by any government agency.
              </p>
              <p>
                This site is intended for residents of the states in which{" "}
                <Token value={site.companyName} /> is licensed.
              </p>
            </div>
          </div>
        </div>

        <Rule tone="dark" className="my-10" />

        <div className="flex flex-col-reverse gap-6 text-micro text-muted-dark sm:flex-row sm:items-center sm:justify-between">
          {/* No founding year has been supplied, so the range degrades to a
              single year rather than printing a placeholder into a copyright
              line — the one place a visible token looks like a bug. */}
          <p className="tabular-nums">
            ©{" "}
            {isResolved(site.yearFounded) && (
              <>
                <Token value={site.yearFounded} />–
              </>
            )}
            2026 <Token value={site.companyName} />. All rights reserved.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-7 gap-y-3">
            <Link href="/privacy" className="transition-colors hover:text-on-dark">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-on-dark">
              Terms &amp; Accessibility
            </Link>
            <Link
              href={routes.careers}
              className="group transition-colors hover:text-accent-light"
            >
              For Agents{" "}
              <span
                aria-hidden="true"
                className="inline-block transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          </nav>
        </div>
      </Container>
    </Section>
  );
}
