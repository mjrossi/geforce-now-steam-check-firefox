import { parseAppIdFromElement } from "../feed/parse-app-id";
import { resolveState } from "../feed/resolve-state";
import type { LookupRequest, LookupResponse } from "../shared/messages";
import { debounce } from "../shared/debounce";
import { ensureStyles, renderWishlistPill } from "../badge/badge";

// Steam wishlist row container. This is the single selector to re-verify against
// the live wishlist DOM; app-id extraction itself is markup-agnostic (it reads
// the row's /app/ anchor).
const ROW_SELECTOR = ".wishlist_row";
const PILL_SLOT = "gfn-check-pill-slot";

async function run(): Promise<void> {
  const rows = Array.from(document.querySelectorAll<HTMLElement>(ROW_SELECTOR));
  if (rows.length === 0) return;

  const appIds = [
    ...new Set(
      rows
        .map((r) => parseAppIdFromElement(r))
        .filter((id): id is number => id !== null),
    ),
  ];
  if (appIds.length === 0) return;

  const req: LookupRequest = { type: "gfn-lookup", appIds };
  const response = (await browser.runtime.sendMessage(req)) as LookupResponse;

  ensureStyles(document);
  for (const row of rows) {
    if (row.querySelector(`.${PILL_SLOT}`)) continue; // already badged
    const appId = parseAppIdFromElement(row);
    if (appId === null) continue;
    const slot = document.createElement("span");
    slot.className = PILL_SLOT;
    slot.appendChild(renderWishlistPill(document, resolveState(appId, response)));
    row.appendChild(slot);
  }
}

void run();

// Wishlist rows load lazily on scroll; re-run (debounced) to badge new rows.
new MutationObserver(debounce(() => void run(), 300)).observe(document.body, {
  childList: true,
  subtree: true,
});
