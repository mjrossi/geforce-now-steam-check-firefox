import type { GfnApp, GfnIndex, GfnIndexEntry } from "./types";
import { parseAppId } from "./parse-app-id";

const STEAM = "steam";
const RTX_FEATURE = "RTX_ENABLED";

/** Build a Steam-app-id → {rtx} index from the GFN catalog. We keep only each
 *  game's Steam variant (its presence is what guarantees the *Steam* copy is
 *  playable on GFN) with a parseable app id. `rtx` reflects the per-game
 *  RTX_ENABLED capability flag.
 *
 *  **The index is smaller than the catalog, and that's correct** — measured
 *  against the live feed, 2215 catalog apps yield 2012 indexed ids. Don't "fix"
 *  the drop rate without checking which bucket you're looking at:
 *  - ~200 have no Steam variant at all (Epic/Xbox/Uplay/Battle.net/GOG-only).
 *  - ~13 have a Steam variant whose `storeUrl` points at
 *    `nvidia.custhelp.com/.../a_id/5377` — NVIDIA's "removed from GeForce NOW"
 *    notice. Dropping these is required: indexing them is a false *positive*.
 *  - ~5 are `/app/TBD` placeholders for unannounced Steam pages.
 *  - 2 are real losses from bad upstream data — a slug (`/app/spellforce-conquest-of-eo`)
 *    and a package (`/sub/405719`) where an app id belongs. There is no id in the
 *    payload to extract, so the regex cannot recover them; resolving either would
 *    mean querying Steam, which needs a host permission we deliberately don't hold.
 *
 *  A handful of Steam ids are claimed by two catalog entries (base vs
 *  definitive edition — Fallout 3, Metro Exodus, Control). Last write wins, so the
 *  `rtx` flag on those follows whichever the feed lists second. */
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
      const entry: GfnIndexEntry = { rtx, gfnId: app.id };
      if (typeof app.cmsId === "number") entry.cmsId = app.cmsId;
      index[String(appId)] = entry;
    }
  }
  return index;
}
