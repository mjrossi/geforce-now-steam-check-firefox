import { describe, expect, it } from "vitest";
import { readStatus, refreshCatalog } from "../src/feed/refresh";
import type { FeedCache, LoadResult } from "../src/feed/feed-cache";
import type { GfnIndex } from "../src/feed/types";

const INDEX: GfnIndex = { "570": { rtx: true }, "730": { rtx: false } };

function cacheAt(fetchedAt: number, index: GfnIndex = INDEX): FeedCache {
  return { fetchedAt, version: 3, index };
}

/** A cache cell plus a "refetch" that either advances it or fails, mirroring
 *  what loadIndex does: on failure it leaves the cache untouched and *still*
 *  reports ok when a stale cache exists. */
function harness(initial: FeedCache | null) {
  let cache = initial;
  return {
    getCache: () => Promise.resolve(cache),
    /** Succeeds: writes a new cache at `at`. */
    succeedAt(at: number) {
      return (): Promise<LoadResult> => {
        cache = cacheAt(at);
        return Promise.resolve({ ok: true, index: cache.index });
      };
    },
    /** Fails: cache untouched, but ok:true because a stale cache is served. */
    failServingStale(): () => Promise<LoadResult> {
      return () =>
        Promise.resolve(
          cache === null ? { ok: false, index: null } : { ok: true, index: cache.index },
        );
    },
  };
}

describe("readStatus", () => {
  it("reports index size and fetch time", async () => {
    const h = harness(cacheAt(1_000));
    expect(await readStatus(h.getCache)).toEqual({ count: 2, fetchedAt: 1_000 });
  });

  it("returns null when nothing is cached", async () => {
    const h = harness(null);
    expect(await readStatus(h.getCache)).toBeNull();
  });
});

describe("refreshCatalog", () => {
  it("reports success when the fetch advances fetchedAt", async () => {
    const h = harness(cacheAt(1_000));
    const res = await refreshCatalog(h.getCache, h.succeedAt(2_000));
    expect(res.ok).toBe(true);
    expect(res.status).toEqual({ count: 2, fetchedAt: 2_000 });
  });

  it("reports success on the first ever fetch", async () => {
    const h = harness(null);
    const res = await refreshCatalog(h.getCache, h.succeedAt(2_000));
    expect(res.ok).toBe(true);
    expect(res.status).toEqual({ count: 2, fetchedAt: 2_000 });
  });

  it("reports FAILURE when the fetch fails but a stale cache is served", async () => {
    // The load-bearing case. loadIndex returns ok:true here — deliberately, so a
    // lookup never renders a false "not supported" — and judging the refresh by
    // that flag would tell the user their refresh worked while the timestamp
    // sat still. Only fetchedAt moving proves a refetch actually happened.
    const h = harness(cacheAt(1_000));
    const res = await refreshCatalog(h.getCache, h.failServingStale());
    expect(res.ok).toBe(false);
    // The stale catalog is still described, so the popup can show its real age.
    expect(res.status).toEqual({ count: 2, fetchedAt: 1_000 });
  });

  it("reports failure when the fetch fails with no cache at all", async () => {
    const h = harness(null);
    const res = await refreshCatalog(h.getCache, h.failServingStale());
    expect(res.ok).toBe(false);
    expect(res.status).toBeNull();
  });

  it("does not mistake an unchanged timestamp for success", async () => {
    // A refetch that somehow rewrote the same timestamp is not evidence of a
    // fresh catalog.
    const h = harness(cacheAt(1_000));
    const res = await refreshCatalog(h.getCache, h.succeedAt(1_000));
    expect(res.ok).toBe(false);
  });
});
