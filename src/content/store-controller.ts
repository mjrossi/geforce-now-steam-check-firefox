import { isDefinitive, type BadgeState } from "../feed/resolve-state";

export interface StoreControllerDeps {
  /** Ask about this page's app. Contracted never to reject (shared/lookup.ts). */
  lookup: () => Promise<BadgeState>;
  /** Render an answer into the page. */
  paint: (state: BadgeState) => void;
  /** Backoff schedule for re-asking after a non-definitive answer. */
  delays: readonly number[];
}

export interface StoreController {
  /** Look up, paint, and schedule a retry if the answer wasn't definitive. */
  run: () => Promise<void>;
  /** Re-ask now, restarting the backoff — but only while the current answer is
   *  non-definitive. For "the user came back to the tab", where the interesting
   *  case is a banner still saying "enable this in the toolbar". */
  retryPending: () => void;
  /** Re-ask now regardless of the current answer, restarting the backoff. For "a
   *  new catalog landed", where even a definitive answer may now be wrong. */
  recheck: () => void;
  /** Latest answer, or null before the first one arrives. */
  state: () => BadgeState | null;
}

/** The store page's retry state machine.
 *
 *  Split out of store.ts because that module is unavoidably side-effecting — it
 *  fires a lookup and registers observers at import time — and so could not be
 *  imported by a test without doing all of that. The wishlist's memo got this
 *  treatment first; the store's logic is now the more intricate of the two, since
 *  a game page can sit idle forever and has to drive its own retries rather than
 *  getting them free from scrolling.
 *
 *  Timers are the real `setTimeout`, not an injected clock: tests use fake timers
 *  and therefore exercise the same code that ships. */
export function createStoreController(deps: StoreControllerDeps): StoreController {
  let state: BadgeState | null = null;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;

  /** Queue the next retry, or stop once the backoff is exhausted. Keeps a single
   *  timer so an externally driven retry can't stack a second chain on top. */
  function scheduleRetry(): void {
    const delay = deps.delays[attempt];
    if (delay === undefined) return;
    attempt += 1;
    if (retryTimer !== undefined) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => void run(), delay);
  }

  async function run(): Promise<void> {
    if (inFlight) return;

    inFlight = true;
    let next: BadgeState;
    try {
      next = await deps.lookup();
    } catch {
      // The lookup path is contracted never to reject. If that ever breaks, fall
      // back to the retryable state rather than letting the rejection escape a
      // timer callback and stop the backoff dead.
      next = { kind: "unknown" };
    } finally {
      inFlight = false;
    }

    state = next;
    deps.paint(next);
    if (!isDefinitive(next)) scheduleRetry();
  }

  /** Drop any pending retry and start over from the first delay. */
  function restart(): void {
    attempt = 0;
    if (retryTimer !== undefined) {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    }
    void run();
  }

  return {
    run,
    retryPending() {
      if (state === null || isDefinitive(state)) return;
      restart();
    },
    recheck: restart,
    state: () => state,
  };
}
