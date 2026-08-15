import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileCallBar } from "@/components/layout/MobileCallBar";
import { flags, site } from "@/lib/site.config";
import { SITE_URL } from "@/lib/site-url";

/**
 * TYPOGRAPHY
 *
 * Display — Fraunces, a variable high-contrast serif. WONK and SOFT are dialled
 * to 0 and optical size held high (see globals.css .font-display) so it reads
 * institutional rather than decorative.
 *
 * Body/UI — Inter. Neutral, and critically it ships real tabular figures, which
 * every numeral on a financial-services site depends on.
 *
 * Both are self-hosted automatically by next/font — no third-party request at
 * runtime, no layout shift, no render-blocking stylesheet.
 *
 * If the brand later licenses a display face (Canela, Tiempos Headline, GT
 * Sectra) or a grotesque with more character (Söhne, Untitled Sans), swap here
 * and nothing else changes.
 */

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * SITE URL — one definition for the whole application, in lib/site-url.ts.
 * It was previously declared here, in lib/metadata.ts, in app/robots.ts and in
 * app/sitemap.ts, with two different fallbacks, so an unconfigured deployment
 * disagreed with itself about where it lived.
 */

/* Share-card defaults. Demonstration status is carried in the card itself. */
const SHARE_TITLE = flags.demo
  ? `[Demonstration prototype] ${site.companyName} — ${site.tagline}`
  : `${site.companyName} — ${site.tagline}`;
const SHARE_DESCRIPTION = flags.demo
  ? `Demonstration content — this company does not exist. ${site.positioning}`
  : site.positioning;
const SHARE_IMAGE_ALT = flags.demo
  ? "Demonstration prototype — an independent life insurance brokerage website design"
  : "Independent life insurance brokerage";

export const viewport: Viewport = {
  themeColor: "#121310",
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // NO canonical here. Metadata merges shallowly between segments, so a
  // canonical set at the root would be inherited by every page that did not
  // override it — every page declaring itself a copy of the homepage. Each
  // indexable page sets its own via lib/metadata.ts.
  // The <title> is held short enough not to truncate in a search result;
  // the tagline carries in the Open Graph title and the description, where
  // the length budget is far more generous.
  title: {
    default: `${site.companyName} — Independent Brokerage`,
    template: `%s · ${site.companyName}`,
  },
  description: site.positioning,

  /**
   * Open Graph and Twitter cards — the DEFAULTS, inherited by pages that do not
   * compose their own (the thank-you routes, the styleguide, the 404).
   *
   * While this is a demonstration build the card says so. `noindex` keeps the
   * site out of search results but does nothing about a link unfurling in
   * Slack, iMessage or LinkedIn, where an unmarked card would present a
   * fictional agency as a real one.
   *
   * The share image is a typographic plate built from the design system.
   * Regenerate it with `npm run og` whenever the name, tagline or demo status
   * changes.
   */
  openGraph: {
    type: "website",
    siteName: site.companyName,
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: SHARE_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: ["/og.png"],
  },
  // PRE-LAUNCH: nothing is indexed while pages still contain {{TOKEN}}
  // placeholders or while this is a demonstration build. BOTH gates must be
  // open — NEXT_PUBLIC_ALLOW_INDEXING=1 alone cannot index a demo. Mirrors
  // lib/metadata.ts and app/robots.ts.
  robots:
    process.env.NEXT_PUBLIC_ALLOW_INDEXING === "1" && !flags.demo
      ? { index: true, follow: true }
      : { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only rounded bg-ink px-4 py-2 text-paper focus:not-sr-only
                     focus:absolute focus:left-4 focus:top-4 focus:z-[60]"
        >
          Skip to content
        </a>
        <Header />

        {/*
          The forms are React-controlled and post with fetch, so with JavaScript
          disabled they render but cannot submit. Saying so is better than a
          button that silently does nothing. Everything else on the site — all
          the reading, the FAQ accordions, the navigation — works without it.
        */}
        <noscript>
          <div className="border-b border-[var(--rule-strong)] bg-paper-alt">
            <div className="mx-auto w-full max-w-shell px-gutter py-3 text-small text-ink">
              <strong className="font-medium">JavaScript is turned off.</strong> You can read
              everything here, but the enquiry forms cannot send. Telephone{" "}
              <span className="whitespace-nowrap">{site.phone}</span> instead, or turn JavaScript
              on and reload.
            </div>
          </div>
        </noscript>

        <main id="main">{children}</main>
        <Footer />
        <MobileCallBar />
      </body>
    </html>
  );
}
