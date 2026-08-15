import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import Link from "next/link";
import { isEmailAddress, isResolved, routes, site } from "@/lib/site.config";
import { Container, Display, Eyebrow, Section } from "@/components/ui/primitives";
import { EmbedSlot } from "@/components/ui/page";
import { Token } from "@/components/ui/Token";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { ContactForm } from "@/components/forms/ContactForm";
import { OrganisationSchema, BreadcrumbSchema } from "@/lib/schema";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = pageMeta({
  title: "Contact",
  description:
    "Office address, telephone number and opening hours for the brokerage, with a short message form for anything the quote form does not cover.",
  path: "/contact",
});

export default function ContactPage() {
  const mapReady = isResolved(site.mapEmbedUrl);

  return (
    <>
      <BreadcrumbSchema trail={[{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }]} />
      {/* Emits nothing until name, address and phone are all real. */}
      <OrganisationSchema />

      <Section size="none" className="pb-section-sm pt-14 md:pt-20">
        <Container>
          <Reveal>
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-7">
                <Eyebrow tone="accent">Contact</Eyebrow>
                <Display as="h1" size="h1" className="mt-6 max-w-[15ch]">
                  A real office, with a real address.
                </Display>
              </div>
              <p className="max-w-measure text-body-lg text-muted text-pretty lg:col-span-5 lg:self-end">
                If you want a comparison, start with the{" "}
                <Link
                  href={routes.quote}
                  className="inline-block py-1 text-ink underline decoration-[var(--rule-strong)] underline-offset-[6px] transition-colors hover:decoration-ink"
                >
                  quote form
                </Link>{" "}
                — it asks the questions we would otherwise ask you. For anything else, this is the
                place.
              </p>
            </div>
          </Reveal>

          <div className="mt-16 grid gap-14 lg:grid-cols-12 lg:gap-16">
            {/* ── Details ──────────────────────────────────────────────── */}
            <Reveal className="lg:col-span-5">
              <div className="border border-[var(--rule)] bg-paper-alt-wash">
                <div className="border-b border-[var(--rule)] px-7 py-5">
                  <Eyebrow>The office</Eyebrow>
                </div>
                <address className="not-italic">
                  {/* `linkable` rather than a hard-coded href: a mailto: or tel:
                      built from an unfilled token opens a mail client or dialler
                      with nonsense in it, which reads as a broken business
                      rather than an unfinished site. */}
                  {[
                    { term: "Telephone", value: site.phone, kind: "tel" as const },
                    {
                      term: "Email",
                      value: site.email,
                      kind: "mail" as const,
                      href: `mailto:${site.email}`,
                    },
                    { term: "Address", value: site.officeAddress },
                    { term: "Hours", value: site.officeHours },
                    { term: "Licensed in", value: site.licenseStates },
                  ].map((row) => (
                    <div
                      key={row.term}
                      className="border-b border-[var(--rule)] px-7 py-5 last:border-b-0"
                    >
                      <p className="text-micro uppercase tracking-[0.08em] text-muted">
                        {row.term}
                      </p>
                      <p className="mt-1.5 font-display text-h4 text-ink">
                        {row.kind === "tel" ? (
                          <PhoneLink className="inline-block py-1 underline decoration-[var(--rule-strong)] underline-offset-[6px] hover:decoration-ink">
                            <Token value={row.value} />
                          </PhoneLink>
                        ) : row.href && isEmailAddress(row.value) ? (
                          <a
                            href={row.href}
                            className="inline-block py-1 underline decoration-[var(--rule-strong)] underline-offset-[6px] transition-colors hover:decoration-ink"
                          >
                            <Token value={row.value} />
                          </a>
                        ) : (
                          <Token value={row.value} />
                        )}
                      </p>
                    </div>
                  ))}
                </address>
              </div>

              <div className="mt-10">
                {mapReady ? (
                  <div className="overflow-hidden border border-[var(--rule)]">
                    <iframe
                      src={site.mapEmbedUrl}
                      title="Map showing the office location"
                      loading="lazy"
                      className="aspect-[16/10] w-full"
                    />
                  </div>
                ) : (
                  <EmbedSlot
                    label="Map"
                    brief="Google Maps embed for the office, which also anchors the local search listing. Needs the confirmed address."
                    ratio="16 / 10"
                  />
                )}
              </div>
            </Reveal>

            {/* ── Form ─────────────────────────────────────────────────── */}
            <Reveal delay={60} className="lg:col-span-6 lg:col-start-7">
              <h2 className="font-display text-h3 text-ink">Send a message</h2>
              <p className="mt-4 max-w-measure text-base text-muted">
                Five fields, and it reaches the office directly.
              </p>
              <div className="mt-9">
                <ContactForm />
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>
    </>
  );
}
