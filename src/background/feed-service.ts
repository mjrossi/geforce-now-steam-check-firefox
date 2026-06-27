import type { GfnFeedEntry } from "../feed/types";
import type { LookupRequest, LookupResponse } from "../shared/messages";
import { loadIndex, type FeedCache, type LoadDeps } from "../feed/feed-cache";

const FEED_URL =
  "https://static.nvidiagrid.net/supported-public-game-list/locales/gfnpc-en-US.json";
const CACHE_KEY = "gfn-feed-cache";
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const deps: LoadDeps = {
  async getCache() {
    const stored = await browser.storage.local.get(CACHE_KEY);
    return (stored[CACHE_KEY] as FeedCache | undefined) ?? null;
  },
  async setCache(cache) {
    await browser.storage.local.set({ [CACHE_KEY]: cache });
  },
  async fetchFeed() {
    const res = await fetch(FEED_URL, { credentials: "omit" });
    if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error("feed is not an array");
    return data as GfnFeedEntry[];
  },
  now: () => Date.now(),
  ttlMs: TTL_MS,
};

/** Handle a lookup request: ensure the index is loaded, then return the subset
 *  of requested app ids that are supported. */
async function handleLookup(req: LookupRequest): Promise<LookupResponse> {
  const result = await loadIndex(deps);
  if (!result.ok) return { ok: false, found: {} };
  const found: Record<string, { rtx: boolean }> = {};
  for (const appId of req.appIds) {
    const hit = result.index[String(appId)];
    if (hit) found[String(appId)] = hit;
  }
  return { ok: true, found };
}

browser.runtime.onMessage.addListener((message: unknown): Promise<LookupResponse> | undefined => {
  const req = message as Partial<LookupRequest>;
  if (req?.type !== "gfn-lookup" || !Array.isArray(req.appIds)) return undefined;
  return handleLookup(req as LookupRequest);
});
