import { isDefinitive, type BadgeState } from "../feed/resolve-state";

const UNKNOWN: BadgeState = { kind: "unknown" };

export interface StateMemo {
  /** Which of `visible` still need asking the background about. */
  pending: (visible: Iterable<number>) => number[];
  /** Record an answer, if it is one worth keeping. */
  remember: (appId: number, state: BadgeState) => void;
  /** Best known state for a row — "unknown" ("couldn't check") until resolved. */
  stateFor: (appId: number) => BadgeState;
  /** Forget every answer. For when a *new catalog* arrives: the memo's whole
   *  premise is that a definitive answer stays true, which holds against a fixed
   *  catalog and stops holding the moment one is refetched. */
  forgetAll: () => void;
}

/** Per-tab memo of app ids we already have a *definitive* answer for.
 *
 *  The wishlist is virtualized, so scrolling re-runs the content script
 *  constantly — and our own pill injection wakes the observer that schedules the
 *  next run. Without a memo, every batch re-asks the background about every
 *  visible row.
 *
 *  Only definitive states are stored. "unknown" and "needs-permission" are
 *  transient (offline, or permission not granted yet) and must stay retryable so
 *  badges self-heal without a page reload — the `data-gfn-state` stamp in
 *  wishlist-rows.ts is what lets the placeholder be replaced once they do. */
export function createStateMemo(): StateMemo {
  const resolved = new Map<number, BadgeState>();
  return {
    pending: (visible) => [...visible].filter((id) => !resolved.has(id)),
    remember: (appId, state) => {
      if (isDefinitive(state)) resolved.set(appId, state);
    },
    stateFor: (appId) => resolved.get(appId) ?? UNKNOWN,
    forgetAll: () => resolved.clear(),
  };
}
