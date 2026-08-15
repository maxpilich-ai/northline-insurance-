import type { ReactNode } from "react";
import {
  Arrow,
  Button,
  Container,
  Display,
  Eyebrow,
  Section,
  TextLink,
  cx,
} from "./primitives";
import { Reveal } from "./Reveal";
import { routes } from "@/lib/site.config";

/* ── Page hero ─────────────────────────────────────────────────────────────
   Shared masthead for every interior page. Asymmetric by default: title on
   the left seven columns, standfirst dropped into the right five and aligned
   to the baseline of the title block. -------------------------------------- */

export function PageHero({
  eyebrow,
  title,
  standfirst,
  aside,
  cta = true,
}: {
  eyebrow: string;
  title: ReactNode;
  standfirst?: ReactNode;
  aside?: ReactNode;
  cta?: boolean;
}) {
  return (
    <Section size="none" className="pb-section-sm pt-14 md:pt-20 lg:pt-24">
      <Container>
        <Reveal>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-7">
              <Eyebrow tone="accent">{eyebrow}</Eyebrow>
              <Display as="h1" size="h1" className="mt-6 max-w-[18ch]">
                {title}
              </Display>
            </div>
            <div className="lg:col-span-5 lg:self-end">
              {standfirst && (
                <p className="max-w-measure text-body-lg text-muted text-pretty">{standfirst}</p>
              )}
              {cta && (
                <div className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
                  <Button href={routes.quote}>
                    Get Your Quote <Arrow />
                  </Button>
                  <TextLink href={routes.schedule} className="text-small">
                    Book a call <Arrow />
                  </TextLink>
                </div>
              )}
              {aside}
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ── Section heading ───────────────────────────────────────────────────────── */

export function SectionHeading({
  eyebrow,
  title,
  standfirst,
  tone = "light",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  standfirst?: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={cx("grid gap-8 lg:grid-cols-12", className)}>
      <div className="lg:col-span-6">
        {eyebrow && <Eyebrow tone={tone === "dark" ? "light" : "accent"}>{eyebrow}</Eyebrow>}
        <Display as="h2" size="h2" className={cx(eyebrow && "mt-6", "max-w-[18ch]")}>
          {title}
        </Display>
      </div>
      {standfirst && (
        <p
          className={cx(
            "max-w-measure text-body text-pretty lg:col-span-5 lg:col-start-8 lg:self-end",
            tone === "dark" ? "text-muted-dark" : "text-muted"
          )}
        >
          {standfirst}
        </p>
      )}
    </div>
  );
}

/* ── Prose ─────────────────────────────────────────────────────────────────
   Long-form body copy held to measure, with consistent vertical rhythm.
   Used on the explanatory and legal pages. ---------------------------------- */

export function Prose({
  children,
  className,
  tone = "light",
}: {
  children: ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <div
      className={cx(
        "max-w-measure text-body",
        tone === "dark" ? "text-muted-dark" : "text-muted",
        "[&>p+p]:mt-5",
        // h2 and h3 share a visual weight; which tag is used is decided by
        // document outline, never by how large the text should look.
        "[&>h2]:mt-12 [&>h2]:font-display [&>h2]:text-h3",
        tone === "dark" ? "[&>h2]:text-on-dark" : "[&>h2]:text-ink",
        "[&>h3]:mt-12 [&>h3]:font-display [&>h3]:text-h3",
        tone === "dark" ? "[&>h3]:text-on-dark" : "[&>h3]:text-ink",
        "[&>h4]:mt-9 [&>h4]:font-display [&>h4]:text-h4",
        tone === "dark" ? "[&>h4]:text-on-dark" : "[&>h4]:text-ink",
        "[&>h2+p]:mt-4 [&>h3+p]:mt-4 [&>h4+p]:mt-3",
        "[&>h2+ul]:mt-4 [&>h3+ul]:mt-4 [&>ul]:mt-5 [&>ul]:space-y-3 [&>ul>li]:relative [&>ul>li]:pl-6",
        "[&>ul>li]:before:absolute [&>ul>li]:before:left-0 [&>ul>li]:before:top-[0.85em]",
        "[&>ul>li]:before:h-px [&>ul>li]:before:w-3 [&>ul>li]:before:bg-accent",
        "[&>ol]:mt-5 [&>ol]:space-y-3 [&>ol]:list-decimal [&>ol]:pl-5",
        "[&_strong]:font-medium",
        tone === "dark" ? "[&_strong]:text-on-dark" : "[&_strong]:text-ink",
        "[&_a]:underline [&_a]:underline-offset-4",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ── Numbered / lettered stack ─────────────────────────────────────────────
   The repeating editorial device across the site: index numeral in the
   accent, display subhead, body at measure, hairline above. ---------------- */

export function IndexedList({
  items,
  tone = "light",
  columns = 1,
}: {
  items: { n: string; title: string; body: ReactNode; meta?: string }[];
  tone?: "light" | "dark";
  columns?: 1 | 2 | 3 | 4;
}) {
  const cols = {
    1: "",
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  } as const;
  const dark = tone === "dark";
  return (
    <ol className={cx("grid gap-x-10", cols[columns])}>
      {items.map((item, i) => (
        <Reveal as="li" key={item.n + item.title} delay={i * 50}>
          <div
            className={cx(
              "flex h-full flex-col border-t pt-7",
              columns === 1 && "pb-9",
              dark ? "border-[var(--rule-dark)]" : "border-[var(--rule-strong)]"
            )}
          >
            <div className="flex items-baseline justify-between gap-4">
              <span
                className={cx(
                  "font-sans text-micro font-medium tabular-nums tracking-[0.1em]",
                  dark ? "text-accent-light" : "text-accent"
                )}
              >
                {item.n}
              </span>
              {item.meta && (
                <span
                  className={cx(
                    "text-micro uppercase tracking-[0.08em] tabular-nums",
                    dark ? "text-muted-dark" : "text-muted"
                  )}
                >
                  {item.meta}
                </span>
              )}
            </div>
            <h3
              className={cx(
                "mt-6 font-display text-h4",
                dark ? "text-on-dark" : "text-ink"
              )}
            >
              {item.title}
            </h3>
            <div
              className={cx(
                "mt-4 max-w-measure text-base",
                dark ? "text-muted-dark" : "text-muted"
              )}
            >
              {item.body}
            </div>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}

/* ── Embed slot ────────────────────────────────────────────────────────────
   Designed frame for a third-party embed (calendar, map) that has not been
   supplied. Same principle as PhotoSlot: honest, deliberate, holds layout. -- */

export function EmbedSlot({
  label,
  brief,
  ratio = "16 / 10",
  className,
}: {
  label: string;
  brief: string;
  ratio?: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative flex flex-col justify-end border border-[var(--rule)] bg-paper-alt",
        className
      )}
      style={{ aspectRatio: ratio }}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        {(
          [
            "left-0 top-0 border-l border-t",
            "right-0 top-0 border-r border-t",
            "left-0 bottom-0 border-l border-b",
            "right-0 bottom-0 border-r border-b",
          ] as const
        ).map((pos) => (
          <span
            key={pos}
            className={cx("absolute h-5 w-5 border-[var(--rule-strong)]", pos)}
          />
        ))}
      </span>
      <div className="relative p-6 md:p-8">
        <p className="text-eyebrow font-medium uppercase tracking-[0.14em] text-accent">
          Integration · to be connected
        </p>
        <p className="mt-3 font-display text-h4 text-ink">{label}</p>
        <p className="mt-2 max-w-[46ch] text-small text-muted">{brief}</p>
      </div>
    </div>
  );
}

/* ── Production note ───────────────────────────────────────────────────────
   Visible only while the underlying content is unresolved. Disappears
   entirely once the real material is supplied. ----------------------------- */

export function ProductionNote({ children }: { children: ReactNode }) {
  // The `production-note` hooks let globals.css swap both colours for their
  // dark-ground equivalents when this sits inside a `tone="dark"` section.
  // Without that, the note renders near-black on near-black.
  return (
    <p className="production-note mt-6 max-w-measure border-l-2 border-accent-rule pl-5 text-small text-muted">
      <span className="production-note-label font-medium text-accent">Production note.</span>{" "}
      {children}
    </p>
  );
}

/* ── Reusable closing CTA ──────────────────────────────────────────────────── */

export function CtaBand({
  title = "One conversation. Then options you can actually compare.",
  body = "Tell us a little about who depends on you and what you are covering. We will come back with what the carriers we work with can offer someone in your circumstances.",
}: {
  title?: ReactNode;
  body?: ReactNode;
}) {
  return (
    <Section tone="dark" className="border-b border-[var(--rule-dark)]">
      <Container>
        <Reveal>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-6">
              <Eyebrow tone="light">Start here</Eyebrow>
              <Display as="h2" size="h2" className="mt-6 max-w-[16ch]">
                {title}
              </Display>
            </div>
            <div className="lg:col-span-5 lg:col-start-8 lg:self-end">
              <p className="max-w-measure text-body text-muted-dark">{body}</p>
              <div className="mt-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
                <Button href={routes.quote} variant="onDark" size="large">
                  Get Your Quote <Arrow />
                </Button>
                <TextLink href={routes.schedule} tone="dark" className="text-small">
                  Book a call <Arrow />
                </TextLink>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
