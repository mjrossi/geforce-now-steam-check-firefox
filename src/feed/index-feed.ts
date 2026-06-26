import type { GfnFeedEntry, GfnIndex } from "./types";
import { parseAppId } from "./parse-app-id";

/** Build a lookup index from the raw GFN feed. Only Steam entries with a
 *  parseable app id are kept; the value records the RTX (fully-optimized) flag.
 *  Maintenance/patching titles stay indexed — they are still supported. */
export function buildIndex(feed: GfnFeedEntry[]): GfnIndex {
  const index: GfnIndex = {};
  for (const entry of feed) {
    if (entry.store !== "Steam") continue;
    const appId = parseAppId(entry.steamUrl);
    if (appId === null) continue;
    index[String(appId)] = { rtx: entry.isFullyOptimized === true };
  }
  return index;
}
