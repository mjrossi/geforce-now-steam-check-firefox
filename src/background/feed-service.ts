import type { GfnApp, GfnIndexEntry } from "../feed/types";
import type {
  BackgroundRequest,
  LookupRequest,
  LookupResponse,
  RefreshResponse,
  StatusResponse,
} from "../shared/messages";
import { type FeedCache, type LoadDeps } from "../feed/feed-cache";
import { createLoadCoordinator } from "../feed/load-coordinator";
import { readStatus, refreshCatalog } from "../feed/refresh";
import { hasFeedPermission } from "../shared/permission";
import { EPOCH_KEY } from "../shared/catalog-epoch";
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
      cmsId
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
// Per-lookup diagnostic logging, toggled from the extension console with
// `browser.storage.local.set({ "gfn-debug": true })`. Mirrored into a local
// variable rather than read per lookup: the wishlist sends a lookup per
// debounced mutation batch, and a storage round trip on each one is pure waste.
const DEBUG_KEY = "gfn-debug";
let debugEnabled = false;

void browser.storage.local.get(DEBUG_KEY).then((stored) => {
  debugEnabled = stored[DEBUG_KEY] === true;
});
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && DEBUG_KEY in changes) {
    debugEnabled = changes[DEBUG_KEY]?.newValue === true;
    log.info(`debug logging ${debugEnabled ? "enabled" : "disabled"}`);
  }
});

// In-memory copy of the stored cache. Wishlist scrolling sends a lookup per
// debounced mutation batch, and re-reading the ~150 KB cache from
// storage.local each time is wasted IPC. Safe because this module is the only
// writer of CACHE_KEY; an MV3 background restart just repopulates it once.
let cacheMemo: FeedCache | null = null;

const deps: LoadDeps = {
  async getCache() {
    if (cacheMemo !== null) return cacheMemo;
    const stored = await browser.storage.local.get(CACHE_KEY);
    cacheMemo = (stored[CACHE_KEY] as FeedCache | undefined) ?? null;
    return cacheMemo;
  },
  async setCache(cache) {
    cacheMemo = cache;
    // One write, two keys: the cache itself, and the epoch that tells open Steam
    // pages to re-ask. Doing it here rather than at the call sites means every
    // path that lands a new catalog — TTL expiry, the popup's Refresh, the
    // warm-on-permission-grant — heals open pages for free.
    await browser.storage.local.set({ [CACHE_KEY]: cache, [EPOCH_KEY]: cache.fetchedAt });
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

// All catalog loads go through here: concurrent lookups share one fetch, and a
// manual refresh can't interleave with a lookup-driven one.
const catalog = createLoadCoordinator(deps);

/** Handle a lookup request: ensure the index is loaded, then return the subset
 *  of requested app ids that are supported. */
async function handleLookup(req: LookupRequest): Promise<LookupResponse> {
  const result = await catalog.load();
  if (!result.ok) {
    // No index and no cache. Distinguish the opt-in host permission not being
    // granted (the common "works in `web-ext run`, blank when installed" case)
    // from a transient fetch failure, so the badge can guide the user.
    const reason = (await hasFeedPermission()) ? "network" : "permission";
    log.warn(`feed unavailable (${reason}); ${req.appIds.length} id(s) -> unknown`);
    return { ok: false, found: {}, reason };
  }
  const found: Record<string, GfnIndexEntry> = {};
  for (const appId of req.appIds) {
    const hit = result.index[String(appId)];
    if (hit) found[String(appId)] = hit;
  }
  if (debugEnabled) {
    log.info(`index size=${Object.keys(result.index).length}`);
    for (const appId of req.appIds) {
      const hit = result.index[String(appId)];
      log.info(`appId ${appId}: ${hit ? `supported (rtx=${hit.rtx})` : "NOT in index"}`);
    }
  }
  return { ok: true, found };
}

function handleStatus(): Promise<StatusResponse> {
  return readStatus(() => deps.getCache());
}

async function handleRefresh(): Promise<RefreshResponse> {
  log.info("manual catalog refresh requested");
  const result = await refreshCatalog(() => deps.getCache(), catalog.forceLoad);
  log.info(result.ok ? "manual refresh succeeded" : "manual refresh failed (cache unchanged)");
  return result;
}

/** Refresh the feed cache out of band (e.g. right after the user grants the host
 *  permission) so the next lookup is served from a warm cache.
 *
 *  Swallows its own failure: this is called as `void warmFeed()` from the
 *  permission gate, and `load()` does reject if `storage.local.get` itself fails
 *  (that read sits outside `loadIndex`'s try). Nothing is waiting on the result,
 *  so an unhandled rejection in the background console is all it could produce. */
async function warmFeed(): Promise<void> {
  try {
    const result = await catalog.load();
    log.info(result.ok ? "feed cache warmed" : "feed warm failed (still unavailable)");
  } catch (err) {
    log.warn("feed warm threw —", err);
  }
}

// Returning a promise answers the sender; returning undefined declines the
// message so other listeners (and other extensions) can handle it.
browser.runtime.onMessage.addListener((message: unknown): Promise<unknown> | undefined => {
  const req = message as Partial<BackgroundRequest>;
  switch (req?.type) {
    case "gfn-lookup":
      return Array.isArray((req as Partial<LookupRequest>).appIds)
        ? handleLookup(req as LookupRequest)
        : undefined;
    case "gfn-status":
      return handleStatus();
    case "gfn-refresh":
      return handleRefresh();
    default:
      return undefined;
  }
});

// Firefox MV3: host permissions are opt-in and NOT granted on a normal install,
// so the catalog fetch is blocked until the user enables it via the popup /
// onboarding tab. This wires the toolbar badge, the cache warm-on-grant, and the
// first-install onboarding tab.
initPermissionGate(warmFeed);
log.info("background ready");
