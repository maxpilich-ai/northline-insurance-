/**
 * Moves focus to the first field that failed validation.
 *
 * WHY. The forms already announce errors correctly — each message carries
 * `role="alert"`, each control gets `aria-invalid` and an `aria-describedby`
 * pointing at its message. What was missing is where the caret goes: focus
 * stayed on the submit button, so a keyboard user heard that something was
 * wrong and then had to hunt backwards through the form to find out what.
 *
 * The three forms use different id prefixes for the same logical fields
 * (`name`, `c-name`, `a-name`), so the prefix is passed in rather than guessed.
 *
 * Radio groups have no single focusable element with the field's id, so the
 * first radio input carrying the field's name is focused instead. That lookup
 * is deliberately independent of how the group is labelled — see R6-05.
 */
export function focusFirstError(
  errors: Record<string, string>,
  order: string[],
  prefix = ""
): void {
  const firstKey = order.find((key) => errors[key]);
  if (!firstKey) return;

  // Defer to the paint after React has rendered the error state, otherwise the
  // element may not carry aria-describedby yet when focus lands on it.
  requestAnimationFrame(() => {
    const id = `${prefix}${firstKey}`;
    const direct = document.getElementById(id);

    /**
     * FINDING R6-05. The radio-group fallback used to fire only when a label
     * span `${id}-label` existed, because that is how `Field ... group` names a
     * group. Three of the quote wizard's groups are not built that way —
     * `situation`, `amount` and `health` are `OptionCards` labelled by the step
     * heading (`wizard-step-heading`), so `situation-label` does not exist,
     * `target` came back null, and focus stayed on the Continue button on
     * exactly the steps where the radio group IS the whole step.
     *
     * Measured before this change: steps 1, 2 and 4 left focus on
     * `BUTTON "Continue →"`; steps 3's `sex` and `tobacco` (which do have
     * `-label` spans) worked. The site's accessibility suite only exercised
     * `/contact`, which has no radio group at all, so nothing saw it.
     *
     * The label span was never the thing that mattered. What identifies a radio
     * group is a radio input carrying the field's name, so that is what is
     * looked for — no longer conditional on how the group happens to be
     * labelled. `direct` still wins when a real focusable element owns the id,
     * which keeps every input-based field on its existing path.
     */
    const target =
      direct ??
      document.querySelector<HTMLElement>(
        `[role="radiogroup"] input[name="${firstKey}"]`
      );

    if (!target) return;
    target.focus({ preventScroll: false });
    target.scrollIntoView({ block: "center", behavior: "auto" });
  });
}
