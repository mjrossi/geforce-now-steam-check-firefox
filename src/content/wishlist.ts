import { parseAppId, parseAppIdFromImage } from "../feed/parse-app-id";
import { resolveState } from "../feed/resolve-state";
import type { LookupRequest, LookupResponse } from "../shared/messages";
import { debounce } from "../shared/debounce";
import { ensureStyles, renderWishlistPill } from "../badge/badge";

const PILL_SLOT = "gfn-check-pill-slot";
// Legacy (server-rendered) wishlist rows. The modern wishlist is a virtualized
// React list with hashed class names, so we can't rely on this — when it matches
// nothing we derive rows from the stable app link / capsule image instead.
const LEGACY_ROW_SELECTOR = ".wishlist_row";

/** All Steam app ids referenced by a subtree, via `/app/` anchors and `/apps/`
 *  capsule images. Used to find the bounding row container for one game. */
function appIdsIn(el: Element): Set<number> {
  const ids = new Set<number>();
  for (const a of el.querySelectorAll<HTMLAnchorElement>('a[href*="/app/"]')) {
    const id = parseAppId(a.getAttribute("href") ?? "");
    if (id !== null) ids.add(id);
  }
  for (const img of el.querySelectorAll<HTMLImageElement>('img[src*="/apps/"]')) {
    const id = parseAppIdFromImage(img.getAttribute("src") ?? "");
    if (id !== null) ids.add(id);
  }
  return ids;
}

/** From a seed node (an app link or capsule image), climb to the widest ancestor
 *  that still references only this one app id — i.e. the game's row block. */
function rowContainer(seed: HTMLElement, appId: number): HTMLElement {
  let best = seed;
  let el: HTMLElement = seed;
  for (let i = 0; i < 8; i++) {
    const parent = el.parentElement;
    if (!parent) break;
    const ids = appIdsIn(parent);
    if (ids.size > 1 || (ids.size === 1 && !ids.has(appId))) break;
    best = parent;
    el = parent;
  }
  return best;
}

/** Collect one row element per wishlisted game. This is the part to re-verify
 *  against the live wishlist DOM if rendering ever breaks again. */
function findRows(): Map<number, HTMLElement> {
  const rows = new Map<number, HTMLElement>();

  const legacy = document.querySelectorAll<HTMLElement>(LEGACY_ROW_SELECTOR);
  if (legacy.length > 0) {
    for (const row of legacy) {
      for (const id of appIdsIn(row)) if (!rows.has(id)) rows.set(id, row);
    }
    return rows;
  }

  // Modern layout: seed from every app link and capsule image, dedupe per id.
  const seeds: HTMLElement[] = [
    ...document.querySelectorAll<HTMLElement>('a[href*="/app/"]'),
    ...document.querySelectorAll<HTMLElement>('img[src*="/apps/"]'),
  ];
  for (const seed of seeds) {
    const id =
      parseAppId(seed.getAttribute("href") ?? "") ??
      parseAppIdFromImage(seed.getAttribute("src") ?? "");
    if (id === null || rows.has(id)) continue;
    rows.set(id, rowContainer(seed, id));
  }
  return rows;
}

async function run(): Promise<void> {
  const rows = findRows();
  if (rows.size === 0) return;

  const appIds = [...rows.keys()];
  const req: LookupRequest = { type: "gfn-lookup", appIds };
  const response = (await browser.runtime.sendMessage(req)) as LookupResponse;

  ensureStyles(document);
  for (const [appId, row] of rows) {
    if (row.querySelector(`.${PILL_SLOT}`)) continue; // already badged
    const slot = document.createElement("span");
    slot.className = PILL_SLOT;
    slot.appendChild(renderWishlistPill(document, resolveState(appId, response)));
    row.appendChild(slot);
  }
}

void run();

// Wishlist rows load (and, in the React layout, recycle) lazily on scroll;
// re-run debounced to badge newly rendered rows.
new MutationObserver(debounce(() => void run(), 300)).observe(document.body, {
  childList: true,
  subtree: true,
});
