import { describe, expect, it, vi } from "vitest";
import { type AppsPage, type FetchPage, fetchAllPages } from "../src/feed/fetch-catalog";
import type { GfnApp } from "../src/feed/types";

function app(id: string): GfnApp {
  return { id, title: id, cmsId: null, variants: [] };
}

/** A fake server serving `pages` (each an array of app ids), cursor = next page
 *  index. `endWith` picks which of the two end-of-catalog signals it uses on the
 *  final page — the walk has to honour either one on its own. */
function pager(pages: string[][], endWith: "hasNextPage" | "endCursor" = "hasNextPage"): FetchPage {
  return (after: string | null) => {
    const index = after === null ? 0 : Number(after);
    const last = index === pages.length - 1;
    const more = { hasNextPage: true, endCursor: String(index + 1) };
    const done =
      endWith === "hasNextPage"
        ? { hasNextPage: false, endCursor: String(index + 1) }
        : { hasNextPage: true, endCursor: null };
    const page: AppsPage = {
      items: (pages[index] ?? []).map(app),
      pageInfo: last ? done : more,
    };
    return Promise.resolve(page);
  };
}

describe("fetchAllPages", () => {
  it("concatenates every page in order and reports how many it took", async () => {
    const result = await fetchAllPages(pager([["a", "b"], ["c"], ["d"]]), 20);

    expect(result.apps.map((a) => a.id)).toEqual(["a", "b", "c", "d"]);
    expect(result.pages).toBe(3);
    expect(result.truncated).toBe(false);
  });

  it("passes the previous page's cursor to the next fetch", async () => {
    // The cursor is the whole reason this loop exists: forget to advance it and
    // the walk requests page 0 forever, up to MAX_PAGES.
    const seen: (string | null)[] = [];
    const inner = pager([["a"], ["b"], ["c"]]);
    const spy: FetchPage = (after) => {
      seen.push(after);
      return inner(after);
    };

    await fetchAllPages(spy, 20);

    expect(seen).toEqual([null, "1", "2"]);
  });

  it("stops on hasNextPage:false", async () => {
    const fetchPage = vi.fn(pager([["a"], ["b"]], "hasNextPage"));

    const result = await fetchAllPages(fetchPage, 20);

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.truncated).toBe(false);
  });

  it("stops on a null endCursor even while hasNextPage is still true", async () => {
    // Observed shape: the server can withhold a cursor without clearing the
    // flag. Trusting hasNextPage alone would pass `after: null` and restart the
    // catalog from page 0.
    const fetchPage = vi.fn(pager([["a"], ["b"]], "endCursor"));

    const result = await fetchAllPages(fetchPage, 20);

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.apps.map((a) => a.id)).toEqual(["a", "b"]);
    expect(result.truncated).toBe(false);
  });

  it("stops at maxPages and flags the result as partial", async () => {
    // A cursor that never terminates must not spin forever, and the caller must
    // be able to tell that what it got is not the whole catalog.
    const endless: FetchPage = () =>
      Promise.resolve({
        items: [app("x")],
        pageInfo: { hasNextPage: true, endCursor: "more" },
      });

    const result = await fetchAllPages(endless, 3);

    expect(result.pages).toBe(3);
    expect(result.apps).toHaveLength(3);
    expect(result.truncated).toBe(true);
  });

  it("handles a single empty page without calling for a second", async () => {
    const fetchPage = vi.fn(pager([[]]));

    const result = await fetchAllPages(fetchPage, 20);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.apps).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("propagates a mid-walk failure instead of returning a partial catalog", async () => {
    // Critical: a swallowed failure here would be cached as if it were the whole
    // catalog, and every missing game would badge a confident "Not on GeForce
    // NOW". Rejecting hands control to loadIndex's stale-cache fallback.
    let calls = 0;
    const flaky: FetchPage = () => {
      calls += 1;
      if (calls === 2) return Promise.reject(new Error("offline"));
      return Promise.resolve({
        items: [app("a")],
        pageInfo: { hasNextPage: true, endCursor: "1" },
      });
    };

    await expect(fetchAllPages(flaky, 20)).rejects.toThrow("offline");
  });
});
