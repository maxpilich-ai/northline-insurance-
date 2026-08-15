"use client";

import type { ReactNode } from "react";
import { cx } from "@/components/ui/primitives";

/**
 * FORM PRIMITIVES
 *
 * Rules encoded here rather than left to each form:
 *  · labels are always visible — never a placeholder standing in for a label
 *  · every input is 16px+ so iOS does not zoom on focus
 *  · errors are announced (role="alert") and linked via aria-describedby
 *  · invalid inputs carry aria-invalid, not just a red border
 *  · hit targets stay thumb-reachable on mobile
 */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  group,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  /**
   * True when the control is a radio group rather than a single form element.
   *
   * A <label for> may only point at ONE labelable element, and a radio group is
   * not one — pointing it at the group's id produces a label referencing an id
   * that does not exist, so the visible question is never announced. In group
   * mode the label is rendered as a span carrying `${htmlFor}-label`, which the
   * group references with aria-labelledby.
   */
  group?: boolean;
  children: ReactNode;
}) {
  const Label = group ? "div" : "label";
  return (
    <div>
      <Label
        {...(group ? {} : { htmlFor })}
        className="flex items-baseline justify-between gap-4"
      >
        <span id={group ? `${htmlFor}-label` : undefined} className="text-small font-medium text-ink">
          {label}
        </span>
        {optional && <span className="text-micro text-muted">Optional</span>}
      </Label>
      {hint && (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-small text-muted">
          {hint}
        </p>
      )}
      <div className="mt-2.5">{children}</div>
      {error && <FieldError id={`${htmlFor}-error`}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-2 flex items-start gap-2 text-small text-[#8C2F1F]">
      <span aria-hidden="true" className="mt-[0.55em] block h-px w-3 shrink-0 bg-current" />
      <span>{children}</span>
    </p>
  );
}

const controlBase =
  "w-full rounded border bg-paper px-4 py-3 text-ink outline-none transition-colors " +
  // Placeholder text at 55% opacity composited to 2.39:1 against the field
// background — below the 4.5:1 WCAG 1.4.3 floor, on hint text that tells
// people what to type (finding R3-L7). Full-strength muted is 5.69:1.
  "placeholder:text-muted focus:border-accent disabled:cursor-not-allowed disabled:opacity-55";

export function Input({
  invalid,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cx(
        controlBase,
        invalid ? "border-[#8C2F1F]" : "border-[var(--rule-strong)]",
        className
      )}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cx(
        controlBase,
        "min-h-[7.5rem] resize-y",
        invalid ? "border-[#8C2F1F]" : "border-[var(--rule-strong)]",
        className
      )}
    />
  );
}

export function Select({
  invalid,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        {...props}
        aria-invalid={invalid || undefined}
        className={cx(
          controlBase,
          "appearance-none pr-11",
          invalid ? "border-[#8C2F1F]" : "border-[var(--rule-strong)]",
          className
        )}
      >
        {children}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 -mt-1 block h-2 w-2 rotate-45
                   border-b border-r border-muted"
      />
    </div>
  );
}

/**
 * Card-style single-select. Used for the wizard's situation and amount steps
 * where the options need room to breathe and explain themselves.
 */
export function OptionCards({
  name,
  options,
  value,
  onChange,
  columns = 1,
  labelledBy,
  label,
  describedBy,
  invalid,
}: {
  name: string;
  options: { value: string; label: string; description?: string }[];
  value: string | null;
  onChange: (v: string) => void;
  columns?: 1 | 2;
  /** id of the visible question that names this group. Preferred over label. */
  labelledBy?: string;
  /** Accessible name when no visible question can be referenced by id. */
  label?: string;
  /**
   * id of the error element describing this group, when it is invalid.
   *
   * FINDING R4-15. Every `<input>`-based field on these forms was wired with
   * `aria-invalid` and `aria-describedby`; the radio groups were not. After a
   * failed submit their errors rendered with `role="alert"` — announced once,
   * as the alert fired — but the group itself reported nothing. Returning focus
   * to it afterwards conveyed no error state and no message, so a screen-reader
   * user who tabbed back to correct the answer was told only "radiogroup".
   */
  describedBy?: string;
  /** True when this group failed validation. */
  invalid?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      {...(labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": label ?? name })}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && describedBy ? describedBy : undefined}
      className={cx("grid gap-3", columns === 2 && "sm:grid-cols-2")}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cx(
              "flex cursor-pointer items-start gap-4 rounded border px-5 py-4 transition-colors",
              selected
                ? "border-accent bg-accent/[0.045]"
                : "border-[var(--rule-strong)] hover:border-ink"
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={cx(
                "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-accent" : "border-[var(--rule-strong)]"
              )}
            >
              {selected && <span className="block h-2 w-2 rounded-full bg-accent" />}
            </span>
            <span className="min-w-0">
              <span className="block text-body text-ink">{opt.label}</span>
              {opt.description && (
                <span className="mt-1 block text-small text-muted">{opt.description}</span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Compact inline radio row — for short, self-evident choices. */
export function RadioRow({
  name,
  options,
  value,
  onChange,
  labelledBy,
  label,
  describedBy,
  invalid,
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
  /** id of the visible question that names this group. Preferred over label. */
  labelledBy?: string;
  /** Accessible name when no visible question can be referenced by id. */
  label?: string;
  /**
   * id of the error element describing this group, when it is invalid.
   *
   * FINDING R4-15. Every `<input>`-based field on these forms was wired with
   * `aria-invalid` and `aria-describedby`; the radio groups were not. After a
   * failed submit their errors rendered with `role="alert"` — announced once,
   * as the alert fired — but the group itself reported nothing. Returning focus
   * to it afterwards conveyed no error state and no message, so a screen-reader
   * user who tabbed back to correct the answer was told only "radiogroup".
   */
  describedBy?: string;
  /** True when this group failed validation. */
  invalid?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      {...(labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": label ?? name })}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && describedBy ? describedBy : undefined}
      className="flex flex-wrap gap-3"
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cx(
              "cursor-pointer rounded border px-5 py-2.5 text-small transition-colors",
              selected
                ? "border-accent bg-accent/[0.045] text-ink"
                : "border-[var(--rule-strong)] text-muted hover:border-ink hover:text-ink"
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}

export function Checkbox({
  id,
  checked,
  onChange,
  children,
  invalid,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  invalid?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3.5">
      {/*
        aria-describedby, like every other field (finding R3-L9).

        The consent checkbox carried aria-invalid="true" and nothing else: the
        error text rendered beside it was never associated with it, so a screen
        reader announced the control as invalid without ever saying why. Every
        other field on these forms is wired up; this one — the one that decides
        whether a TCPA consent record can be written at all — was not.
      */}
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className={cx(
          "mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]",
          invalid && "outline outline-1 outline-offset-2 outline-[#8C2F1F]"
        )}
      />
      <span className="text-small leading-relaxed text-muted">{children}</span>
    </label>
  );
}
