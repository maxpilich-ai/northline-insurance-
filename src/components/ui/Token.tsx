import { isResolved } from "@/lib/site.config";
import { cx } from "./primitives";

/**
 * Renders a business fact.
 *
 * If the value is still a {{TOKEN}}, it renders VISIBLY with a dotted accent
 * underline — unverified information must be impossible to miss during review.
 * Once the owner fills the value in, it renders as ordinary text with no
 * marker and no layout shift.
 */
export function Token({
  value,
  className,
  title,
}: {
  value: string;
  className?: string;
  title?: string;
}) {
  const resolved = isResolved(value);
  return (
    <span
      className={cx(!resolved && "token", className)}
      title={!resolved ? title ?? "Awaiting confirmation from the business owner" : undefined}
      data-token={!resolved ? value.replace(/[{}]/g, "") : undefined}
    >
      {value}
    </span>
  );
}

/**
 * Renders a plain string that may contain {{TOKEN}} placeholders inline,
 * marking each placeholder without disturbing the surrounding text.
 *
 * Lets long-form copy live as ordinary strings — which is what makes the same
 * text reusable for structured data — while still surfacing every unverified
 * fact visually.
 */
export function TokenText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\{\{[A-Z0-9_]+\}\})/g).filter(Boolean);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        /^\{\{[A-Z0-9_]+\}\}$/.test(part) ? (
          <Token key={i} value={part} />
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

/**
 * Renders children only when every supplied value is confirmed.
 *
 * This is how the "structurally incapable of publishing an unverified claim"
 * rule is enforced — at the component layer, not in a content pass. A section
 * wrapped in <IfResolved> cannot appear on the live site until its facts exist.
 */
export function IfResolved({
  values,
  children,
  fallback = null,
}: {
  values: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return values.every(isResolved) ? <>{children}</> : <>{fallback}</>;
}
