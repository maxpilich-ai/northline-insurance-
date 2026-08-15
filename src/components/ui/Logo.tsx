import { cx } from "./primitives";

/**
 * NORTHLINE — the geometric "N" mark.
 *
 * Construction: one unbroken polyline. Up the left stem, down the diagonal,
 * then up the right stem — which overshoots the cap line and runs off the top.
 * That overshoot is the whole idea: a line heading north, drawn without lifting
 * the pen. It is also what makes the mark distinguishable from a plain letter N
 * at a glance.
 *
 * Deliberately not: a shield, an umbrella, a family silhouette, a handshake, a
 * compass rose, or a swoosh. Insurance branding is saturated with all six.
 *
 * Drawn on a 40 × 44 grid with a 4-unit stroke and mitred joins, so the ratios
 * stay fixed at every size. Uses currentColor, so it inherits ink on paper and
 * the light accent on the dark ground with no second asset.
 */
export function Logo({
  className,
  size = 34,
  title,
}: {
  className?: string;
  size?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={Math.round((size * 44) / 40)}
      viewBox="0 0 40 44"
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      className={cx("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <path d="M6 40 V8 L34 40 V2" />
    </svg>
  );
}
