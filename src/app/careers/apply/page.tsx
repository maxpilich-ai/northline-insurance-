import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { routes } from "@/lib/site.config";
import {
  Arrow,
  Container,
  Display,
  Eyebrow,
  Section,
  TextLink,
} from "@/components/ui/primitives";
import { AgentForm } from "@/components/forms/AgentForm";
import { BreadcrumbSchema } from "@/lib/schema";
import { Reveal } from "@/components/ui/Reveal";

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
  title: "Producer Application",
  description: "Apply to work as a licensed producer with an independent life insurance brokerage.",
  path: routes.apply,
  indexable: false,
});

export default function ApplyPage() {
  return (
    <>
      <BreadcrumbSchema trail={[{ name: "Home", path: "/" }, { name: "For Agents", path: "/careers" }, { name: "Producer Application", path: "/careers/apply" }]} />
    <Section size="none" className="pb-section pt-14 md:pt-20">
      <Container>
        <Reveal>
          <TextLink href={routes.careers} className="text-small text-muted">
            <span aria-hidden="true">←</span> Back to the agent page
          </TextLink>
          <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-7">
              <Eyebrow tone="accent">Producer application</Eyebrow>
              <Display as="h1" size="h1" className="mt-6 max-w-[15ch]">
                Tell us where you are, and what you are looking for.
              </Display>
            </div>
            <p className="max-w-measure text-body-lg text-muted text-pretty lg:col-span-5 lg:self-end">
              A few minutes, and it is recorded as a producer application rather than a client
              enquiry.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-7">
            <AgentForm />
          </Reveal>

          <Reveal delay={60} className="lg:col-span-4 lg:col-start-9">
            <div className="lg:sticky lg:top-[calc(var(--chrome-top,8rem)+1.5rem)]">
              <div className="border border-[var(--rule)] bg-paper-alt-wash p-8">
                <Eyebrow>Before you apply</Eyebrow>
                <p className="mt-5 text-base text-muted">
                  Some of the contract terms are set out on the agent page rather than held back
                  until a call. Read those first — it is a faster filter for both sides. Anything
                  not covered there is discussed directly.
                </p>
                <div className="mt-7 border-t border-[var(--rule)] pt-6">
                  <TextLink href={`${routes.careers}#terms`} className="text-small">
                    What we publish up front <Arrow />
                  </TextLink>
                </div>
              </div>

              {/*
                WAS FALSE, NOW DESCRIBES THE CODE (finding R3-H5).

                This paragraph read: "Applications are submitted to a different
                endpoint from client enquiries and are tracked separately, so
                recruiting never shows up in the consumer conversion figures."

                Both halves were untrue. All three forms POST to the same
                /api/lead route (ContactForm, QuoteForm and AgentForm all call
                fetch("/api/lead")), and the repository contains no analytics of
                any kind — no gtag, no GTM, no Plausible, no PostHog — so there
                are no conversion figures for recruiting to stay out of. It
                appeared on a page headed "What we publish up front", addressed
                to licensed producers, on a site whose whole argument is that
                its claims are checkable.

                What IS true is stated instead: the server records the lead kind
                and, when a recruiting inbox is configured, routes producer
                applications to it (see lib/delivery.ts). The conditional is
                stated as a conditional — see the note on /thank-you/apply.
              */}
              <p className="mt-8 text-small text-muted">
                An application is recorded as a producer application rather than a client enquiry,
                and is delivered to a separate recruiting inbox when one is configured.
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
    </>
  );
}
