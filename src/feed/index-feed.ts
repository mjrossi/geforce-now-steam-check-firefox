import type { GfnFeedEntry, GfnIndex } from "./types";
import { parseAppId } from "./parse-app-id";

/** Build a lookup index from the raw GFN feed. Only Steam entries with a
 *  parseable app id are kept; the value records the RTX (fully-optimized) flag.
 *  Maintenance/patching titles stay indexed — they are still supported. */
export function buildIndex(feed: GfnFeedEntry[]): GfnIndex {
  const index: GfnIndex = {};
  for (const entry of feed) {
    // Match the store label leniently — the feed has been seen with casing /
    // whitespace variants ("STEAM", " Steam "). We keep the filter (a Steam
    // entry is what guarantees the *Steam* copy is playable) but normalize it.
    if (entry.store?.trim().toLowerCase() !== "steam") continue;
    const appId = parseAppId(entry.steamUrl);
    if (appId === null) continue;
    index[String(appId)] = { rtx: entry.isFullyOptimized === true };
  }
  return index;
}
