"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Moves focus to its child heading once, on mount.
 *
 * WHY. The forms navigate with the client router. A client-side navigation
 * changes the DOM without moving focus, so after submitting a form a keyboard
 * or screen-reader user is left on `document.body` with nothing announced —
 * they have no way of knowing the submission succeeded except by re-reading the
 * page from the top. Focusing the confirmation heading makes the outcome the
 * first thing announced, and puts the caret at the top of the new page for
 * everybody.
 *
 * `tabIndex={-1}` makes the heading programmatically focusable without adding
 * it to the tab order, and the outline is suppressed because focus here is
 * a consequence of navigation rather than of the user targeting the element.
 */
export function FocusOnMount({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const heading = ref.current?.querySelector<HTMLElement>("h1");
    if (!heading) return;
    heading.setAttribute("tabindex", "-1");
    heading.style.outline = "none";
    heading.focus({ preventScroll: true });
  }, []);

  return <div ref={ref}>{children}</div>;
}
