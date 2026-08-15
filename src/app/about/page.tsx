import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { isResolved, site } from "@/lib/site.config";
import { Container, Display, Eyebrow, Section } from "@/components/ui/primitives";
import {
  CtaBand,
  PageHero,
  ProductionNote,
  Prose,
  SectionHeading,
} from "@/components/ui/page";
import { Token, IfResolved } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { BreadcrumbSchema } from "@/lib/schema";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMeta({
  title: "About",
  description:
    "An independent life insurance brokerage — who runs it, how it works with clients, and the licensing details.",
  path: "/about",
});

/**
 * /about
 *
 * The team content is folded in here rather than given a standalone /team
 * route, per Max's decision. A two-person grid with no photographs undercuts
 * the exact impression a team page exists to create; a paragraph about how the
 * organisation is structured does not.
 *
 * If real headshots and bios arrive later, the "Organisation" section below is
 * the seed for promoting /team back to its own route.
 */

export default function AboutPage() {
  const accountReady = isResolved(site.ownerAccount);
  const teamReady = isResolved(site.teamDescription);

  return (
    <>
      <BreadcrumbSchema trail={[{ name: "Home", path: "/" }, { name: "About", path: "/about" }]} />
      <PageHero
        eyebrow="The firm"
        title="An independent brokerage, run out of one office."
        standfirst={site.positioning}
      />

      {/* ── The owner ──────────────────────────────────────────────────── */}
      <Section tone="alt">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5">
              <PhotoSlot
                label="The owner, in the office"
                brief="Environmental portrait, natural light, at his own desk. The same photograph used on the homepage — shoot both plates in one session."
                ratio="4 / 5"
              />
            </Reveal>

            <Reveal delay={60} className="lg:col-span-6 lg:col-start-7">
              <Eyebrow tone="accent">Who runs it</Eyebrow>
              <Display as="h2" size="h2" className="mt-6 max-w-[16ch]">
                <Token value={site.ownerName} />
              </Display>
              <p className="mt-3 text-body text-muted">
                <Token value={site.ownerTitle} />
              </p>

              <div className="mt-9">
                <Prose>
                  <p className={accountReady ? undefined : "text-ink"}>
                    <Token value={site.ownerAccount} />
                  </p>
                </Prose>

                {!accountReady && (
                  <ProductionNote>
                    Several paragraphs in his own words — longer than the homepage note. Ask him
                    openly how he ended up running the business and how he prefers to work with
                    clients, and keep his phrasing. Do not write a &ldquo;why I went
                    independent&rdquo; arc for him: we know he owns the brokerage, not that he
                    founded it or that he was previously captive.
                  </ProductionNote>
                )}
              </div>

              {/* Credentials render only when supplied. Nothing is assumed. */}
              <IfResolved values={[site.designations]}>
                <div className="mt-10 border-t border-[var(--rule)] pt-7">
                  <Eyebrow>Professional designations</Eyebrow>
                  <p className="mt-3 text-body text-ink">
                    <Token value={site.designations} />
                  </p>
                </div>
              </IfResolved>

              <IfResolved values={[site.associations]}>
                <div className="mt-7 border-t border-[var(--rule)] pt-7">
                  <Eyebrow>Memberships</Eyebrow>
                  <p className="mt-3 text-body text-ink">
                    <Token value={site.associations} />
                  </p>
                </div>
              </IfResolved>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ── What the firm does, and does not do ────────────────────────── */}
      <Section tone="paper">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5 lg:sticky lg:top-[calc(var(--chrome-top,8rem)+1.5rem)] lg:self-start">
              <Eyebrow tone="accent">Scope</Eyebrow>
              <Display as="h2" size="h2" className="mt-6 max-w-[14ch]">
                What we do, and what we do not.
              </Display>
            </Reveal>

            <Reveal delay={60} className="lg:col-span-6 lg:col-start-7">
              <Prose>
                <h3>What we do</h3>
                <ul>
                  <li>
                    Work out how much coverage a situation actually calls for, from the arithmetic
                    rather than from a script.
                  </li>
                  <li>
                    Take that profile to the insurance carriers whose underwriting guidelines suit
                    it, rather than to a single company.
                  </li>
                  <li>
                    Present the options side by side and explain the differences in plain terms,
                    including the ones that are not in our favour.
                  </li>
                  <li>
                    Submit the application to the carrier and explain what underwriting will
                    involve, so the weeks that follow are not a black box.
                  </li>
                  <li>
                    Go through the issued policy with you and confirm the beneficiary details are
                    right.
                  </li>
                </ul>

                <h3>What we do not</h3>
                <ul>
                  <li>
                    Issue policies. Insurance companies do that. We arrange the coverage; the
                    carrier underwrites it, issues it and pays the claim.
                  </li>
                  <li>
                    Promise an outcome. No broker can guarantee approval, a rate class, or a
                    premium, and anyone who does is describing a hope as a fact.
                  </li>
                </ul>
              </Prose>

              {/* Renders only once he has confirmed how enquiry data is handled.
                  "We never sell your information" is one of the strongest trust
                  statements available — and it has to be his statement. */}
              <IfResolved values={[site.dataSharingPractice]}>
                <div className="mt-9 border-t border-[var(--rule)] pt-7">
                  <Eyebrow>What happens to your information</Eyebrow>
                  <p className="mt-3 max-w-measure text-body text-muted">
                    <Token value={site.dataSharingPractice} />
                  </p>
                </div>
              </IfResolved>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ── The office ─────────────────────────────────────────────────── */}
      <Section tone="alt">
        <Container>
          <SectionHeading
            eyebrow="Where we work"
            title="A real office, with a real address."
            standfirst="It sounds like a low bar. In an industry with a great many websites and comparatively few premises, it is worth showing."
          />
          <Reveal delay={60}>
            <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-7">
                <PhotoSlot
                  label="The office interior"
                  brief="Wide, natural light, shot on the same day as the portrait. Somewhere a client would actually sit. No stock interiors — an obviously generic boardroom is worse than an honest frame."
                  ratio="16 / 10"
                />
              </div>
              <div className="lg:col-span-4 lg:col-start-9 lg:self-center">
                <address className="space-y-5 not-italic">
                  <div>
                    <Eyebrow>Address</Eyebrow>
                    <p className="mt-2 text-body text-ink">
                      <Token value={site.officeAddress} />
                    </p>
                  </div>
                  <div className="border-t border-[var(--rule)] pt-5">
                    <Eyebrow>Hours</Eyebrow>
                    <p className="mt-2 text-body text-ink">
                      <Token value={site.officeHours} />
                    </p>
                  </div>
                  <div className="border-t border-[var(--rule)] pt-5">
                    <Eyebrow>Telephone</Eyebrow>
                    <p className="mt-2 text-body">
                      <PhoneLink className="inline-block py-1 text-ink underline decoration-[var(--rule-strong)] underline-offset-[6px] transition-colors hover:decoration-ink"><Token value={site.phone} /></PhoneLink>
                    </p>
                  </div>
                </address>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* ── The organisation (team content, folded in) ─────────────────── */}
      <Section tone="paper" id="organisation">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5">
              <Eyebrow tone="accent">The organisation</Eyebrow>
              {/*
                THE HEADING WAS THE LAST UNGATED COPY OF THE CLAIM (finding R4-05).

                It read "Licensed producers work under the brokerage." — a
                plural factual assertion about how many state-licensed people
                staff a real insurance business, rendered as ordinary prose with
                no token and no gate, directly above a `teamSize` token and a
                `teamDescription` token that were both correctly gated. The
                demonstration banner enumerates what is illustrative and does
                not mention team structure, so nothing qualified it.

                The heading now describes the SECTION rather than asserting its
                contents; the substance appears only once the owner supplies it.
              */}
              <Display as="h2" size="h2" className="mt-6 max-w-[16ch]">
                How the organisation is structured.
              </Display>
            </Reveal>

            <Reveal delay={60} className="lg:col-span-6 lg:col-start-7">
              <Prose>
                {/*
                  NOTHING IS ASSERTED HERE UNTIL IT IS CONFIRMED (finding R3-H6).

                  This block used to open with a bare "This is not a one-person
                  operation. Other licensed producers work under the
                  organisation." — a statement about how a real insurance
                  business is staffed, published as plain prose, resting on a
                  source-code comment rather than on anything a reader could
                  check. It sat directly above a "Licensed producers — 6"
                  figure. Neither was covered by the demonstration banner, which
                  enumerates what is illustrative and does not mention team
                  structure.

                  The organisational description is a token like every other
                  unverified business fact, and the paragraph now renders only
                  once that token is filled in. Until then this column shows the
                  production note below, which asks for exactly the material
                  that would let it render.
                */}
                <IfResolved values={[site.teamDescription]}>
                  <p>
                    <Token value={site.teamDescription} />
                  </p>
                </IfResolved>
              </Prose>

              <IfResolved values={[site.teamSize]}>
                <div className="mt-9 border-t border-[var(--rule)] pt-7">
                  <Eyebrow>Licensed producers</Eyebrow>
                  <p className="mt-2 font-display text-h2 tabular-nums text-ink">
                    <Token value={site.teamSize} />
                  </p>
                </div>
              </IfResolved>

              {!teamReady && (
                <ProductionNote>
                  Team content lives here rather than on a standalone{" "}
                  <code className="text-ink">/team</code> page, by your decision — a thin roster
                  grid undercuts the impression it exists to create. Needed to fill this out: how
                  the organisation is structured, how many licensed producers, and how work is
                  allocated. If real headshots, bios, license states and NPNs arrive later, this
                  section is the seed for promoting <code className="text-ink">/team</code> back to
                  its own route.
                </ProductionNote>
              )}
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ── Licensing ──────────────────────────────────────────────────── */}
      <Section tone="dark" id="licensing">
        <Container>
          <SectionHeading
            tone="dark"
            eyebrow="Licensing"
            title="Who we are, formally."
            standfirst="Insurance producers are licensed by state. These are the details that let you verify us with a regulator rather than take our word for it."
          />

          <Reveal delay={60}>
            <dl className="mt-14 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { term: "Licensed entity", value: site.companyName },
                { term: "Doing business as", value: site.dbaName },
                { term: "States of licensure", value: site.licenseStates },
                { term: "Resident license number", value: site.residentLicense },
                { term: "Agency license number", value: site.agencyLicense },
                { term: "National Producer Number", value: site.npn },
              ].map((row) => (
                <div key={row.term} className="border-t border-[var(--rule-dark)] pt-5">
                  <dt className="text-micro uppercase tracking-[0.08em] text-muted-dark">
                    {row.term}
                  </dt>
                  <dd className="mt-2 font-display text-h4 tabular-nums text-on-dark">
                    <Token value={row.value} />
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <p className="mt-14 max-w-[68ch] border-t border-[var(--rule-dark)] pt-6 text-micro leading-relaxed text-muted-dark">
            Licensing disclosure requirements are set by state and should be confirmed with counsel
            or an errors-and-omissions carrier before launch. Where a state requires a license
            number to appear in particular communications, this block and the site footer are the
            two places it is published.
          </p>
        </Container>
      </Section>

      <CtaBand />
    </>
  );
}
