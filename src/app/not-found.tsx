import type { Metadata } from "next";
import Link from "next/link";
import { nav, routes, site } from "@/lib/site.config";
import { OG_IMAGE } from "@/lib/metadata";
import {
  Arrow,
  Button,
  Container,
  Display,
  Eyebrow,
  Section,
} from "@/components/ui/primitives";
import { Token } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";

/**
 * The title is required: without it the 404 inherits the root layout's default
 * and presents itself to a browser tab, a history entry and a bookmark as the
 * homepage.
 *
 * ON THE DUPLICATE ROBOTS TAG (finding R2-08) — NOT FIXED, AND NOT FIXABLE HERE.
 *
 * This route serves two <meta name="robots"> tags:
 *
 *     <meta name="robots" content="noindex"/>          ← injected by Next.js
 *     <meta name="robots" content="noindex, nofollow"/> ← from the root layout
 *
 * The first is emitted by the framework for any page returning 404 and is not
 * configurable; `node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/not-found.md` states it as automatic behaviour. Measured
 * both ways: declaring `robots` in this file and omitting it produce byte-
 * identical output, so removing it was not the fix it was first written up as.
 *
 * The alternatives are worse than the symptom. Dropping `robots` from the root
 * layout would leave every other route without a noindex directive to remove
 * one redundant tag from a page crawlers are told not to index anyway; both
 * tags agree on `noindex`, and a crawler seeing several robots tags applies the
 * most restrictive union of them, so the effective directive is exactly the one
 * intended. This is a cosmetic duplicate in the framework's output, recorded
 * here rather than papered over. tests/regression/seo-meta.mjs asserts the
 * property that actually matters: no route ever says `index`.
 *
 * FINDING R4-16 — the one route R3-M6 missed.
 *
 * Only `title` was declared here, so Next's shallow merge left the root
 * layout's `description`, `openGraph` and `twitter` blocks intact. Every
 * missing URL on the site therefore unfurled in Slack, iMessage or LinkedIn as
 * the homepage: the homepage's marketing description, the homepage's share
 * title, and `og:url` pointing at the homepage — a card claiming a page exists
 * at an address that just returned 404.
 *
 * `og:url` IS DELIBERATELY ABSENT rather than corrected. It means "the
 * canonical address of this document", and a 404 is served for arbitrarily
 * many addresses, none of them canonical. There is no honest value; the honest
 * thing is to emit no such claim. Declaring the object at all is what stops
 * the inheritance — the merge is shallow, so this block REPLACES the layout's.
 *
 * Not routed through `pageMeta` for the same reason: that helper's contract is
 * one page, one path, and this page has no path.
 */
export const metadata: Metadata = {
  title: "Page not found",
  description: "This page does not exist.",
  openGraph: {
    type: "website",
    siteName: site.companyName,
    title: `Page not found · ${site.companyName}`,
    description: "This page does not exist.",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `Page not found · ${site.companyName}`,
    description: "This page does not exist.",
    images: [OG_IMAGE.url],
  },
};

/**
 * A branded 404 is a couple of hours of work and a real credibility signal.
 * The default Next.js page reads as an unfinished site.
 */
export default function NotFound() {
  return (
    <Section size="none" className="pb-section pt-24 md:pt-32">
      <Container>
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <Eyebrow tone="accent">404</Eyebrow>
            <Display as="h1" size="h1" className="mt-6 max-w-[14ch]">
              That page is not here.
            </Display>
            <p className="mt-8 max-w-measure text-body-lg text-muted text-pretty">
              Either the address is wrong or we moved something without leaving a forwarding note.
              Either way it is our problem rather than yours.
            </p>
            <div className="mt-11 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
              <Button href={routes.quote}>
                Get Your Quote <Arrow />
              </Button>
              <span className="text-small text-muted">
                Or call{" "}
                <PhoneLink className="text-ink underline decoration-[var(--rule-strong)] underline-offset-[6px] transition-colors hover:decoration-ink"><Token value={site.phone} /></PhoneLink>
              </span>
            </div>
          </div>

          <nav aria-label="Site sections" className="lg:col-span-5 lg:col-start-8">
            <p className="text-eyebrow font-medium uppercase tracking-[0.14em] text-muted">
              Everywhere else
            </p>
            <ul className="mt-6 border-t border-[var(--rule-strong)]">
              {[{ label: "Home", href: "/" }, ...nav, { label: "FAQ", href: "/faq" }].map(
                (item) => (
                  <li key={item.href} className="border-b border-[var(--rule)]">
                    <Link
                      href={item.href}
                      className="group flex items-center justify-between py-4 font-display text-h4 text-ink transition-colors hover:text-accent"
                    >
                      {item.label}
                      <Arrow />
                    </Link>
                  </li>
                )
              )}
            </ul>
          </nav>
        </div>
      </Container>
    </Section>
  );
}
