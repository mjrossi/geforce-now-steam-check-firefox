import { describe, expect, test, vi } from "vitest";
import { CACHE_VERSION, loadIndex, type FeedCache, type LoadDeps } from "../src/feed/feed-cache";
import type { GfnApp } from "../src/feed/types";

const steamApp: GfnApp = {
  id: "1",
  cmsId: 100620,
  title: "T",
  variants: [
    {
      appStore: "STEAM",
      storeUrl: "https://store.steampowered.com/app/620",
      gfn: { features: [{ key: "RTX_ENABLED", value: "true" }] },
    },
  ],
};

function deps(over: Partial<LoadDeps>): LoadDeps {
  return {
    getCache: async () => null,
    setCache: async () => {},
    fetchFeed: async () => [steamApp],
    now: () => 1_000_000,
    ttlMs: 1000,
    ...over,
  };
}

describe("loadIndex", () => {
  test("fresh cache is returned without fetching", async () => {
    const cache: FeedCache = {
      fetchedAt: 999_500,
      version: CACHE_VERSION,
      index: { "620": { rtx: true } },
    };
    const fetchFeed = vi.fn();
    const result = await loadIndex(deps({ getCache: async () => cache, fetchFeed, now: () => 1_000_000 }));
    expect(result).toEqual({ ok: true, index: { "620": { rtx: true } } });
    expect(fetchFeed).not.toHaveBeenCalled();
  });

  test("missing cache → fetches, builds, stores versioned cache, returns index", async () => {
    const setCache = vi.fn(async () => {});
    const result = await loadIndex(deps({ getCache: async () => null, setCache }));
    expect(result).toEqual({
      ok: true,
      index: { "620": { rtx: true, gfnId: "1", cmsId: 100620 } },
    });
    expect(setCache).toHaveBeenCalledWith({
      fetchedAt: 1_000_000,
      version: CACHE_VERSION,
      index: { "620": { rtx: true, gfnId: "1", cmsId: 100620 } },
    });
  });

  test("stale cache → refetches", async () => {
    const stale: FeedCache = { fetchedAt: 0, version: CACHE_VERSION, index: { "1": { rtx: false } } };
    const fetchFeed = vi.fn(async () => [steamApp]);
    const result = await loadIndex(deps({ getCache: async () => stale, fetchFeed }));
    expect(fetchFeed).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      index: { "620": { rtx: true, gfnId: "1", cmsId: 100620 } },
    });
  });

  // A pre-versioning cache (written before the `version` field existed),
  // time-fresh so only the schema mismatch can force a refetch.
  const preV2Cache: FeedCache = { fetchedAt: 999_500, index: { "1": { rtx: false } } };

  test("time-fresh cache from an older schema version → refetches", async () => {
    const fetchFeed = vi.fn(async () => [steamApp]);
    const result = await loadIndex(deps({ getCache: async () => preV2Cache, fetchFeed, now: () => 1_000_000 }));
    expect(fetchFeed).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      index: { "620": { rtx: true, gfnId: "1", cmsId: 100620 } },
    });
  });

  test("time-fresh v2 cache (gfnId but no cmsId) → refetches", async () => {
    const v2Cache: FeedCache = {
      fetchedAt: 999_500,
      version: 2,
      index: { "1": { rtx: false, gfnId: "u" } },
    };
    const fetchFeed = vi.fn(async () => [steamApp]);
    const result = await loadIndex(deps({ getCache: async () => v2Cache, fetchFeed, now: () => 1_000_000 }));
    expect(fetchFeed).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      index: { "620": { rtx: true, gfnId: "1", cmsId: 100620 } },
    });
  });

  test("old-schema cache + fetch failure → serve the old cache, ok:true", async () => {
    const result = await loadIndex(deps({
      getCache: async () => preV2Cache,
      fetchFeed: async () => { throw new Error("network"); },
      now: () => 1_000_000,
    }));
    expect(result).toEqual({ ok: true, index: { "1": { rtx: false } } });
  });

  test("fetch fails with stale cache present → serve stale, ok:true", async () => {
    const stale: FeedCache = { fetchedAt: 0, version: CACHE_VERSION, index: { "1": { rtx: false } } };
    const result = await loadIndex(deps({
      getCache: async () => stale,
      fetchFeed: async () => { throw new Error("network"); },
    }));
    expect(result).toEqual({ ok: true, index: { "1": { rtx: false } } });
  });

  test("fetch fails with no cache → ok:false", async () => {
    const result = await loadIndex(deps({
      getCache: async () => null,
      fetchFeed: async () => { throw new Error("network"); },
    }));
    expect(result).toEqual({ ok: false, index: null });
  });
});
