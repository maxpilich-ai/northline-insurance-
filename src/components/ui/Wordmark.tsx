import Link from "next/link";
import { isResolved, site } from "@/lib/site.config";
import { Token } from "./Token";
import { Logo } from "./Logo";
import { cx } from "./primitives";

/**
 * The logo lockup: geometric mark + name set in Fraunces.
 *
 * Two configurations, both built from the same parts:
 *   · compact  — mark + one line of name (header, tight spaces)
 *   · stacked  — mark + name over the descriptor (footer, share image)
 *
 * The mark inherits currentColor, so the same component serves the paper and
 * the dark ground. Where the company name is still a {{TOKEN}} the mark
 * continues to render — a brand can have a mark before it has a confirmed
 * legal name, and hiding it would leave the header empty.
 */
export function Wordmark({
  tone = "ink",
  withDescriptor = false,
  className,
}: {
  tone?: "ink" | "dark";
  withDescriptor?: boolean;
  className?: string;
}) {
  const dark = tone === "dark";
  const named = isResolved(site.companyName);

  /* Split "Northline Life & Insurance" so the distinctive word carries the
     display face and the category sits underneath in small caps. Falls back to
     setting the whole string on one line if it has no obvious split. */
  const parts = named ? site.companyName.split(" ") : [];
  const lead = named ? parts[0] : site.companyName;
  const rest = named ? parts.slice(1).join(" ") : "";

  return (
    <Link
      href="/"
      className={cx("group inline-flex items-center gap-3 md:gap-3.5", className)}
      aria-label={named ? `${site.companyName} — home` : "Home"}
    >
      <Logo
        size={withDescriptor ? 30 : 26}
        className={cx(
          "transition-colors",
          dark ? "text-accent-light" : "text-accent"
        )}
      />

      <span className="flex flex-col leading-none">
        <span
          className={cx(
            "font-display tracking-[-0.015em]",
            withDescriptor ? "text-[1.5rem]" : "text-[1.25rem] md:text-[1.375rem]",
            dark ? "text-on-dark" : "text-ink"
          )}
        >
          {named ? lead : <Token value={site.companyName} />}
        </span>

        {named && rest && !withDescriptor && (
          <span
            className={cx(
              "mt-[0.35em] text-[0.5rem] font-medium uppercase tracking-[0.2em] md:text-[0.5625rem]",
              dark ? "text-muted-dark" : "text-muted"
            )}
          >
            {rest}
          </span>
        )}

        {withDescriptor && (
          <span
            className={cx(
              "mt-2.5 text-eyebrow font-medium uppercase tracking-[0.14em]",
              dark ? "text-muted-dark" : "text-muted"
            )}
          >
            Independent Life Insurance Brokerage
          </span>
        )}
      </span>
    </Link>
  );
}
