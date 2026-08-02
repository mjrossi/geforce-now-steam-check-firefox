import type { LoadDeps, LoadResult } from "./feed-cache";
import type { RefreshResponse, StatusResponse } from "../shared/messages";

/** Describe the cached catalog for the popup.
 *
 *  Reads the cache only — this must never trigger a fetch, or merely opening the
 *  popup would kick off catalog traffic. */
export async function readStatus(getCache: LoadDeps["getCache"]): Promise<StatusResponse> {
  const cache = await getCache();
  if (cache === null) return null;
  return { count: Object.keys(cache.index).length, fetchedAt: cache.fetchedAt };
}

/** Refetch the catalog now, ignoring the TTL — the user-facing recovery path for
 *  a badge that looks wrong.
 *
 *  Success is `LoadResult.refetched`, **not** `LoadResult.ok`: when a fetch fails
 *  but a cache exists, `loadIndex` deliberately reports `ok` and serves the stale
 *  index (that is the "never a false not-supported" invariant). Correct for a
 *  lookup, wrong for a refresh button — the user would be told the refresh worked
 *  while the cache sat untouched.
 *
 *  This used to compare `fetchedAt` before and after, which was a heuristic with
 *  a hole in it: the snapshot had to be taken before `forceLoad` could claim its
 *  place in the background's queue, so a lookup-driven fetch landing in between
 *  moved the timestamp and a *failed* refresh reported success. `refetched` is
 *  reported by the load that actually wrote the cache, so no concurrent write can
 *  be mistaken for this one.
 *
 *  `status` is read after the load and returned either way — on failure it still
 *  describes the stale catalog, which is what the popup should keep showing. */
export async function refreshCatalog(
  getCache: LoadDeps["getCache"],
  forceLoad: () => Promise<LoadResult>,
): Promise<RefreshResponse> {
  const result = await forceLoad();
  return { ok: result.refetched, status: await readStatus(getCache) };
}
