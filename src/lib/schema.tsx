import { allResolved, flags, isResolved, site } from "./site.config";
import { SITE_URL } from "./site-url";
import type { FaqItem } from "./faq";

/**
 * STRUCTURED DATA
 *
 * Same rule as the rest of the site: nothing unverified gets published.
 * Structured data is arguably the worst place for a placeholder to leak, since
 * it is machine-read and cached, so every emitter below refuses to render
 * unless the facts it depends on are resolved.
 *
 * Returns null → no <script> tag at all. That is the correct behaviour today.
 */

const TOKEN_RE = /\{\{[A-Z0-9_]+\}\}/;

function hasToken(value: string) {
  return TOKEN_RE.test(value);
}

/**
 * JSON.stringify does not escape `<`, so a value containing `</script>` would
 * close the block and everything after it would parse as HTML. Nothing in
 * site.config.ts contains one today, and this markup is suppressed in demo mode
 * anyway — but "no current input triggers it" is not a property worth relying
 * on in a tag that renders unescaped. Escaping the three characters that matter
 * costs nothing and removes the class of bug entirely.
 */
function serialiseJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Content is generated from resolved config values only, and escaped
      // above so no value can terminate the script block.
      dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }}
    />
  );
}

/**
 * InsuranceAgency (a subtype of LocalBusiness).
 *
 * Requires, at minimum, a real name, address and telephone. Emitting an
 * organisation with a placeholder name would be actively harmful — it is the
 * entity search engines key on.
 */
export function OrganisationSchema() {
  if (!flags.structuredData || flags.demo) return null;
  if (!allResolved(site.companyName, site.officeAddress, site.phone)) return null;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "InsuranceAgency",
    name: site.companyName,
    telephone: site.phone,
    address: { "@type": "PostalAddress", streetAddress: site.officeAddress },
    description:
      "An independent life insurance brokerage. Because each carrier files its own underwriting guidelines, where an application is submitted changes who reads it.",
  };

  if (isResolved(site.email)) data.email = site.email;
  if (isResolved(site.officeHours)) data.openingHours = site.officeHours;
  if (isResolved(site.licenseStates)) {
    data.areaServed = site.licenseStates
      .split(/,\s*/)
      .map((s) => ({ "@type": "AdministrativeArea", name: s.trim() }));
  }
  if (isResolved(site.yearFounded)) data.foundingDate = site.yearFounded;

  return <JsonLd data={data} />;
}

/**
 * FAQPage.
 *
 * Filters out any question whose answer still contains a placeholder, then
 * refuses to emit at all if fewer than two survive — a one-question FAQPage is
 * not worth the markup.
 */
export function FaqSchema({ items }: { items: FaqItem[] }) {
  if (!flags.structuredData || flags.demo) return null;

  const publishable = items.filter((i) => !hasToken(i.a) && !hasToken(i.q));
  if (publishable.length < 2) return null;

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: publishable.map((i) => ({
          "@type": "Question",
          name: i.q,
          acceptedAnswer: { "@type": "Answer", text: i.a },
        })),
      }}
    />
  );
}

/**
 * Breadcrumbs for interior pages. Safe to emit unconditionally — the trail
 * contains route names, not business facts.
 *
 * Paths are made absolute: schema.org consumers treat a relative `item` as
 * ambiguous, and several validators reject it outright.
 */
// The one authoritative definition lives in lib/site-url.ts. This file used to
// declare its own with a THIRD fallback ("" — producing relative `item` values
// that the comment above says validators reject). Finding R2-07.
export function BreadcrumbSchema({
  trail,
}: {
  trail: { name: string; path: string }[];
}) {
  if (!flags.structuredData || flags.demo) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: trail.map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t.name,
          item: `${SITE_URL}${t.path}`,
        })),
      }}
    />
  );
}
