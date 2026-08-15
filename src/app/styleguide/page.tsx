import type { Metadata } from "next";
import { pageMeta } from "@/lib/metadata";
import { flags, routes, site } from "@/lib/site.config";
import {
  Arrow,
  Button,
  Container,
  Display,
  Eyebrow,
  Rule,
  Section,
  TextLink,
  cx,
} from "@/components/ui/primitives";
import { Token } from "@/components/ui/Token";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
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
  title: "Design System",
  description: "The typography, colour, spacing and component rules this site is built from.",
  path: "/styleguide",
  indexable: false,
});

/* ── Styleguide chrome ─────────────────────────────────────────────────── */

function Spec({
  n,
  title,
  note,
  children,
  tone = "paper",
}: {
  n: string;
  title: string;
  note?: string;
  children: React.ReactNode;
  tone?: "paper" | "alt" | "dark";
}) {
  return (
    <Section tone={tone} size="sm" className="scroll-mt-24" id={`spec-${n}`}>
      <Container>
        <div className="grid gap-10 lg:grid-cols-12">
          <header className="lg:col-span-3">
            <span
              className={cx(
                "font-display text-small tabular-nums",
                tone === "dark" ? "text-accent-light" : "text-accent"
              )}
            >
              {n}
            </span>
            <h2 className="mt-3 font-display text-h3">{title}</h2>
            {note && (
              <p
                className={cx(
                  "mt-4 text-small",
                  tone === "dark" ? "text-muted-dark" : "text-muted"
                )}
              >
                {note}
              </p>
            )}
          </header>
          <div className="min-w-0 lg:col-span-8 lg:col-start-5">{children}</div>
        </div>
      </Container>
    </Section>
  );
}

function Swatch({
  name,
  varName,
  hex,
  contrast,
  className,
}: {
  name: string;
  varName: string;
  hex: string;
  contrast?: string;
  className?: string;
}) {
  return (
    <div>
      <div
        className={cx("h-20 w-full border border-[var(--rule)]", className)}
        style={{ background: hex }}
      />
      <p className="mt-3 text-small font-medium">{name}</p>
      <p className="text-micro tabular-nums text-muted">{hex}</p>
      <p className="text-micro text-muted">{varName}</p>
      {contrast && <p className="mt-1 text-micro tabular-nums text-accent">{contrast}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4 border-t border-[var(--rule)] py-7 sm:grid-cols-[10rem_1fr] sm:gap-8">
      <p className="text-micro uppercase tracking-[0.08em] text-muted">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function Styleguide() {
  return (
    <>
      {/* Masthead */}
      <Section size="none" className="pb-section-sm pt-16 md:pt-24">
        <Container>
          <Eyebrow tone="accent">Phase 1 · Design System</Eyebrow>
          <Display as="h1" size="h1" className="mt-6 max-w-[20ch]">
            Institutional Editorial
          </Display>
          <p className="mt-8 max-w-measure text-body-lg text-muted text-pretty">
            The register is a boutique wealth-management or law firm rather than a consumer
            insurance brand: confident and restrained rather than warm, because this is a competence
            purchase. Typography carries the design, because photography is limited and stock
            imagery is forbidden.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button href="/">
              View the homepage <Arrow />
            </Button>
          </div>
        </Container>
      </Section>

      {/* 01 — Colour */}
      <Spec
        n="01"
        title="Colour"
        note="Warm paper ground, warm near-black ink, dark bookends, and exactly one accent. The accent's scarcity is what makes it read as expensive."
        tone="alt"
      >
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          <Swatch name="Paper" varName="--paper" hex="#F7F5F0" />
          <Swatch name="Paper alt" varName="--paper-alt" hex="#EEEBE3" />
          <Swatch name="Ink deep" varName="--ink-deep" hex="#121310" />
          <Swatch name="Ink" varName="--ink" hex="#1A1A17" contrast="16.01:1 on paper" />
          <Swatch name="Muted" varName="--muted" hex="#5E5B54" contrast="6.22:1 on paper" />
          <Swatch name="Accent" varName="--accent" hex="#1D4634" contrast="9.74:1 on paper" />
          <Swatch name="Accent hover" varName="--accent-hover" hex="#143025" />
          <Swatch
            name="Accent light"
            varName="--accent-light"
            hex="#8FC4A8"
            contrast="9.44:1 on dark"
          />
          <Swatch name="On dark" varName="--on-dark" hex="#F2EFE8" contrast="16.24:1 on dark" />
          <Swatch
            name="Muted dark"
            varName="--muted-dark"
            hex="#A8A49B"
            contrast="7.50:1 on dark"
          />
        </div>
        <p className="mt-8 max-w-measure text-small text-muted">
          Every pairing above clears WCAG 2.1 AA (4.5:1) with margin; the weakest is muted text on
          the alternate band at 5.69:1. No pure black, no pure white, no gradient anywhere in the
          system.
        </p>
      </Spec>

      {/* 02 — Typography */}
      <Spec
        n="02"
        title="Typography"
        note="Fraunces for display with WONK and SOFT at zero and optical size held high; Inter for body and UI. Both self-hosted, no runtime request."
      >
        <div className="border-t border-[var(--rule-strong)]">
          <Row label="Display · 5.25rem">
            <p className="font-display text-display leading-[1.02] tracking-[-0.034em]">
              Underwriting
            </p>
          </Row>
          <Row label="H1 · 4rem">
            <p className="font-display text-h1">Every carrier underwrites differently</p>
          </Row>
          <Row label="H2 · 2.875rem">
            <p className="font-display text-h2">The same person, assessed differently</p>
          </Row>
          <Row label="H3 · 1.75rem">
            <p className="font-display text-h3">What an appointment buys you</p>
          </Row>
          <Row label="H4 · 1.1875rem">
            <p className="font-display text-h4">Carrier matching</p>
          </Row>
          <Row label="Lede · 1.25rem">
            <p className="max-w-measure text-body-lg text-muted">
              Each insurance company sets its own underwriting guidelines — how it weighs health
              history, build, family history, occupation.
            </p>
          </Row>
          <Row label="Body · 1.0625rem">
            <p className="max-w-measure text-base text-muted">
              An appointment is a contract between a brokerage and an insurance company that allows
              the brokerage to submit business to it. Measure is held to roughly 68–72 characters,
              line height 1.7.
            </p>
          </Row>
          <Row label="Small · 0.8125rem">
            <p className="text-small text-muted">Supporting copy, captions, form help text.</p>
          </Row>
          <Row label="Eyebrow · 0.6875rem">
            <Eyebrow tone="accent">Independent Life Insurance Brokerage</Eyebrow>
          </Row>
          <Row label="Tabular figures">
            <div className="space-y-2">
              <p className="font-display text-h3 tabular-nums">1,000,000 · 2026 · 0123456789</p>
              <p className="text-small text-muted">
                Enabled globally via <code className="text-ink">font-feature-settings: tnum</code>.
                Misaligned numerals in a table are the fastest way to lose credibility on a
                financial-services site.
              </p>
            </div>
          </Row>
        </div>
      </Spec>

      {/* 03 — Grid & spacing */}
      <Spec
        n="03"
        title="Grid &amp; spacing"
        note="Twelve columns, asymmetric splits, hairlines instead of shadows, 2px radius maximum."
        tone="alt"
      >
        {/* 12 columns cannot fit a 320px viewport; the demo scrolls rather
            than forcing the page wide. The real grid collapses instead. */}
        <div className="overflow-x-auto">
          <div className="grid min-w-[26rem] grid-cols-12 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-24 border border-[var(--rule)] bg-[rgba(29,70,52,0.05)] text-center text-micro tabular-nums text-muted"
            >
              <span className="inline-block pt-2">{i + 1}</span>
            </div>
            ))}
          </div>
        </div>
        <dl className="mt-10 grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {[
            ["Shell max-width", "1352px"],
            ["Content max-width", "1152px"],
            ["Measure", "36rem (~70ch)"],
            ["Gutter", "24 / 40 / 56px"],
            ["Section padding", "clamp(4.5rem, 8vw, 9.5rem)"],
            ["Border radius", "2px maximum"],
            ["Preferred splits", "7/5 · 8/4 · 5/6 — never perpetual 50/50"],
            ["Separators", "1px hairline, never a drop shadow"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6 border-t border-[var(--rule)] pt-4">
              <dt className="text-small text-muted">{k}</dt>
              <dd className="text-right text-small tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </Spec>

      {/* 04 — Buttons & links */}
      <Spec
        n="04"
        title="Buttons &amp; links"
        note="One primary CTA per view. The secondary action is a text link, never a competing button — two equal-weight buttons split attention and reduce both."
      >
        <div className="space-y-10">
          <div className="flex flex-wrap items-center gap-6">
            <Button href={routes.quote}>
              Get Your Quote <Arrow />
            </Button>
            <Button href={routes.quote} size="large">
              Get Your Quote <Arrow />
            </Button>
            <Button href={routes.quote} variant="secondary">
              Secondary action
            </Button>
            <TextLink href={routes.quote}>
              Book a call <Arrow />
            </TextLink>
            <TextLink href={routes.quote} tone="accent">
              Accent text link <Arrow />
            </TextLink>
          </div>

          <div className="border border-[var(--rule)] bg-ink-deep p-10 on-dark">
            <p className="mb-6 text-eyebrow uppercase tracking-[0.14em] text-muted-dark">
              On the dark ground
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <Button href={routes.quote} variant="onDark" size="large">
                Get Your Quote <Arrow />
              </Button>
              <TextLink href={routes.quote} tone="dark">
                Book a call <Arrow />
              </TextLink>
            </div>
            <p className="mt-6 max-w-measure text-small text-muted-dark">
              The accent green is too dark to carry a button against the dark ground, so the primary
              CTA inverts to paper. Same hierarchy, correct contrast.
            </p>
          </div>

          <p className="max-w-measure text-small text-muted">
            Focus rings are never removed — tab through this page to see them. They switch to the
            light accent automatically on dark surfaces.
          </p>
        </div>
      </Spec>

      {/* 05 — Tokens */}
      <Spec
        n="05"
        title="Unverified facts"
        note="The enforcement mechanism. Business facts render through a single component so nothing unconfirmed can reach launch unnoticed."
        tone="alt"
      >
        <div className="space-y-8">
          <div className="border border-[var(--rule)] bg-paper p-8">
            <p className="text-body">
              We can look across <Token value={site.carrierCount} /> carriers, from our office in{" "}
              <Token value={site.officeCityState} />, licensed in{" "}
              <Token value={site.licenseStates} />.
            </p>
            <p className="mt-6 text-small text-muted">
              Unresolved values render with a dotted accent underline and a tooltip. Once the owner
              fills the value into <code className="text-ink">site.config.ts</code>, the marker
              disappears with no layout shift.
            </p>
          </div>

          <div>
            <h3 className="font-display text-h4">Flag-gated components</h3>
            <p className="mt-3 max-w-measure text-small text-muted">
              These render <em>nothing at all</em> until real material exists. Enforced in the
              component layer, not left to a content pass.
            </p>
            <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--rule-strong)]">
                  <th className="pb-3 pr-6 text-micro uppercase tracking-[0.08em] text-muted">
                    Flag
                  </th>
                  <th className="pb-3 pr-6 text-micro uppercase tracking-[0.08em] text-muted">
                    State
                  </th>
                  <th className="pb-3 text-micro uppercase tracking-[0.08em] text-muted">
                    Blocked on
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["testimonials", flags.testimonials, "Consented client material + state rules on testimonial advertising"],
                  ["carrierLogos", flags.carrierLogos, "Written permission from each carrier"],
                  ["compensation", flags.compensation, "Confirmation of how he is paid"],
                  [
                    "structuredData",
                    flags.structuredData,
                    "Emitters self-suppress until the underlying facts are real",
                  ],
                ].map(([name, on, blocked]) => (
                  <tr key={name as string} className="border-b border-[var(--rule)] align-top">
                    <td className="py-4 pr-6 text-small">
                      <code>{name as string}</code>
                    </td>
                    <td className="py-4 pr-6 text-small">
                      <span className="text-muted">{on ? "on" : "off — renders null"}</span>
                    </td>
                    <td className="py-4 text-small text-muted">{blocked as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </Spec>

      {/* 06 — Photography */}
      <Spec
        n="06"
        title="Photography"
        note="Real photography or none. No stock. A designed plate is honest, holds the layout, and lets the real image drop in without reflow."
      >
        <div className="grid gap-8 sm:grid-cols-2">
          <PhotoSlot
            label="The owner, in the office"
            brief="Environmental portrait, natural light, at his own desk."
            ratio="4 / 5"
          />
          <PhotoSlot
            label="The office"
            brief="Wide interior. Establishes that a real place exists."
            ratio="4 / 5"
            tone="light"
          />
        </div>
      </Spec>

      {/* 07 — Data display */}
      <Spec
        n="07"
        title="Data display"
        note="Comparison tables and specification panels are the site's core visual device — they say 'we deal in facts' more convincingly than any illustration."
        tone="dark"
      >
        <div className="space-y-10">
          <div className="border border-[var(--rule-dark)]">
            <div className="border-b border-[var(--rule-dark)] px-7 py-5">
              <Eyebrow tone="light">At a glance</Eyebrow>
            </div>
            <dl>
              {[
                ["Carriers represented", site.carrierCount],
                ["Licensed in", site.licenseStates],
                ["Office", site.officeCityState],
              ].map(([term, value]) => (
                <div
                  key={term}
                  className="flex items-baseline justify-between gap-6 border-b border-[var(--rule-dark)] px-7 py-5 last:border-b-0"
                >
                  <dt className="text-small text-muted-dark">{term}</dt>
                  <dd className="font-display text-h4 tabular-nums">
                    <Token value={value} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="max-w-measure text-small text-muted-dark">
            The panel is built to look correct at two rows as well as four, because any figure the
            owner cannot substantiate gets deleted rather than softened. The full comparison table
            pattern is on the homepage, in the Independence Module.
          </p>
        </div>
      </Spec>

      {/* 08 — Disclosure */}
      <Spec
        n="08"
        title="Disclosure"
        note="Native details/summary — works without JavaScript, keyboard-operable by default, and the plus rotates rather than a chevron flipping."
      >
        <div className="border-t border-[var(--rule-strong)]">
          {[
            {
              q: "What does “independent” actually mean?",
              a: "A captive agent is contracted to one insurance company. An independent brokerage holds appointments with many and can submit an application wherever the guidelines suit the applicant.",
            },
            {
              q: "Will I need a medical exam?",
              a: "It depends on the carrier, the policy, the coverage amount and your age. Some carriers offer accelerated underwriting for applicants who meet their criteria.",
            },
          ].map((item) => (
            <details key={item.q} className="group border-b border-[var(--rule)]">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-8 py-6 font-display text-h4 transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
                <span className="text-balance">{item.q}</span>
                <span aria-hidden="true" className="relative mt-2 block h-3 w-3 shrink-0 text-accent">
                  <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-current" />
                  <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-current transition-transform duration-200 ease-editorial group-open:rotate-90" />
                </span>
              </summary>
              <div className="max-w-measure pb-7 text-base text-muted">{item.a}</div>
            </details>
          ))}
        </div>
      </Spec>

      {/* 09 — Form primitives */}
      <Spec
        n="09"
        title="Form primitives"
        note="Previewed here so the quote form in Phase 4 has nothing left to invent. 16px minimum input size prevents iOS zoom; labels are always visible, never placeholders."
        tone="alt"
      >
        <div className="max-w-measure space-y-7 border border-[var(--rule)] bg-paper p-8 md:p-10">
          <div>
            <label htmlFor="sg-name" className="block text-small font-medium">
              Full name
            </label>
            <input
              id="sg-name"
              type="text"
              className="mt-2 w-full rounded border border-[var(--rule-strong)] bg-paper px-4 py-3
                         text-ink outline-none transition-colors placeholder:text-muted
                         focus:border-accent"
              placeholder="Jane Ellison"
            />
          </div>

          <div>
            <label htmlFor="sg-state" className="block text-small font-medium">
              State
            </label>
            <select
              id="sg-state"
              className="mt-2 w-full appearance-none rounded border border-[var(--rule-strong)]
                         bg-paper px-4 py-3 text-ink outline-none transition-colors focus:border-accent"
              defaultValue=""
            >
              <option value="" disabled>
                Select your state
              </option>
              <option>Populated from {"{{LICENSE_STATES}}"}</option>
            </select>
            <p className="mt-2 text-small text-muted">
              Options come from the licensed-states list — the form cannot offer a state he is not
              licensed in.
            </p>
          </div>

          <fieldset>
            <legend className="text-small font-medium">Do you use tobacco?</legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {["No", "Yes", "Not sure"].map((opt, i) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-2.5 rounded border
                             border-[var(--rule-strong)] px-5 py-2.5 text-small transition-colors
                             hover:border-ink has-[:checked]:border-accent has-[:checked]:bg-accent-wash"
                >
                  <input
                    type="radio"
                    name="sg-tobacco"
                    className="accent-[var(--accent)]"
                    defaultChecked={i === 0}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="sg-err-input" className="block text-small font-medium">
              Error state
            </label>
            <input
              id="sg-err-input"
              type="email"
              aria-invalid="true"
              aria-describedby="sg-err"
              defaultValue="jane@"
              className="mt-2 w-full rounded border border-[#8C2F1F] bg-paper px-4 py-3 text-ink outline-none"
            />
            <p id="sg-err" className="mt-2 text-small text-[#8C2F1F]">
              Enter a complete email address.
            </p>
          </div>

          <div className="border-t border-[var(--rule)] pt-6">
            <label className="flex cursor-pointer items-start gap-3 text-small text-muted">
              <input type="checkbox" className="mt-1 accent-[var(--accent)]" />
              <span>
                TCPA consent block — unchecked by default, full language visible without expanding,
                and the exact text version is logged with a timestamp, IP and source URL at
                submission. Consent is never a condition of purchase.
              </span>
            </label>
          </div>

          <Button href={routes.quote} size="large" className="w-full">
            Continue <Arrow />
          </Button>
        </div>
      </Spec>

      {/* 10 — Motion */}
      <Spec
        n="10"
        title="Motion"
        note="One gesture, used everywhere, and nothing else."
      >
        <div className="space-y-8">
          <Reveal>
            <div className="border border-[var(--rule)] bg-paper-alt p-8">
              <p className="font-display text-h4">This block rose 14px and faded in. Once.</p>
              <p className="mt-3 max-w-measure text-small text-muted">
                260ms, cubic-bezier(0.22, 0.61, 0.36, 1), triggered by IntersectionObserver, then
                the observer disconnects. Under prefers-reduced-motion it renders at rest — handled
                in CSS, so it is correct even before hydration.
              </p>
            </div>
          </Reveal>
          <ul className="max-w-measure space-y-2 text-small text-muted">
            {[
              "No parallax",
              "No animated counters spinning up to round numbers",
              "No carousels",
              "No staggered cascades beyond a 60ms sibling offset",
              "No hover animation beyond a 2px arrow nudge and colour transitions",
            ].map((x) => (
              <li key={x} className="flex gap-3 border-t border-[var(--rule)] pt-2">
                <span aria-hidden="true" className="text-accent">
                  —
                </span>
                {x}
              </li>
            ))}
          </ul>
        </div>
      </Spec>

      {/* 11 — Anti-patterns */}
      <Spec
        n="11"
        title="What this system refuses"
        note="The AI-generated insurance site has a fixed signature. Naming it is what makes it avoidable."
        tone="dark"
      >
        <ul className="grid gap-x-10 sm:grid-cols-2">
          {[
            "Blue→teal or blue→purple gradient heroes",
            "Stock families laughing in fields",
            "Hands cradling paper-cutout families",
            "“Trusted · Affordable · Fast” icon cards",
            "16px+ border radius on everything",
            "Centre-aligned everything",
            "Purple accents",
            "Emoji or outline icons as section decoration",
            "“Protecting what matters most”",
            "“Sarah M., Happy Client”",
            "Counters animating up to round numbers",
            "Any savings figure, percentage or range",
          ].map((x) => (
            <li
              key={x}
              className="flex items-baseline gap-3 border-b border-[var(--rule-dark)] py-4 text-small"
            >
              <span aria-hidden="true" className="text-accent-light">
                ✕
              </span>
              <span className="text-muted-dark">{x}</span>
            </li>
          ))}
        </ul>
      </Spec>

      <Section size="sm">
        <Container>
          <Rule className="mb-10" />
          <div className="flex flex-wrap items-center justify-between gap-6">
            <p className="max-w-measure text-small text-muted">
              This page is the design system itself — the type scale, colour tokens, spacing
              and components every other route is built from.
            </p>
            <Button href="/">
              View the homepage <Arrow />
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
