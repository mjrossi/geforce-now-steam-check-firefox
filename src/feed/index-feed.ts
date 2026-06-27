import type { GfnApp, GfnIndex } from "./types";
import { parseAppId } from "./parse-app-id";

const STEAM = "steam";
const RTX_FEATURE = "RTX_ENABLED";

/** Build a Steam-app-id → {rtx} index from the GFN catalog. We keep only each
 *  game's Steam variant (its presence is what guarantees the *Steam* copy is
 *  playable on GFN) with a parseable app id. `rtx` reflects the per-game
 *  RTX_ENABLED capability flag. */
export function buildIndex(apps: GfnApp[]): GfnIndex {
  const index: GfnIndex = {};
  for (const app of apps) {
    for (const variant of app.variants ?? []) {
      // Match the store label leniently — it has been seen as "STEAM".
      if (variant.appStore?.trim().toLowerCase() !== STEAM) continue;
      const appId = parseAppId(variant.storeUrl ?? "");
      if (appId === null) continue;
      const rtx = (variant.gfn?.features ?? []).some(
        (f) => f.key === RTX_FEATURE && f.value === "true",
      );
      index[String(appId)] = { rtx };
    }
  }
  return index;
}
