import { loadIndex, type LoadDeps, type LoadResult } from "./feed-cache";

export interface LoadCoordinator {
  /** TTL-respecting load. Concurrent callers share one in-flight load. */
  load: () => Promise<LoadResult>;
  /** Forced refetch, ignoring the TTL. Never shared — the caller needs the
   *  outcome of *its own* refetch — but still serialized against `load`. */
  forceLoad: () => Promise<LoadResult>;
}

/** Serialize and de-duplicate catalog loads.
 *
 *  `loadIndex` is pure and stateless, so nothing stopped concurrent callers each
 *  driving a full paginated fetch. That is the ordinary case, not an exotic one:
 *  restore a session with several Steam tabs and they all message the background
 *  within milliseconds of each other, on a cache that went stale overnight.
 *
 *  Two mechanisms, each doing a distinct job:
 *  - *Sharing* collapses a burst of concurrent lookups onto one fetch, so they
 *    also share its failure instead of retrying it N times while offline.
 *  - *Serializing* keeps a forced refresh from running a second full paginated
 *    fetch alongside a lookup-driven one. It also means a load queued behind a
 *    successful one finds the cache already fresh and returns without fetching at
 *    all. (This used to carry a second job — making `refreshCatalog`'s
 *    before/after `fetchedAt` comparison trustworthy — which it never fully did.
 *    That comparison is gone; `LoadResult.refetched` reports on the load that
 *    wrote the cache, so correctness no longer rests on the ordering here.) */
export function createLoadCoordinator(deps: LoadDeps): LoadCoordinator {
  // Tail of the serialization chain. Never rejects: `loadIndex` resolves even on
  // fetch failure, and the guard keeps a hostile injected dep from stalling it.
  let chain: Promise<unknown> = Promise.resolve();
  let shared: Promise<LoadResult> | null = null;

  function enqueue(op: () => Promise<LoadResult>): Promise<LoadResult> {
    const run = chain.then(op);
    chain = run.catch(() => undefined);
    return run;
  }

  return {
    load() {
      if (shared !== null) return shared;
      // Clear the slot inside the operation, not by chaining onto the returned
      // promise: a chained handler runs a microtask *after* the awaiting caller
      // resumes, so the next load would join an already-settled promise — and a
      // load issued right after a failure would be handed that failure instead
      // of retrying.
      const run: Promise<LoadResult> = enqueue(async () => {
        try {
          return await loadIndex(deps);
        } finally {
          // Only clear our own slot: a later load may already have claimed it.
          if (shared === run) shared = null;
        }
      });
      shared = run;
      return run;
    },
    forceLoad() {
      return enqueue(() => loadIndex({ ...deps, forceRefresh: true }));
    },
  };
}
