import type { FaqItem } from "@/lib/faq";
import { TokenText } from "./Token";
import { cx } from "./primitives";

/**
 * Disclosure list built on native <details>/<summary>.
 *
 * Works with JavaScript disabled, keyboard-operable by default, and announced
 * correctly by screen readers without any ARIA of our own. The only styling
 * trick is hiding the default marker and rotating one half of a drawn plus.
 */
export function Accordion({
  items,
  openFirst = false,
  tone = "light",
  className,
}: {
  items: FaqItem[];
  openFirst?: boolean;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <div
      className={cx(
        "border-t",
        dark ? "border-[var(--rule-dark-strong)]" : "border-[var(--rule-strong)]",
        className
      )}
    >
      {items.map((item, i) => (
        <details
          key={item.q}
          open={openFirst && i === 0}
          className={cx("group border-b", dark ? "border-[var(--rule-dark)]" : "border-[var(--rule)]")}
        >
          <summary
            className={cx(
              "flex cursor-pointer list-none items-start justify-between gap-8 py-6",
              "font-display text-h4 transition-colors [&::-webkit-details-marker]:hidden",
              dark ? "text-on-dark hover:text-accent-light" : "text-ink hover:text-accent"
            )}
          >
            <span className="text-balance">{item.q}</span>
            <span
              aria-hidden="true"
              className={cx(
                "relative mt-2 block h-3 w-3 shrink-0",
                dark ? "text-accent-light" : "text-accent"
              )}
            >
              <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-current" />
              <span
                className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-current
                           transition-transform duration-200 ease-editorial group-open:rotate-90"
              />
            </span>
          </summary>
          <div
            className={cx(
              "max-w-measure pb-7 pr-8 text-base",
              dark ? "text-muted-dark" : "text-muted"
            )}
          >
            <TokenText text={item.a} />
          </div>
        </details>
      ))}
    </div>
  );
}
