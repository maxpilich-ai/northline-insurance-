import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { ThankYou } from "@/components/ThankYou";

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
  title: "Application received",
  description: "Your producer application has been received. Here is what happens next.",
  path: "/thank-you/apply",
  indexable: false,
});

export default function ThankYouApplyPage() {
  return (
    <ThankYou
      eyebrow="Application received"
      title="Thanks — we have your details."
      body="Your application is recorded as a producer application, not a client enquiry."
      showPhone={false}
      next={[
        {
          label: "We review the application",
          detail: "Including your licensing status and the states you are asking about.",
        },
        {
          label: "A conversation, if it looks like a fit",
          detail: "Covering how you work, which states, and what you are looking for.",
        },
        {
          label: "The contract terms",
          detail:
            "Some are set out on the agent page. The rest are covered directly, before either side commits to anything.",
        },
      ]}
    />
  );
}
