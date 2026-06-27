import type { GfnApp } from "../feed/types";
import type { LookupRequest, LookupResponse } from "../shared/messages";
import { loadIndex, type FeedCache, type LoadDeps } from "../feed/feed-cache";
import { hasFeedPermission } from "../shared/permission";
import { initPermissionGate } from "./permission-gate";
import { log } from "../shared/log";

// NVIDIA's GeForce NOW catalog GraphQL API — the source the GFN web app uses.
// The legacy static `gfnpc-*.json` feed is abandoned and missing large swaths
// of the catalog (it returns false negatives), so we query this instead.
const GRAPHQL_URL = "https://games.geforce.com/graphql";
// `first` is capped at 1300 server-side; the catalog is ~2200 apps, so we page.
const PAGE_SIZE = 1300;
const MAX_PAGES = 20; // safety bound against a misbehaving cursor
const APPS_QUERY = `query($after: String) {
  apps(country: "US", language: "en_US", first: ${PAGE_SIZE}, after: $after) {
    pageInfo { hasNextPage endCursor }
    items {
      id
      title
      variants {
        appStore
        storeUrl
        gfn { features { ... on GfnSubscriptionFeatureValue { key value } } }
      }
    }
  }
}`;

interface AppsPage {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  items: GfnApp[];
}

/** Fetch one page of the catalog. Throws on HTTP, transport, or GraphQL errors
 *  so loadIndex's stale-cache fallback engages instead of caching a partial. */
async function fetchAppsPage(after: string | null): Promise<AppsPage> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: APPS_QUERY, variables: { after } }),
  });
  if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
  const body = (await res.json()) as { data?: { apps?: AppsPage }; errors?: unknown };
  if (body.errors) throw new Error(`feed GraphQL error: ${JSON.stringify(body.errors)}`);
  const apps = body.data?.apps;
  if (!apps || !Array.isArray(apps.items)) throw new Error("feed missing apps.items");
  return apps;
}

const CACHE_KEY = "gfn-feed-cache";
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
// Diagnostics toggles, read from browser.storage.local. Set in the extension
// console with e.g. `browser.storage.local.set({ "gfn-debug": true })` to log
// lookups, or `{ "gfn-force-refresh": true }` to refetch the feed once.
const DEBUG_KEY = "gfn-debug";
const FORCE_REFRESH_KEY = "gfn-force-refresh";

async function readFlag(key: string): Promise<boolean> {
  const stored = await browser.storage.local.get(key);
  return stored[key] === true;
}

const deps: LoadDeps = {
  async getCache() {
    const stored = await browser.storage.local.get(CACHE_KEY);
    return (stored[CACHE_KEY] as FeedCache | undefined) ?? null;
  },
  async setCache(cache) {
    await browser.storage.local.set({ [CACHE_KEY]: cache });
  },
  async fetchFeed() {
    const apps: GfnApp[] = [];
    let after: string | null = null;
    log.info("fetching GeForce NOW catalog…");
    for (let page = 0; page < MAX_PAGES; page++) {
      const { items, pageInfo }: AppsPage = await fetchAppsPage(after);
      apps.push(...items);
      if (!pageInfo.hasNextPage || !pageInfo.endCursor) {
        log.info(`catalog fetched: ${apps.length} apps across ${page + 1} page(s)`);
        return apps;
      }
      after = pageInfo.endCursor;
    }
    log.warn(`catalog fetch hit MAX_PAGES (${MAX_PAGES}); using ${apps.length} apps`);
    return apps;
  },
  now: () => Date.now(),
  ttlMs: TTL_MS,
};

/** Handle a lookup request: ensure the index is loaded, then return the subset
 *  of requested app ids that are supported. */
async function handleLookup(req: LookupRequest): Promise<LookupResponse> {
  const debug = await readFlag(DEBUG_KEY);
  const forceRefresh = await readFlag(FORCE_REFRESH_KEY);
  if (forceRefresh) await browser.storage.local.remove(FORCE_REFRESH_KEY);

  const result = await loadIndex({ ...deps, forceRefresh });
  if (!result.ok) {
    // No index and no cache. Distinguish the opt-in host permission not being
    // granted (the common "works in `web-ext run`, blank when installed" case)
    // from a transient fetch failure, so the badge can guide the user.
    const reason = (await hasFeedPermission()) ? "network" : "permission";
    log.warn(`feed unavailable (${reason}); ${req.appIds.length} id(s) -> unknown`);
    return { ok: false, found: {}, reason };
  }
  const found: Record<string, { rtx: boolean }> = {};
  for (const appId of req.appIds) {
    const hit = result.index[String(appId)];
    if (hit) found[String(appId)] = hit;
  }
  if (debug) {
    log.info(`index size=${Object.keys(result.index).length}`);
    for (const appId of req.appIds) {
      const hit = result.index[String(appId)];
      log.info(`appId ${appId}: ${hit ? `supported (rtx=${hit.rtx})` : "NOT in index"}`);
    }
  }
  return { ok: true, found };
}

/** Refresh the feed cache out of band (e.g. right after the user grants the host
 *  permission) so the next lookup is served from a warm cache. */
async function warmFeed(): Promise<void> {
  const result = await loadIndex(deps);
  log.info(result.ok ? "feed cache warmed" : "feed warm failed (still unavailable)");
}

browser.runtime.onMessage.addListener((message: unknown): Promise<LookupResponse> | undefined => {
  const req = message as Partial<LookupRequest>;
  if (req?.type !== "gfn-lookup" || !Array.isArray(req.appIds)) return undefined;
  return handleLookup(req as LookupRequest);
});

// Firefox MV3: host permissions are opt-in and NOT granted on a normal install,
// so the catalog fetch is blocked until the user enables it via the popup /
// onboarding tab. This wires the toolbar badge, the cache warm-on-grant, and the
// first-install onboarding tab.
initPermissionGate(warmFeed);
log.info("background ready");
