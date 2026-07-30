import type { GfnIndexEntry } from "../feed/types";
import type {
  BackgroundRequest,
  LookupRequest,
  LookupResponse,
  RefreshResponse,
  StatusResponse,
} from "../shared/messages";
import { isLookupRequest } from "../shared/messages";
import { type FeedCache, type LoadDeps } from "../feed/feed-cache";
import { type AppsPage, fetchAllPages } from "../feed/fetch-catalog";
import { createLoadCoordinator } from "../feed/load-coordinator";
import { readStatus, refreshCatalog } from "../feed/refresh";
import { hasFeedPermission } from "../shared/permission";
import { EPOCH_KEY } from "../shared/catalog-epoch";
import { onLocalKeyChange } from "../shared/storage";
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
onLocalKeyChange(DEBUG_KEY, (value) => {
  debugEnabled = value === true;
  log.info(`debug logging ${debugEnabled ? "enabled" : "disabled"}`);
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
    log.info("fetching GeForce NOW catalog…");
    const { apps, pages, truncated } = await fetchAllPages(fetchAppsPage, MAX_PAGES);
    if (truncated) {
      log.warn(`catalog fetch hit MAX_PAGES (${MAX_PAGES}); using ${apps.length} apps`);
    } else {
      log.info(`catalog fetched: ${apps.length} apps across ${pages} page(s)`);
    }
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
    // No index and no cache — the fetch failed. This used to report "permission"
    // whenever the feed grant was missing, on the assumption that a missing grant
    // is what blocks the fetch. It isn't: the catalog answers with an open CORS
    // policy, so an ungranted extension fetches perfectly well (feed-origin.ts).
    // The inference was therefore usually backwards — an offline user who had
    // never granted was told to click the toolbar icon, which would not have
    // helped them.
    //
    // A failed fetch is a failed fetch, so say so. The grant is still worth
    // offering when it's missing, because it's the one thing that could plausibly
    // help if NVIDIA ever tightens CORS — but it's offered as a suggestion the
    // badge copy words as such, not as a diagnosis.
    const reason = (await hasFeedPermission()) ? "network" : "permission";
    log.warn(`feed fetch failed; ${req.appIds.length} id(s) -> unknown (grant missing: ${String(reason === "permission")})`);
    return { ok: false, found: {}, reason };
  }
  if (debugEnabled) log.info(`index size=${Object.keys(result.index).length}`);
  const found: Record<string, GfnIndexEntry> = {};
  for (const appId of req.appIds) {
    const key = String(appId);
    const hit = result.index[key];
    if (hit) found[key] = hit;
    if (debugEnabled) {
      log.info(`appId ${appId}: ${hit ? `supported (rtx=${hit.rtx})` : "NOT in index"}`);
    }
  }
  return { ok: true, found };
}

function handleStatus(): Promise<StatusResponse> {
  return readStatus(deps.getCache);
}

async function handleRefresh(): Promise<RefreshResponse> {
  log.info("manual catalog refresh requested");
  const result = await refreshCatalog(deps.getCache, catalog.forceLoad);
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
  const req = message as Partial<BackgroundRequest> | null;
  switch (req?.type) {
    case "gfn-lookup":
      // Validated rather than cast — see messages.ts. A malformed lookup is
      // declined like any other message we don't handle.
      return isLookupRequest(message) ? handleLookup(message) : undefined;
    case "gfn-status":
      return handleStatus();
    case "gfn-refresh":
      return handleRefresh();
    default:
      return undefined;
  }
});

// Wires the toolbar badge (driven by *standing Steam access*, i.e. whether badges
// appear without a click), the cache warm-on-grant, and the first-install
// onboarding tab. Note the feed host permission, though opt-in and ungranted on a
// normal install, blocks nothing: the catalog fetch clears plain CORS without it
// (feed-origin.ts).
initPermissionGate(warmFeed);
log.info("background ready");
