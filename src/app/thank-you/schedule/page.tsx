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
  title: "Call booked",
  description: "Your call is booked. Here is what happens next.",
  path: "/thank-you/schedule",
  indexable: false,
});

export default function ThankYouSchedulePage() {
  return (
    <ThankYou
      eyebrow="Booked"
      title="Your call is in the diary."
      body="We will confirm the time and send the details before the call."
      next={[
        {
          label: "Have a rough idea of the numbers",
          detail:
            "Who depends on your income, roughly what you owe, and anything already in place. Round figures are fine.",
        },
        {
          label: "We talk it through",
          detail:
            "We work out what is actually needed, and what it would take to arrange.",
        },
        {
          label: "Nothing is committed",
          detail:
            "The call is a conversation, not an application. You decide afterwards whether to go further.",
        },
      ]}
    />
  );
}
