import { describe, expect, test, vi } from "vitest";
import { loadIndex, type FeedCache, type LoadDeps } from "../src/feed/feed-cache";
import type { GfnFeedEntry } from "../src/feed/types";

const steamEntry: GfnFeedEntry = {
  id: 1, title: "T", sortName: "t", isFullyOptimized: true,
  steamUrl: "https://store.steampowered.com/app/620", store: "Steam",
  publisher: "P", genres: [], status: "AVAILABLE",
};

function deps(over: Partial<LoadDeps>): LoadDeps {
  return {
    getCache: async () => null,
    setCache: async () => {},
    fetchFeed: async () => [steamEntry],
    now: () => 1_000_000,
    ttlMs: 1000,
    ...over,
  };
}

describe("loadIndex", () => {
  test("fresh cache is returned without fetching", async () => {
    const cache: FeedCache = { fetchedAt: 999_500, index: { "620": { rtx: true } } };
    const fetchFeed = vi.fn();
    const result = await loadIndex(deps({ getCache: async () => cache, fetchFeed, now: () => 1_000_000 }));
    expect(result).toEqual({ ok: true, index: { "620": { rtx: true } } });
    expect(fetchFeed).not.toHaveBeenCalled();
  });

  test("missing cache → fetches, builds, stores, returns index", async () => {
    const setCache = vi.fn(async () => {});
    const result = await loadIndex(deps({ getCache: async () => null, setCache }));
    expect(result).toEqual({ ok: true, index: { "620": { rtx: true } } });
    expect(setCache).toHaveBeenCalledWith({ fetchedAt: 1_000_000, index: { "620": { rtx: true } } });
  });

  test("stale cache → refetches", async () => {
    const stale: FeedCache = { fetchedAt: 0, index: { "1": { rtx: false } } };
    const fetchFeed = vi.fn(async () => [steamEntry]);
    const result = await loadIndex(deps({ getCache: async () => stale, fetchFeed }));
    expect(fetchFeed).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, index: { "620": { rtx: true } } });
  });

  test("fetch fails with stale cache present → serve stale, ok:true", async () => {
    const stale: FeedCache = { fetchedAt: 0, index: { "1": { rtx: false } } };
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
