import { parseAppId, parseAppIdFromImage } from "../feed/parse-app-id";
import { STATE_ATTR } from "../badge/badge";

/** Marker class on the span we inject into each wishlist row. */
export const PILL_SLOT = "gfn-check-pill-slot";
/** Added to the slot when it overlays the capsule (vs. appended to the row). */
export const OVERLAY_CLASS = `${PILL_SLOT}--overlay`;
/** Added to the capsule's container to make it the overlay's positioning
 *  context (CSS `position: relative`). */
export const ANCHOR_CLASS = "gfn-check-anchor";
/** Records which app id a slot was rendered for, so recycled virtualized rows
 *  (same container, different game) are re-badged instead of left stale. */
export const APP_ID_ATTR = "data-gfn-app-id";

// Legacy (server-rendered) wishlist rows. The modern wishlist is a virtualized
// React list with hashed class names, so we can't rely on this — when it matches
// nothing we derive rows from the stable app link / capsule image instead.
const LEGACY_ROW_SELECTOR = ".wishlist_row";
const MAX_CLIMB = 8;

// The two nodes that name a game on a wishlist page. Both are live-Steam-DOM
// dependent and are the first thing to re-verify with `just dev` if rows stop
// being found — named here so there is one copy to check, not five.
const APP_LINK = 'a[href*="/app/"]';
const CAPSULE = 'img[src*="/apps/"]';

// Stable Steam-wide chrome that also contains `/app/` links (global nav, footer,
// responsive menu). Seeds inside these must never be treated as wishlist rows,
// or we'd badge unrelated games in the header/footer.
const CHROME_SELECTORS = ["#global_header", "#footer", ".footerv2", "#responsive_page_menu"];

function inChrome(el: Element): boolean {
  return CHROME_SELECTORS.some((sel) => el.closest(sel) !== null);
}

/** The Steam app id a node names: an `/app/` link's href, or an `/apps/` capsule
 *  image's src. One rule, used both to scan a subtree and to seed a row — they
 *  have to agree, and stating it twice was an invitation for them not to. */
function appIdOf(el: Element): number | null {
  return (
    parseAppId(el.getAttribute("href") ?? "") ?? parseAppIdFromImage(el.getAttribute("src") ?? "")
  );
}

/** All Steam app ids referenced by a subtree, via `/app/` anchors and `/apps/`
 *  capsule images. Used to find the bounding row container for one game. */
export function appIdsIn(el: Element): Set<number> {
  const ids = new Set<number>();
  for (const node of el.querySelectorAll(`${APP_LINK}, ${CAPSULE}`)) {
    const id = appIdOf(node);
    if (id !== null) ids.add(id);
  }
  return ids;
}

/** From a seed node (an app link or capsule image), climb to the widest ancestor
 *  that still references only this one app id — i.e. the game's row block. Never
 *  climbs past `root`, so sibling cards sharing a list container don't merge. */
export function rowContainer(seed: HTMLElement, appId: number, root: Element): HTMLElement {
  let best = seed;
  let el: HTMLElement = seed;
  for (let i = 0; i < MAX_CLIMB; i++) {
    const parent = el.parentElement;
    if (!parent || parent === root || !root.contains(parent)) break;
    const ids = appIdsIn(parent);
    if (ids.size > 1 || (ids.size === 1 && !ids.has(appId))) break;
    best = parent;
    el = parent;
  }
  return best;
}

/** Collect one row element per wishlisted game within `root`. This is the part
 *  to re-verify against the live wishlist DOM if rendering ever breaks again. */
export function findRows(root: Element): Map<number, HTMLElement> {
  const rows = new Map<number, HTMLElement>();

  const legacy = root.querySelectorAll<HTMLElement>(LEGACY_ROW_SELECTOR);
  if (legacy.length > 0) {
    for (const row of legacy) {
      if (inChrome(row)) continue;
      for (const id of appIdsIn(row)) if (!rows.has(id)) rows.set(id, row);
    }
    if (rows.size > 0) return rows;
  }

  // Modern layout: seed from every app link and capsule image (outside chrome),
  // dedupe per id, and climb each seed to its single-game block. Links first,
  // then images — not document order: the first seed for an id decides that
  // game's row, and a link is the more reliable starting point.
  const seeds: HTMLElement[] = [
    ...root.querySelectorAll<HTMLElement>(APP_LINK),
    ...root.querySelectorAll<HTMLElement>(CAPSULE),
  ];
  for (const seed of seeds) {
    if (inChrome(seed)) continue;
    const id = appIdOf(seed);
    if (id === null || rows.has(id)) continue;
    rows.set(id, rowContainer(seed, id, root));
  }
  return rows;
}

/** Badge each row idempotently. A row already carrying a slot for the same app
 *  id *and* the same badge is left alone; anything else — a recycled row now
 *  showing a different game, or a row whose pending lookup has since resolved —
 *  has its slot replaced. `pill` builds the badge element for an app id;
 *  `stateOf` names what that badge depicts.
 *
 *  `stateOf` is required on purpose: defaulting it to a constant would silently
 *  reduce the check to app-id-only matching, which is exactly the bug that left
 *  "couldn't check" frozen on rows that had since resolved. */
export function paint(
  doc: Document,
  rows: Map<number, HTMLElement>,
  pill: (appId: number) => HTMLElement,
  stateOf: (appId: number) => string,
): void {
  for (const [appId, row] of rows) {
    const state = stateOf(appId);
    const existing = row.querySelector<HTMLElement>(`.${PILL_SLOT}`);
    if (existing) {
      if (
        existing.getAttribute(APP_ID_ATTR) === String(appId) &&
        existing.getAttribute(STATE_ATTR) === state
      ) {
        continue;
      }
      existing.remove(); // stale: recycled row, or a resolved pending lookup
    }
    const slot = doc.createElement("span");
    slot.className = PILL_SLOT;
    slot.setAttribute(APP_ID_ATTR, String(appId));
    slot.setAttribute(STATE_ATTR, state);
    slot.appendChild(pill(appId));

    // Overlay the pill in the corner of the game's capsule so it reads as an
    // availability badge, rather than floating at the bottom of the row block
    // (under the rank/handle column). The capsule's own container becomes the
    // positioning context. Fall back to appending to the row when a row has no
    // capsule image. (Live-DOM dependent — re-verify with `just dev`.)
    const capsule = row.querySelector<HTMLImageElement>(CAPSULE);
    const host = capsule?.parentElement;
    if (host) {
      host.classList.add(ANCHOR_CLASS);
      slot.classList.add(OVERLAY_CLASS);
      host.appendChild(slot);
    } else {
      row.appendChild(slot);
    }
  }
}
