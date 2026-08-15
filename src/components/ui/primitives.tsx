import Link from "next/link";
import type { ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ── Shell ─────────────────────────────────────────────────────────────── */

export function Container({
  children,
  className,
  width = "shell",
}: {
  children: ReactNode;
  className?: string;
  width?: "shell" | "content" | "measure";
}) {
  const w =
    width === "content" ? "max-w-content" : width === "measure" ? "max-w-measure" : "max-w-shell";
  return <div className={cx("mx-auto w-full px-gutter", w, className)}>{children}</div>;
}

export function Section({
  children,
  className,
  tone = "paper",
  size = "default",
  id,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  tone?: "paper" | "alt" | "dark";
  size?: "default" | "sm" | "none";
  id?: string;
  as?: "section" | "div" | "footer";
}) {
  const tones = {
    paper: "bg-paper text-ink",
    alt: "bg-paper-alt text-ink",
    dark: "bg-ink-deep text-on-dark on-dark",
  } as const;
  const sizes = {
    default: "py-section",
    sm: "py-section-sm",
    none: "",
  } as const;
  return (
    <Tag id={id} className={cx(tones[tone], sizes[size], className)}>
      {children}
    </Tag>
  );
}

/* ── Type ──────────────────────────────────────────────────────────────── */

export function Eyebrow({
  children,
  className,
  tone = "muted",
}: {
  children: ReactNode;
  className?: string;
  tone?: "muted" | "accent" | "light";
}) {
  const tones = {
    muted: "text-muted",
    accent: "text-accent",
    light: "text-accent-light",
  } as const;
  return (
    <p
      className={cx(
        "text-eyebrow font-medium uppercase tracking-[0.14em]",
        tones[tone],
        className
      )}
    >
      {children}
    </p>
  );
}

export function Display({
  children,
  className,
  as: Tag = "h2",
  size = "h1",
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p";
  size?: "display" | "h1" | "h2" | "h3";
}) {
  const sizes = {
    display: "text-display",
    h1: "text-h1",
    h2: "text-h2",
    h3: "text-h3",
  } as const;
  return (
    <Tag className={cx("font-display font-normal text-balance", sizes[size], className)}>
      {children}
    </Tag>
  );
}

export function Lede({
  children,
  className,
  tone = "muted",
}: {
  children: ReactNode;
  className?: string;
  tone?: "muted" | "ink" | "dark";
}) {
  const tones = {
    muted: "text-muted",
    ink: "text-ink",
    dark: "text-muted-dark",
  } as const;
  return (
    <p className={cx("text-body-lg max-w-measure text-pretty", tones[tone], className)}>
      {children}
    </p>
  );
}

/* ── Rules ─────────────────────────────────────────────────────────────── */

export function Rule({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <hr
      className={cx(
        "border-0 border-t",
        tone === "dark" ? "border-t-[var(--rule-dark)]" : "border-t-[var(--rule)]",
        className
      )}
    />
  );
}

/* ── Buttons ───────────────────────────────────────────────────────────── */

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "onDark" | "ghost";
  size?: "default" | "large";
  className?: string;
};

export function Button({
  href,
  children,
  variant = "primary",
  size = "default",
  className,
}: ButtonProps) {
  const base =
    "group inline-flex items-center justify-center gap-2.5 rounded border font-medium " +
    "transition-colors duration-200 ease-editorial whitespace-nowrap";
  const sizes = {
    default: "px-6 py-3 text-small tracking-[0.01em]",
    large: "px-8 py-4 text-base tracking-[0.01em]",
  } as const;
  const variants = {
    primary: "bg-accent border-accent text-paper hover:bg-accent-hover hover:border-accent-hover",
    secondary:
      "bg-transparent border-[var(--rule-strong)] text-ink hover:border-ink hover:bg-ink hover:text-paper",
    onDark: "bg-paper border-paper text-ink hover:bg-accent-light hover:border-accent-light",
    ghost:
      "border-transparent px-0 py-1 text-ink underline decoration-[var(--rule-strong)] " +
      "underline-offset-4 hover:decoration-ink",
  } as const;
  return (
    <Link href={href} className={cx(base, sizes[size], variants[variant], className)}>
      {children}
    </Link>
  );
}

/** Understated arrow that nudges on hover. The only decorative motion on the site. */
export function Arrow({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-block transition-transform duration-200 ease-editorial group-hover:translate-x-0.5",
        className
      )}
    >
      →
    </span>
  );
}

/* ── Text link ─────────────────────────────────────────────────────────── */

export function TextLink({
  href,
  children,
  tone = "ink",
  className,
}: {
  href: string;
  children: ReactNode;
  tone?: "ink" | "dark" | "accent";
  className?: string;
}) {
  const tones = {
    ink: "text-ink decoration-[var(--rule-strong)] hover:decoration-ink",
    dark: "text-on-dark decoration-[var(--rule-dark-strong)] hover:decoration-on-dark",
    accent: "text-accent decoration-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:decoration-accent",
  } as const;
  return (
    <Link
      href={href}
      className={cx(
        // py-1 lifts the hit area past the 24px minimum without changing how
        // the link looks. Inline links inside a sentence are exempt from the
        // target-size rule; these are standalone calls to action and are not.
        "group inline-flex items-center gap-2 py-1 underline underline-offset-[6px] " +
          "transition-colors duration-200 ease-editorial",
        tones[tone],
        className
      )}
    >
      {children}
    </Link>
  );
}
