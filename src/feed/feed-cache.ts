import type { GfnApp, GfnIndex } from "./types";
import { buildIndex } from "./index-feed";

/** Cache schema version. Bumped when the index shape changes (v2 added
 *  `gfnId`, v3 added `cmsId`), so an upgraded extension refetches instead of
 *  waiting out the TTL. Pre-versioning caches read back with `version`
 *  undefined and count as v1. */
export const CACHE_VERSION = 3;

export interface FeedCache {
  fetchedAt: number;
  /** Absent on caches written before versioning existed (counts as v1). */
  version?: number;
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

/** `refetched` says whether *this* load wrote a new cache entry — the only
 *  honest answer to "did the refresh button do anything". It is deliberately not
 *  derivable from `ok`, which is true both for a fresh fetch and for a stale
 *  cache served after a failed one. */
export type LoadResult =
  | { ok: true; index: GfnIndex; refetched: boolean }
  | { ok: false; index: null; refetched: false };

/** Return a usable GFN index, refreshing from the network when the cache is
 *  missing or older than ttlMs. On fetch failure, fall back to stale cache if
 *  present; otherwise report failure so callers render "unknown", never a false
 *  "not supported". */
export async function loadIndex(deps: LoadDeps): Promise<LoadResult> {
  const cache = await deps.getCache();
  const fresh =
    !deps.forceRefresh &&
    cache !== null &&
    cache.version === CACHE_VERSION &&
    deps.now() - cache.fetchedAt < deps.ttlMs;
  if (fresh) return { ok: true, index: cache.index, refetched: false };

  try {
    const feed = await deps.fetchFeed();
    const index = buildIndex(feed);
    // `setCache` is inside the try on purpose: if the write fails there is no new
    // cache entry, so this was not a refetch as far as any other caller is
    // concerned, and falling back to stale keeps that consistent.
    await deps.setCache({ fetchedAt: deps.now(), version: CACHE_VERSION, index });
    return { ok: true, index, refetched: true };
  } catch {
    if (cache !== null) return { ok: true, index: cache.index, refetched: false };
    return { ok: false, index: null, refetched: false };
  }
}
