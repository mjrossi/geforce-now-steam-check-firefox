import type { GfnApp, GfnIndex } from "./types";
import { buildIndex } from "./index-feed";

export interface FeedCache {
  fetchedAt: number;
  index: GfnIndex;
}

export interface LoadDeps {
  getCache: () => Promise<FeedCache | null>;
  setCache: (cache: FeedCache) => Promise<void>;
  fetchFeed: () => Promise<GfnApp[]>;
  now: () => number;
  ttlMs: number;
  /** When true, ignore a fresh cache and refetch (manual debug refresh). */
  forceRefresh?: boolean;
}

export type LoadResult =
  | { ok: true; index: GfnIndex }
  | { ok: false; index: null };

/** Return a usable GFN index, refreshing from the network when the cache is
 *  missing or older than ttlMs. On fetch failure, fall back to stale cache if
 *  present; otherwise report failure so callers render "unknown", never a false
 *  "not supported". */
export async function loadIndex(deps: LoadDeps): Promise<LoadResult> {
  const cache = await deps.getCache();
  const fresh =
    !deps.forceRefresh && cache !== null && deps.now() - cache.fetchedAt < deps.ttlMs;
  if (fresh) return { ok: true, index: cache.index };

  try {
    const feed = await deps.fetchFeed();
    const index = buildIndex(feed);
    await deps.setCache({ fetchedAt: deps.now(), index });
    return { ok: true, index };
  } catch {
    if (cache !== null) return { ok: true, index: cache.index };
    return { ok: false, index: null };
  }
}
