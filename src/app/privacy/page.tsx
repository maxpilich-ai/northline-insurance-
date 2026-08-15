import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { site } from "@/lib/site.config";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero, ProductionNote, Prose } from "@/components/ui/page";
import { CONSUMER_CONSENT_VERSION, AGENT_CONSENT_VERSION } from "@/lib/leads";
import { Token } from "@/components/ui/Token";
import { BreadcrumbSchema } from "@/lib/schema";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMeta({
  title: "Privacy Policy",
  description:
    "How this website collects, uses and safeguards the information you provide.",
  path: "/privacy",
});

/**
 * /privacy
 *
 * A real structure with real substance — not a template with the company name
 * left in. But it is a DRAFT: a privacy policy makes binding commitments about
 * business practices, and those commitments have to come from the business,
 * reviewed by counsel or the E&O carrier.
 *
 * Anywhere the policy would otherwise state a practice we cannot verify, it
 * carries a token instead. The most consequential of those is what happens to
 * enquiry data — see {{DATA_SHARING_PRACTICE}}.
 */

export default function PrivacyPage() {
  return (
    <>
      <BreadcrumbSchema trail={[{ name: "Home", path: "/" }, { name: "Privacy Policy", path: "/privacy" }]} />
      <PageHero
        eyebrow="Legal"
        title="Privacy policy."
        cta={false}
        standfirst={
          <>
            How information submitted through this website is collected, used and safeguarded.
            Effective <Token value={site.privacyEffectiveDate} />.
          </>
        }
      />

      <Section tone="alt" size="sm">
        <Container>
          <div className="grid lg:grid-cols-12">
            <div className="lg:col-span-7 lg:col-start-4">
              <ProductionNote>
                <strong className="text-ink">This is a working draft, not a final policy.</strong>{" "}
                The technical statements below describe what the site actually does, and have been
                checked against the code. The commitments about business practice — retention
                periods, who may access an enquiry, and what happens to it afterwards — are held as
                placeholders until the business confirms them, and the policy should be reviewed by
                counsel or the errors-and-omissions carrier before launch. For an insurance producer
                the operative regimes are GLBA as implemented through state insurance regulators
                (NAIC Model #672) and state insurance data-security law (NAIC Model #668), rather
                than the general consumer-privacy statutes, most of which carry thresholds a small
                brokerage will not meet.
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
                <h2>Who we are</h2>
                <p>
                  <Token value={site.companyName} /> is an independent insurance brokerage with its
                  principal office at <Token value={site.officeAddress} />. Questions about this
                  policy can be sent to <Token value={site.privacyContactEmail} /> or raised by
                  telephone on <Token value={site.phone} />.
                </p>

                <h2>What this website collects</h2>
                <p>
                  Two things: what you type into a form, and a small amount of technical
                  information that arrives with the request itself. Taking them in turn.
                </p>
                <h3>What you submit</h3>
                <ul>
                  <li>
                    <strong>Contact details</strong> — your name, email address and telephone
                    number, and your stated preference for when to be contacted.
                  </li>
                  <li>
                    <strong>Basic underwriting-relevant facts</strong> — your age, sex as it would
                    appear on an application, state of residence, whether you use tobacco, and a
                    single self-rated description of your health.
                  </li>
                  <li>
                    <strong>What you are trying to cover</strong> — the situation you selected and
                    an approximate coverage range, plus anything you choose to write in the optional
                    notes field.
                  </li>
                </ul>
                <p>
                  The <strong>contact form</strong> asks for your name, email address, an optional
                  telephone number, a reason for writing, and your message.
                </p>
                <p>
                  The <strong>producer application</strong> is for people applying to work with us
                  and asks for different things: your name, email address and telephone number, the
                  states you are licensed in, your licensing status and — if you are already
                  licensed — your producer licence number, your years of experience, any current
                  affiliation, your availability, an optional link to a r&eacute;sum&eacute; or
                  professional profile, and whatever you write about why you are applying.
                </p>

                <h3>What the request itself records</h3>
                <p>
                  When any form is submitted, our server records the time it arrived and the page
                  the form was on. The page is worked out on our side from which form you used —
                  not taken from your browser.
                </p>
                <p>
                  Two further items are kept <strong>only for the quote form and the producer
                  application</strong>, because they exist to support the consent record those two
                  forms create: your browser&rsquo;s user-agent string, and — clearly marked as
                  unverified — what your browser said the page was, which comes from the referrer
                  header and is discarded unless it matches this website. The contact form creates
                  no consent record, so neither is kept for it.
                </p>
                <p>
                  <strong>Your IP address is recorded only when this deployment is behind a proxy
                  it trusts to report it.</strong> Where that is not configured — which is the
                  default — the consent record stores no address at all, together with a note
                  saying why, rather than an address we cannot stand behind. The record is explicit
                  about which of the two happened.
                </p>
                <p>
                  A value derived from the request is also used, in memory and briefly, to limit
                  how many submissions arrive from one source in a minute. It is stored as a
                  one-way hash rather than as an address, and it is discarded within the minute.
                </p>

                <h3>Consent evidence</h3>
                <p>
                  Where a form asks for your consent to be contacted, the record we keep is the
                  exact wording shown on that page, held on our server rather than taken from your
                  browser, together with its version identifier, the time, the page as our server
                  derived it, and the IP address where one was recorded. The quote form uses{" "}
                  <code className="text-ink">{CONSUMER_CONSENT_VERSION}</code>; the producer
                  application, which asks about something different, uses{" "}
                  <code className="text-ink">{AGENT_CONSENT_VERSION}</code>. The contact form asks
                  for no marketing consent and no consent record is created for it.
                </p>

                <h3>What the forms on this website do not ask for</h3>
                <p>
                  None of the forms asks for detailed health information — conditions,
                  medications, height and weight, or family history — and none asks for a Social
                  Security number, a full date of birth, or financial account details. The one
                  government-issued identifier any form asks for is a producer licence number, on
                  the application to work with us, from applicants who are already licensed. Our preference is for that kind of detail to be gathered by a licensed
                  person on a call rather than typed into a web page.
                </p>

                <h2>How the information is used</h2>
                <ul>
                  <li>To respond to your enquiry and prepare a comparison of carrier options.</li>
                  <li>
                    To contact you by the means you consented to, about the enquiry you submitted.
                  </li>
                  <li>
                    To submit an application to an insurance carrier, if and when you decide to
                    proceed. Carriers then handle your information under their own privacy notices.
                  </li>
                  <li>
                    To meet record-keeping obligations that apply to licensed insurance producers.
                  </li>
                </ul>

                <h2>Who the information is shared with</h2>
                <p>
                  <Token value={site.dataSharingPractice} />
                </p>
                <p>
                  Separately from the above, information is necessarily shared with the insurance
                  carrier to which an application is submitted, and with the service providers that
                  operate this website and deliver our email. Information may also be disclosed
                  where required by law or by a regulator.
                </p>

                <h2>Telephone and text messages</h2>
                <p>
                  If you provide a telephone number and give consent, we may contact you at that
                  number about your enquiry, including by automated means and by text message.
                  Consent is never a condition of purchase. You can withdraw consent at any time by
                  replying STOP to a text message, or by telling us on a call — the office number
                  is on every page of this site.
                </p>
                <ProductionNote>
                  A third route — &ldquo;or by emailing us&rdquo; — was removed rather than left
                  standing (finding R3-M5): the office email address is still an unfilled
                  placeholder, so the sentence directed people to withdraw consent at an address
                  that does not exist. It goes back in when there is an inbox behind it. This
                  section also deliberately does not promise that an opt-out is propagated across
                  every channel automatically, because that mechanism is not built. From 31 January
                  2027 the FCC&rsquo;s global revocation rule (47 CFR § 64.1200(a)(10)) will require
                  an opt-out given on one topic to be applied to all future robocalls and robotexts
                  from the same caller. Re-verify that date before launch — it has moved more than
                  once — and implement the propagation before the wording here changes.
                </ProductionNote>

                <h2>Where a submission goes, and how long it is kept</h2>
                <p>
                  A submission is sent to the brokerage by whichever delivery routes this
                  deployment has configured — email, a record system, or both. If none is
                  configured, or if none can be reached, the submission is not accepted at all: the
                  form reports an error and offers the telephone number, rather than appearing to
                  succeed while the enquiry goes nowhere.
                </p>
                <p>
                  How long records are then kept is set by the business:
                </p>
                <p>
                  <Token value={site.retentionPeriod} />
                </p>
                <ProductionNote>
                  A retention period has not yet been set. Two constraints pull in opposite
                  directions: consent evidence is worth keeping for as long as the relevant
                  limitation period, while enquiry data that never became a client should not be
                  held indefinitely. This should be settled with counsel and stated here as a real
                  period before launch.
                </ProductionNote>

                <h2>Security</h2>
                <p>
                  This site is served over HTTPS. Form submissions are validated on the server as
                  well as in the browser, rate-limited by IP address, and screened by a hidden
                  field that ordinary visitors never see. Consent evidence is assembled on the
                  server from its own records rather than from anything the browser sends, so it
                  cannot be altered by editing the page. Submitted details are never written to our
                  application logs. No system is perfectly secure, and we do not claim otherwise.
                </p>
                <p>
                  <Token value={site.dataAccessPractice} />
                </p>

                <h2>Cookies, storage and analytics</h2>
                <p>
                  This website does not use advertising cookies and does not run third-party
                  advertising trackers. If analytics are enabled, they are configured to measure
                  page traffic rather than to build a profile of you across other websites.
                </p>
                <p>
                  The quote form keeps a partial draft in your browser&rsquo;s session storage as
                  you move between steps, so a refresh does not cost you the answers you have
                  already given. That draft includes every answer the form holds at that moment —
                  not only what you have typed, such as your name, email address and telephone
                  number, but also what you have selected, including your age, sex, state, whether
                  you use tobacco and your self-rated health. It stays on your own device, is never
                  sent anywhere until you submit the form, is erased as soon as a submission
                  succeeds, and is discarded by the browser when you close the tab.
                </p>

                <h2>Your choices</h2>
                <ul>
                  <li>Ask us to stop contacting you, at any time, by any reasonable means.</li>
                  <li>
                    Ask what information we hold about you, and ask us to correct anything
                    inaccurate.
                  </li>
                  <li>
                    Ask us to delete an enquiry, subject to any record-keeping obligation that
                    applies to a licensed producer.
                  </li>
                </ul>

                <h2>Children</h2>
                <p>
                  This website is not directed to children and we do not knowingly collect
                  information from anyone under 18.
                </p>

                <h2>Changes</h2>
                <p>
                  If this policy changes materially, the effective date at the top of the page will
                  change with it.
                </p>
              </Prose>
            </Reveal>
          </div>
        </Container>
      </Section>
    </>
  );
}
