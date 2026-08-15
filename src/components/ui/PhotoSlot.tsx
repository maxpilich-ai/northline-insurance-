import { cx } from "./primitives";

/**
 * A designed placeholder for photography that does not yet exist.
 *
 * Deliberately NOT a stock photo. The brief forbids stock imagery, and a
 * generic smiling-family photo would be worse than an honest frame. This
 * renders as a considered editorial plate — hairline frame, correct aspect
 * ratio, and a brief naming exactly which photograph belongs here — so the
 * layout can be judged now and the real image drops in without reflow.
 */
export function PhotoSlot({
  label,
  brief,
  ratio = "4 / 5",
  tone = "light",
  className,
}: {
  label: string;
  brief: string;
  ratio?: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <figure
      className={cx(
        "relative flex flex-col justify-end overflow-hidden border",
        dark
          ? "border-[var(--rule-dark)] bg-[rgba(242,239,232,0.04)]"
          : "border-[var(--rule)] bg-paper-alt",
        className
      )}
      style={{ aspectRatio: ratio }}
    >
      {/* Corner registration marks — a printer's plate detail, not decoration
          for its own sake. Signals "image goes here" without a camera icon. */}
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
            className={cx(
              "absolute h-5 w-5",
              dark ? "border-[var(--rule-dark-strong)]" : "border-[var(--rule-strong)]",
              pos
            )}
          />
        ))}
      </span>

      <figcaption className="relative p-6 md:p-8">
        <span
          className={cx(
            "text-eyebrow font-medium uppercase tracking-[0.14em]",
            dark ? "text-accent-light" : "text-accent"
          )}
        >
          Photography · to be supplied
        </span>
        <span
          className={cx(
            "mt-3 block font-display text-h4",
            dark ? "text-on-dark" : "text-ink"
          )}
        >
          {label}
        </span>
        <span
          className={cx(
            "mt-2 block max-w-[34ch] text-small",
            dark ? "text-muted-dark" : "text-muted"
          )}
        >
          {brief}
        </span>
      </figcaption>
    </figure>
  );
}
