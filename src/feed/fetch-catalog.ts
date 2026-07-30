import type { GfnApp } from "./types";

/** One page of NVIDIA's `apps(...)` connection. `endCursor` is null once the
 *  server has nothing further to hand out, which it can report independently of
 *  `hasNextPage` — so both are treated as end-of-catalog. */
export interface AppsPage {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  items: GfnApp[];
}

/** Fetch one page, given the previous page's cursor (null for the first). */
export type FetchPage = (after: string | null) => Promise<AppsPage>;

export interface CatalogFetch {
  apps: GfnApp[];
  /** How many pages were actually requested. */
  pages: number;
  /** True when the walk stopped at `maxPages` with the cursor still advancing,
   *  i.e. `apps` is a *partial* catalog. The caller decides what to do with a
   *  partial (today: use it, and say so in the log) — but it must be able to
   *  tell, which is why this is returned rather than logged in here. */
  truncated: boolean;
}

/** Walk the paginated catalog to the end, or to `maxPages`, whichever comes
 *  first.
 *
 *  Split out of the background's `LoadDeps` so the walk is testable without a
 *  `browser` global or a live endpoint: `fetchPage` owns the I/O, this owns the
 *  cursor. Rejections propagate — `loadIndex`'s stale-cache fallback is what
 *  handles a failed fetch, and swallowing a mid-walk failure here would cache a
 *  partial catalog as if it were the whole thing (every missing game reading as
 *  a confident "Not on GeForce NOW").
 *
 *  `maxPages` is a safety bound against a server that keeps handing back a
 *  cursor forever; at 1300 apps per page it sits far above the ~2200-app
 *  catalog. */
export async function fetchAllPages(
  fetchPage: FetchPage,
  maxPages: number,
): Promise<CatalogFetch> {
  const apps: GfnApp[] = [];
  let after: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const { items, pageInfo } = await fetchPage(after);
    apps.push(...items);
    if (!pageInfo.hasNextPage || pageInfo.endCursor === null) {
      return { apps, pages: page + 1, truncated: false };
    }
    after = pageInfo.endCursor;
  }

  return { apps, pages: maxPages, truncated: true };
}
