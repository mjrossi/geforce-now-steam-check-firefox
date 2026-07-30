import { describe, expect, it } from "vitest";
import { readStatus, refreshCatalog } from "../src/feed/refresh";
import type { FeedCache, LoadResult } from "../src/feed/feed-cache";
import type { GfnIndex } from "../src/feed/types";

const INDEX: GfnIndex = { "570": { rtx: true }, "730": { rtx: false } };

function cacheAt(fetchedAt: number, index: GfnIndex = INDEX): FeedCache {
  return { fetchedAt, version: 3, index };
}

/** A cache cell plus a "refetch" that either writes it or fails, mirroring what
 *  loadIndex does: on failure it leaves the cache untouched and *still* reports
 *  ok when a stale cache exists, but never reports `refetched`. */
function harness(initial: FeedCache | null) {
  let cache = initial;
  return {
    getCache: () => Promise.resolve(cache),
    /** Succeeds: writes a new cache at `at`, so this load refetched. */
    succeedAt(at: number) {
      return (): Promise<LoadResult> => {
        cache = cacheAt(at);
        return Promise.resolve({ ok: true, index: cache.index, refetched: true });
      };
    },
    /** Fails: cache untouched, ok:true because a stale cache is served. */
    failServingStale(): () => Promise<LoadResult> {
      return () =>
        Promise.resolve(
          cache === null
            ? { ok: false, index: null, refetched: false }
            : { ok: true, index: cache.index, refetched: false },
        );
    },
    /** Fails, but *somebody else* writes the cache meanwhile — a lookup-driven
     *  load finishing while the forced one is queued behind it. */
    failWhileAnotherLoadWrites(at: number): () => Promise<LoadResult> {
      return () => {
        cache = cacheAt(at);
        return Promise.resolve({ ok: true, index: cache.index, refetched: false });
      };
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
  it("reports success when the load refetched", async () => {
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
    // that flag would tell the user their refresh worked while the cache sat
    // untouched.
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

  it("does not credit a concurrent load's write to this refresh", async () => {
    // Why `refetched` exists. This used to compare fetchedAt before and after,
    // and the "before" snapshot had to be taken before forceLoad could claim its
    // place in the background's queue — so a lookup-driven fetch landing in
    // between moved the timestamp and a *failed* refresh reported success.
    // Serializing narrowed that window; only asking the load itself closes it.
    const h = harness(cacheAt(1_000));
    const res = await refreshCatalog(h.getCache, h.failWhileAnotherLoadWrites(9_000));
    expect(res.ok).toBe(false);
    // The status still reflects what is actually cached now — that part is honest.
    expect(res.status).toEqual({ count: 2, fetchedAt: 9_000 });
  });

  it("credits a successful refetch even if the timestamp is unchanged", async () => {
    // The mirror image: a refetch that happened to rewrite the same timestamp is
    // still a refetch. The old comparison called this a failure.
    const h = harness(cacheAt(1_000));
    const res = await refreshCatalog(h.getCache, h.succeedAt(1_000));
    expect(res.ok).toBe(true);
  });
});
