import { describe, expect, it } from "vitest";
import { createLoadCoordinator } from "../src/feed/load-coordinator";
import { CACHE_VERSION, type FeedCache, type LoadDeps } from "../src/feed/feed-cache";
import type { GfnApp } from "../src/feed/types";

const APP: GfnApp = {
  id: "gfn-1",
  cmsId: 100,
  title: "Test Game",
  variants: [
    {
      appStore: "STEAM",
      storeUrl: "https://store.steampowered.com/app/570/?utm_source=gfn",
      gfn: { features: [{ key: "RTX_ENABLED", value: "true" }] },
    },
  ],
};

/** Deferred promise so a test can hold a fetch open and start concurrent loads. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeDeps(overrides: Partial<LoadDeps> = {}) {
  let cache: FeedCache | null = null;
  let fetches = 0;
  const deps: LoadDeps = {
    getCache: () => Promise.resolve(cache),
    setCache: (c) => {
      cache = c;
      return Promise.resolve();
    },
    fetchFeed: () => {
      fetches += 1;
      return Promise.resolve([APP]);
    },
    now: () => 1_000,
    ttlMs: 60_000,
    ...overrides,
  };
  return {
    deps,
    fetchCount: () => fetches,
    getCache: () => cache,
  };
}

describe("createLoadCoordinator", () => {
  it("collapses concurrent loads onto a single fetch", async () => {
    // The scenario this exists for: several restored Steam tabs message the
    // background within milliseconds of each other on a cold/stale cache.
    const gate = deferred<GfnApp[]>();
    let fetches = 0;
    const h = makeDeps({
      fetchFeed: () => {
        fetches += 1;
        return gate.promise;
      },
    });
    const catalog = createLoadCoordinator(h.deps);

    const all = Promise.all([catalog.load(), catalog.load(), catalog.load()]);
    gate.resolve([APP]);
    const results = await all;

    expect(fetches).toBe(1);
    for (const r of results) expect(r.ok).toBe(true);
  });

  it("shares a failure rather than retrying it once per caller", async () => {
    // Offline with no cache: three callers must not mean three failed fetches.
    let fetches = 0;
    const h = makeDeps({
      fetchFeed: () => {
        fetches += 1;
        return Promise.reject(new Error("offline"));
      },
    });
    const catalog = createLoadCoordinator(h.deps);

    const results = await Promise.all([catalog.load(), catalog.load(), catalog.load()]);

    expect(fetches).toBe(1);
    for (const r of results) expect(r.ok).toBe(false);
  });

  it("lets a later load fetch again once the in-flight one has settled", async () => {
    // Sharing must not become caching: a load after the burst is a new decision.
    const h = makeDeps({ now: () => 1_000, ttlMs: 0 });
    const catalog = createLoadCoordinator(h.deps);

    await catalog.load();
    await catalog.load();

    expect(h.fetchCount()).toBe(2);
  });

  it("serves a queued load from the cache the previous one just wrote", async () => {
    // Serialization's other payoff: the second caller finds a fresh cache and
    // never fetches, rather than racing the first.
    const h = makeDeps();
    const catalog = createLoadCoordinator(h.deps);

    await catalog.load();
    const second = await catalog.load();

    expect(h.fetchCount()).toBe(1);
    expect(second.ok).toBe(true);
    expect(h.getCache()?.version).toBe(CACHE_VERSION);
  });

  it("forceLoad refetches even when the cache is fresh", async () => {
    const h = makeDeps();
    const catalog = createLoadCoordinator(h.deps);

    await catalog.load();
    await catalog.forceLoad();

    expect(h.fetchCount()).toBe(2);
  });

  it("never shares forceLoad with a concurrent load", async () => {
    // A manual refresh means "go get it now", so it must not be quietly answered
    // by a lookup's in-flight fetch — the user pressed the button because they
    // believed the catalog on screen was wrong.
    const h = makeDeps();
    const catalog = createLoadCoordinator(h.deps);

    await Promise.all([catalog.load(), catalog.forceLoad()]);

    expect(h.fetchCount()).toBe(2);
  });

  it("serializes forceLoad against an in-flight load", async () => {
    // Ordering keeps a manual refresh from running a second full paginated fetch
    // alongside a lookup-driven one that is already most of the way through.
    const order: string[] = [];
    const gate = deferred<GfnApp[]>();
    let first = true;
    const h = makeDeps({
      fetchFeed: () => {
        if (first) {
          first = false;
          order.push("load:start");
          return gate.promise.then((apps) => {
            order.push("load:end");
            return apps;
          });
        }
        order.push("force:start");
        return Promise.resolve([APP]);
      },
    });
    const catalog = createLoadCoordinator(h.deps);

    const loadPromise = catalog.load();
    const forcePromise = catalog.forceLoad();
    gate.resolve([APP]);
    await Promise.all([loadPromise, forcePromise]);

    expect(order).toEqual(["load:start", "load:end", "force:start"]);
  });

  it("keeps serving callers after a rejected load", async () => {
    // A poisoned chain would wedge the background until the next restart.
    let attempt = 0;
    const h = makeDeps({
      fetchFeed: () => {
        attempt += 1;
        return attempt === 1 ? Promise.reject(new Error("offline")) : Promise.resolve([APP]);
      },
    });
    const catalog = createLoadCoordinator(h.deps);

    const failed = await catalog.load();
    const recovered = await catalog.load();

    expect(failed.ok).toBe(false);
    expect(recovered.ok).toBe(true);
  });
});
