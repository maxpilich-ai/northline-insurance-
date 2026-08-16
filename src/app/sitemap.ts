import type { MetadataRoute } from "next";

/**
 * Public routes only. The thank-you pages, the styleguide and the application
 * form are excluded — they are either confirmation states or internal.
 */
import { SITE_URL } from "@/lib/site-url";
import { INDEXING_ALLOWED } from "@/lib/metadata";

export const dynamic = "force-static";

/** Stamped once per build, so every entry in one sitemap agrees. */
const BUILD_TIME = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  /*
    AN EMPTY SITEMAP WHILE NOTHING MAY BE INDEXED (finding R3-L10).

    robots.txt serves `Disallow: /` in this state and every route carries
    `noindex`, yet this file went on publishing twelve URLs and inviting
    crawlers to fetch pages the same deployment tells them to stay away from.
    Harmless in practice — nothing links to the sitemap and `Disallow: /` covers
    the sitemap itself — but it is a contradiction between two files that are
    supposed to express one policy, and the same gate already governs both.
  */
  if (!INDEXING_ALLOWED) return [];

  const routes = [
    { path: "/", priority: 1 },
    { path: "/how-it-works", priority: 0.9 },
    { path: "/coverage", priority: 0.9 },
    { path: "/carriers", priority: 0.8 },
    { path: "/about", priority: 0.7 },
    { path: "/faq", priority: 0.7 },
    { path: "/quote", priority: 0.9 },
    { path: "/schedule", priority: 0.8 },
    { path: "/contact", priority: 0.6 },
    { path: "/careers", priority: 0.4 },
    { path: "/privacy", priority: 0.2 },
    { path: "/terms", priority: 0.2 },
  ];

  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    // Build time, not a date frozen in the source. A hard-coded literal
    // silently ages: every URL would keep claiming the same lastmod forever.
    lastModified: BUILD_TIME,
    changeFrequency: "monthly" as const,
    priority: r.priority,
  }));
}
