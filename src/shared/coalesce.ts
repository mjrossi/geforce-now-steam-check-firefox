/** Serialize an async task, collapsing every request that arrives while it runs
 *  into exactly one follow-up run.
 *
 *  Both content scripts drive their `run()` from several independent triggers — a
 *  debounced MutationObserver, a retry timer, a catalog-epoch change — and `run()`
 *  is async, so those triggers overlap. The two ways of handling that alone are
 *  both wrong:
 *
 *  - *Re-entering* re-asks the background for work already in flight. The wishlist
 *    memo only records an answer after its lookup resolves, so a run starting
 *    inside that window sees the same ids still pending and sends a duplicate
 *    lookup. Normally invisible (a warm lookup beats the 300 ms debounce), but the
 *    window is widest exactly when it costs most: a cold background doing a full
 *    paginated catalog fetch takes seconds, while a scrolling user emits a mutation
 *    batch every 300 ms.
 *  - *Dropping* loses the trigger. A new catalog landing mid-lookup is precisely
 *    the event that invalidates what the page is showing, so a bare in-flight guard
 *    would discard the one re-check that had to happen.
 *
 *  Queueing one follow-up gets both: no duplicate work in flight, and no lost
 *  trigger. Coalescing many requests into one is right rather than merely cheap —
 *  the task re-reads the DOM and the memo from scratch, so one later run subsumes
 *  any number of earlier requests.
 *
 *  If `task` rejects the returned promise rejects with it and the queued run is
 *  skipped; the in-flight flag is still cleared, so the next trigger runs normally.
 *
 *  A request that only queues resolves its own caller straight away — the
 *  follow-up is awaited by the run it queued behind. Every call site is
 *  `void run()`, so that asymmetry is invisible; it would only matter to a caller
 *  awaiting a run to know the queued work had finished. */
export function coalesce(task: () => Promise<void>): () => Promise<void> {
  let inFlight = false;
  let queued = false;

  return async function run(): Promise<void> {
    if (inFlight) {
      queued = true;
      return;
    }
    inFlight = true;
    try {
      await task();
    } finally {
      inFlight = false;
    }
    if (queued) {
      queued = false;
      await run();
    }
  };
}
