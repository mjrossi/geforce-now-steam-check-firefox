import { resolveState } from "../feed/resolve-state";
import type { LookupRequest, LookupResponse } from "../shared/messages";
import { debounce } from "../shared/debounce";
import { ensureStyles, renderWishlistPill } from "../badge/badge";
import { findRows, paint } from "./wishlist-rows";
import { log } from "../shared/log";

async function run(): Promise<void> {
  const rows = findRows(document.body);
  if (rows.size === 0) return;

  const appIds = [...rows.keys()];
  const req: LookupRequest = { type: "gfn-lookup", appIds };
  const response = (await browser.runtime.sendMessage(req)) as LookupResponse;
  log.info(
    `wishlist: ${appIds.length} row(s), feed ${response.ok ? "ok" : `unavailable (${response.reason ?? "unknown"})`}`,
  );

  ensureStyles(document);
  paint(document, rows, (appId) =>
    renderWishlistPill(document, resolveState(appId, response)),
  );
}

void run();

// Wishlist rows load (and, in the React layout, recycle) lazily on scroll;
// re-run debounced to badge newly rendered (and re-badge recycled) rows.
new MutationObserver(debounce(() => void run(), 300)).observe(document.body, {
  childList: true,
  subtree: true,
});
