import type { Metadata } from "next";
import { flags, site } from "./site.config";
import { SITE_URL } from "./site-url";

/**
 * ============================================================================
 * PER-PAGE METADATA
 * ============================================================================
 *
 * WHY THIS EXISTS. Next.js merges metadata between segments *shallowly*: a
 * nested object defined in the root layout is REPLACED, not merged, by one
 * defined in a page. Two consequences drove this helper:
 *
 *   1. A canonical URL set once in the root layout is inherited verbatim by
 *      every page, so every page declares itself a duplicate of the homepage.
 *      That is worse than having no canonical at all.
 *   2. A page that wants to correct only `openGraph.url` would silently drop
 *      siteName, type and the share image, because the whole object is
 *      replaced.
 *
 * So every indexable page composes its complete Open Graph block here, from a
 * single path. One argument, no way to get the two out of step.
 */

/** Re-exported for convenience; the single definition lives in site-url.ts. */
export { SITE_URL };

/**
 * INDEXING IS GATED TWICE, AND BOTH GATES MUST BE OPEN.
 *
 * `NEXT_PUBLIC_ALLOW_INDEXING=1` used to be enough on its own, which meant one
 * environment variable could put a fictional insurance agency into search
 * results while every page still said "demonstration prototype". Demo mode now
 * vetoes indexing outright: a demonstration build cannot be indexed by
 * accident, only by someone first confirming the business facts and setting
 * `flags.demo = false`.
 */
/**
 * THE ONE INDEXING GATE.
 *
 * Both switches must be open: an explicit opt-in AND the demonstration flag
 * being off. Exported rather than recomputed, because app/robots.ts and
 * app/sitemap.ts need the identical answer and three copies of one boolean is
 * how two files come to disagree (the shape of finding R2-07).
 */
export const INDEXING_ALLOWED =
  process.env.NEXT_PUBLIC_ALLOW_INDEXING === "1" && !flags.demo;

/**
 * The share card. `noindex` does not stop a link unfurling in Slack, iMessage
 * or LinkedIn, so while the site is a demonstration the card has to say so —
 * otherwise a pasted link presents as a real brokerage.
 */
export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: flags.demo
    ? "Demonstration prototype — an independent life insurance brokerage website design"
    : "Independent life insurance brokerage",
} as const;

/** Prefix carried by every share card while the site is demonstration content. */
const DEMO_PREFIX = "[Demonstration prototype] ";

type PageMetaInput = {
  /** Page title, without the site-name suffix — the template adds that. */
  title: string;
  description: string;
  /** Route path, leading slash, no trailing slash. "/" for the homepage. */
  path: string;
  /**
   * Set false for pages that must never be indexed regardless of the global
   * switch — thank-you routes, the styleguide. Those get no canonical, because
   * a canonical on a noindex page is noise.
   */
  indexable?: boolean;
};

export function pageMeta({
  title,
  description,
  path,
  indexable = true,
}: PageMetaInput): Metadata {
  // A share card carries no site chrome, so the company name has to be in the
  // title itself — "About" alone tells a reader nothing about whose page it is.
  const baseOgTitle =
    path === "/"
      ? `${site.companyName} — ${site.tagline}`
      : `${title} · ${site.companyName}`;
  const ogTitle = flags.demo ? `${DEMO_PREFIX}${baseOgTitle}` : baseOgTitle;
  const ogDescription = flags.demo
    ? `Demonstration content — this company does not exist. ${description}`
    : description;

  return {
    // The homepage sets its title absolutely so the layout's "%s · Company"
    // template does not append the company name to itself.
    title:
      path === "/" ? { absolute: `${site.companyName} — ${title}` } : title,
    description,
    ...(indexable ? { alternates: { canonical: path } } : {}),
    openGraph: {
      type: "website",
      siteName: site.companyName,
      title: ogTitle,
      description: ogDescription,
      url: path,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [OG_IMAGE.url],
    },
    robots:
      indexable && INDEXING_ALLOWED
        ? { index: true, follow: true }
        : { index: false, follow: false },
  };
}
