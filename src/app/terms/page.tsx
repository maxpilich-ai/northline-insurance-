import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { site } from "@/lib/site.config";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero, ProductionNote, Prose } from "@/components/ui/page";
import { Token } from "@/components/ui/Token";
import { BreadcrumbSchema } from "@/lib/schema";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMeta({
  title: "Terms & Accessibility",
  description:
    "Terms of use for this website, and our accessibility statement. Folded into one page rather than split across two.",
  path: "/terms",
});

/**
 * /terms — with the accessibility statement folded in.
 *
 * Same content as two separate routes, one fewer page to maintain. The
 * accessibility section is written from what the build actually does rather
 * than from a boilerplate conformance claim, because an overstated
 * accessibility statement is itself a liability.
 */

export default function TermsPage() {
  return (
    <>
      <BreadcrumbSchema trail={[{ name: "Home", path: "/" }, { name: "Terms & Accessibility", path: "/terms" }]} />
      <PageHero
        eyebrow="Legal"
        title="Terms of use, and accessibility."
        cta={false}
        standfirst={
          <>
            The rules for using this website, and an honest account of its accessibility. Effective{" "}
            <Token value={site.termsEffectiveDate} />.
          </>
        }
      />

      <Section tone="alt" size="sm">
        <Container>
          <div className="grid lg:grid-cols-12">
            <div className="lg:col-span-7 lg:col-start-4">
              <ProductionNote>
                <strong className="text-ink">Draft, pending legal review.</strong> The insurance
                disclaimers below are the operative part and should be checked against the
                advertising rules of every state in which he is licensed — the NAIC Advertising
                Model Regulation and state unfair-trade-practice statutes both bear on what a
                producer&rsquo;s website may say.
              </ProductionNote>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="paper">
        <Container>
          <div className="grid lg:grid-cols-12">
            <Reveal className="lg:col-span-7 lg:col-start-4">
              <Prose>
                <h2>Who operates this website</h2>
                <p>
                  This website is operated by <Token value={site.companyName} />, an independent
                  insurance brokerage licensed in <Token value={site.licenseStates} />. Licensing
                  details are published in the footer of every page and on the About page.
                </p>

                <h2>This website is not an offer of insurance</h2>
                <p>
                  Nothing on this website constitutes an offer of insurance, a binding quote, a
                  contract, or a guarantee of coverage or of any particular premium. Insurance
                  policies are issued by the insurance company named in the policy contract.
                  Coverage, premiums, terms and availability are determined by the issuing carrier
                  and are subject to underwriting. Not all applicants will qualify, and product
                  availability varies by state.
                </p>
                <p>
                  Any figures, ranges or timings described anywhere on this website are general
                  information about how the insurance market works. They are not a prediction of
                  what any individual will be offered.
                </p>

                <h2>No relationship with any government agency</h2>
                <p>
                  This website is not affiliated with, endorsed by, or sponsored by any government
                  agency or programme.
                </p>

                <h2>Where we can do business</h2>
                <p>
                  Insurance producers are licensed state by state. This website is intended for
                  residents of the states in which <Token value={site.companyName} /> holds a
                  license, currently <Token value={site.licenseStates} />. Submitting a form does
                  not create a broker-client relationship and does not oblige us to place coverage.
                </p>

                <h2>Accuracy of information</h2>
                <p>
                  We take care to keep this website accurate, but insurance products, carrier
                  underwriting guidelines and financial strength ratings change. Information here is
                  provided as general guidance and is not a substitute for advice about your own
                  circumstances from a licensed person.
                </p>

                <h2>Third-party links and embeds</h2>
                <p>
                  Where this website links to or embeds a third-party service — a scheduling tool, a
                  map — that service is governed by its own terms and privacy policy, not by ours.
                </p>

                <h2>Intellectual property</h2>
                <p>
                  The text, design and code of this website belong to{" "}
                  <Token value={site.companyName} />. Any insurance carrier name or mark referred to
                  remains the property of that company. We do not display a carrier&rsquo;s name or
                  mark unless that company has authorised it.
                </p>

                <h2>Limitation of liability</h2>
                <p>
                  This website is provided as-is. To the fullest extent permitted by law, we are not
                  liable for any loss arising from reliance on general information published here.
                  Nothing in these terms limits any liability that cannot lawfully be limited.
                </p>

                <h2>Contact</h2>
                <p>
                  Questions about these terms: <Token value={site.email} /> or{" "}
                  <Token value={site.phone} />.
                </p>
              </Prose>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ── Accessibility ─────────────────────────────────────────────── */}
      <Section tone="alt" id="accessibility">
        <Container>
          <div className="grid lg:grid-cols-12">
            <Reveal className="lg:col-span-7 lg:col-start-4">
              <h2 className="font-display text-h2 text-ink">Accessibility</h2>
              <div className="mt-8">
                <Prose>
                  <p>
                    This website is built to the Web Content Accessibility Guidelines 2.1 at level
                    AA. That is a design target we have worked to rather than a certification, and
                    we would rather describe what the site actually does than make a broad claim.
                  </p>

                  <h3>What has been done</h3>
                  <ul>
                    <li>
                      Every text and background pairing in the design system has been measured
                      against the AA contrast threshold, with the weakest combination at 5.69:1
                      against a required 4.5:1.
                    </li>
                    <li>
                      The whole site is operable by keyboard, and focus indicators are visible
                      throughout rather than suppressed.
                    </li>
                    <li>
                      Forms use visible labels rather than placeholder text, announce validation
                      errors, and move focus deliberately as you move between steps.
                    </li>
                    <li>
                      Expandable sections use native browser controls, so they work without
                      JavaScript and are announced correctly by screen readers.
                    </li>
                    <li>
                      Motion is limited to a single short fade, and is removed entirely when your
                      device is set to reduce motion.
                    </li>
                    <li>
                      Text reflows without horizontal scrolling down to a 320-pixel-wide viewport,
                      and form controls are large enough not to trigger zoom on a phone.
                    </li>
                  </ul>

                  <h3>Known limitations</h3>
                  <p>
                    Third-party embeds — a scheduling calendar or a map — are outside our control
                    and may not meet the same standard as the rest of the site. Where that affects
                    you, the telephone number is offered alongside every embed rather than beneath
                    it, and it is not a lesser route.
                  </p>

                  <h3>If something does not work</h3>
                  <p>
                    Tell us. Call <Token value={site.phone} /> or email <Token value={site.email} />.
                    A description of the problem and the device you are using is helpful but not
                    required.
                  </p>
                  <p>
                    <Token value={site.accessibilitySupportPractice} />
                  </p>
                </Prose>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>
    </>
  );
}
