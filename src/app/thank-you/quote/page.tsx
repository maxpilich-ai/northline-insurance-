import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { ThankYou } from "@/components/ThankYou";
import { site } from "@/lib/site.config";
import { IfResolved, Token } from "@/components/ui/Token";

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
  title: "Request received",
  description: "Your quote request has been received. Here is what happens next.",
  path: "/thank-you/quote",
  indexable: false,
});

export default function ThankYouQuotePage() {
  return (
    <ThankYou
      eyebrow="Request received"
      title="Thank you — that is with us."
      body="Nothing has been submitted to an insurance company. The next step is a conversation, not an application."
      next={[
        {
          label: "We review what you sent",
          // Response time is a business commitment, not a given — the sentence
          // appears only once he confirms one.
          detail: (
            <>
              <IfResolved values={[site.initialResponseTime]}>
                <Token value={site.initialResponseTime} />{" "}
              </IfResolved>
              If anything is unclear we will ask rather than guess.
            </>
          ),
        },
        {
          label: "We contact you",
          detail:
            "To fill in the detail a web form is the wrong place for — health history in particular.",
        },
        {
          label: "You get options to compare",
          detail:
            "Presented side by side, with the differences explained plainly. You are under no obligation at any point.",
        },
      ]}
    />
  );
}
