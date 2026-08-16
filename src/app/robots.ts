import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-url";
import { INDEXING_ALLOWED } from "@/lib/metadata";

export const dynamic = "force-static";

/**
 * PRE-LAUNCH: the whole site is disallowed, and every page also carries a
 * noindex directive from the root layout.
 *
 * Nothing should be indexed while the pages still contain {{TOKEN}}
 * placeholders — a search engine caching "{{COMPANY_NAME}}" is a genuinely
 * annoying thing to undo.
 *
 * TO GO LIVE: fill every launch-critical token, set `flags.demo = false` in
 * lib/site.config.ts, then set NEXT_PUBLIC_ALLOW_INDEXING=1. Nothing else needs
 * editing — the layout and lib/metadata.ts read the same two conditions.
 */
// The single gate, imported rather than recomputed — see lib/metadata.ts.
const allowIndexing = INDEXING_ALLOWED;

export default function robots(): MetadataRoute.Robots {
  if (!allowIndexing) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/thank-you/", "/styleguide", "/careers/apply"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
