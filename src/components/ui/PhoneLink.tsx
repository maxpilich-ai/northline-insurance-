import { isResolved, site } from "@/lib/site.config";
import { Token } from "./Token";
import { cx } from "./primitives";

/**
 * The office telephone number.
 *
 * When the digits are still a {{TOKEN}} this renders as TEXT rather than an
 * anchor. A `tel:` link built from an unfilled placeholder is worse than no
 * link: on a phone it opens the dialler with nonsense in it, and the visitor
 * concludes the business does not work rather than that the site is unfinished.
 *
 * The number stays visible either way — prominence is the point, and losing the
 * anchor pre-launch costs nothing.
 */
export function PhoneLink({
  className,
  tone = "ink",
  children,
}: {
  className?: string;
  tone?: "ink" | "dark";
  children?: React.ReactNode;
}) {
  const dialable = isResolved(site.phoneHref);
  const content = children ?? <Token value={site.phone} />;

  if (!dialable) {
    return (
      <span className={className} title="Awaiting the office telephone number">
        {content}
      </span>
    );
  }

  return (
    <a
      href={`tel:${site.phoneHref}`}
      className={cx(
        "transition-colors",
        tone === "dark" ? "hover:text-accent-light" : "hover:text-accent",
        className
      )}
    >
      {content}
    </a>
  );
}
