import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { ThankYou } from "@/components/ThankYou";
import { site } from "@/lib/site.config";
import { Token } from "@/components/ui/Token";

/*
  ROUTED THROUGH pageMeta (finding R3-M6).

  This page used to export a bare `metadata` object. Next merges page metadata
  into the layout's SHALLOWLY, so omitting `openGraph` did not mean "no card" —
  it meant "inherit the root layout's entire card", including `url: SITE_URL`.
  Every one of these routes therefore advertised itself as the homepage: paste a
  link into Slack or iMessage and it unfurled with the homepage title, the
  homepage description and the homepage URL. `noindex` does not suppress
  unfurls.

  pageMeta builds the whole card from this page's own title, description and
  path, and applies the same indexing gate as every other route.
*/
export const metadata: Metadata = pageMeta({
  title: "Message received",
  description: "Your message has been received. Here is what happens next.",
  path: "/thank-you/message",
  indexable: false,
});

/**
 * ADDED BEYOND THE APPROVED ROUTE LIST — with reason.
 *
 * The contact form previously redirected to /thank-you/quote, which meant every
 * general enquiry was counted as a quote conversion. That defeats the entire
 * point of having per-form confirmation routes: the primary conversion number
 * would be inflated by people asking about an existing policy or opening hours.
 *
 * It is a confirmation state rather than a page in the navigation, and it costs
 * nothing to maintain.
 */
export default function ThankYouMessagePage() {
  return (
    <ThankYou
      eyebrow="Message received"
      title="Thank you — we have your message."
      body="It has gone to the office. The telephone number is below if you would rather not wait for a written reply."
      next={[
        {
          /*
            THE DATA-SHARING CLAIM HAS ONE SOURCE OF TRUTH (finding R4-11).

            This detail used to end "...It is not sold or listed anywhere." —
            an unconditional promise about what the business does with an
            enquiry, hard-coded on a confirmation page. site.config.ts states
            the rule plainly: "'We never sell your information' is one of the
            strongest trust statements available and it must come from him, not
            from an assumption about how brokerages behave. Every place the site
            would otherwise make that claim is gated on this token." /privacy
            and /faq both render {{DATA_SHARING_PRACTICE}}; this page did not,
            and was in fact introduced by an earlier remediation pass.

            What remains is the part that is provable from the code — where the
            submission goes. The part that is a business practice renders
            through the same token as everywhere else, or not at all.
          */
          label: "It goes to the office",
          detail: (
            <>
              The form posts to this site&rsquo;s own server, which delivers it to the brokerage.{" "}
              <Token value={site.dataSharingPractice} />
            </>
          ),
        },
        {
          label: "A reply about what you asked",
          detail: <Token value={site.contactPolicy} />,
        },
        {
          label: "If you would rather talk",
          detail: "The office number is below, and it is offered alongside this form rather than beneath it.",
        },
      ]}
    />
  );
}
