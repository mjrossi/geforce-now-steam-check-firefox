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
 *  Success is judged by whether `fetchedAt` advanced, **not** by `LoadResult.ok`:
 *  when a fetch fails but a cache exists, `loadIndex` deliberately reports `ok`
 *  and serves the stale index (that is the "never a false not-supported"
 *  invariant). Correct for a lookup, wrong for a refresh button — the user would
 *  be told the refresh worked while the timestamp sat still.
 *
 *  `forceLoad` is injected rather than calling `loadIndex` directly so the
 *  background can route it through its serializing queue; without that, a
 *  concurrent lookup-driven fetch could be the thing that moved `fetchedAt`. */
export async function refreshCatalog(
  getCache: LoadDeps["getCache"],
  forceLoad: () => Promise<LoadResult>,
): Promise<RefreshResponse> {
  const before = await readStatus(getCache);
  await forceLoad();
  const status = await readStatus(getCache);

  const refetched = status !== null && (before === null || status.fetchedAt > before.fetchedAt);
  return { ok: refetched, status };
}
