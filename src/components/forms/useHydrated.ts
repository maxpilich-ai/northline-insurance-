"use client";

import { useSyncExternalStore } from "react";

/**
 * True once this component has actually mounted in the browser.
 *
 * WHY IT EXISTS (finding R2-05). The forms are React-controlled and submit with
 * `fetch` from an `onSubmit` handler. If the component never hydrates — a
 * chunk request that fails, a stale CDN entry after a deploy, an extension that
 * blocks the bundle, a flaky network — that handler is never attached, so
 * clicking the button performs the browser's DEFAULT submission instead. The
 * `<form>` has no `action`, so the browser issues a GET to the current URL:
 * every answer the visitor typed is discarded, the page appears to reset, and
 * nothing tells them anything went wrong. Reproduced by blocking
 * `/_next/static/chunks/**`:
 *
 *     URL after clicking Send:  /contact?
 *     name field:               ""      message field: ""
 *     visible alert:            none
 *
 * The `<noscript>` notice does not cover this: scripting is enabled, only the
 * bundle failed.
 *
 * Gating the submit button on this flag makes the failure honest — the control
 * is visibly unavailable and labelled, instead of silently destroying the
 * enquiry. Once hydration completes (the overwhelmingly common case, within
 * milliseconds) the button behaves exactly as before.
 */
const subscribe = () => () => {};

export function useHydrated(): boolean {
  // useSyncExternalStore is the shape React provides for exactly this: the
  // server snapshot is false, the client snapshot is true, and the switch
  // happens as part of hydration rather than as a second render triggered from
  // an effect.
  return useSyncExternalStore(
    subscribe,
    () => true, // client
    () => false // server
  );
}
