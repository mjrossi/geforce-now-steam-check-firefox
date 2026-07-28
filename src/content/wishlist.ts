import { resolveState } from "../feed/resolve-state";
import { lookup } from "../shared/lookup";
import { debounce } from "../shared/debounce";
import { ensureStyles, renderWishlistPill } from "../badge/badge";
import { findRows, paint } from "./wishlist-rows";
import { createStateMemo } from "./wishlist-memo";
import { log } from "../shared/log";

const memo = createStateMemo();

async function run(): Promise<void> {
  const rows = findRows(document.body);
  if (rows.size === 0) return;

  const pending = memo.pending(rows.keys());
  if (pending.length > 0) {
    const response = await lookup(pending);
    for (const appId of pending) {
      memo.remember(appId, resolveState(appId, response));
    }
    log.info(
      `wishlist: ${String(pending.length)} new row(s) of ${String(rows.size)}, feed ${
        response.ok ? "ok" : `unavailable (${response.reason ?? "unknown"})`
      }`,
    );
  }

  // Rows still awaiting a definitive answer render "couldn't check"; the next
  // run retries them, and the state stamp makes paint() replace the placeholder
  // once they resolve.
  ensureStyles(document);
  paint(
    document,
    rows,
    (appId) => renderWishlistPill(document, memo.stateFor(appId)),
    (appId) => memo.stateFor(appId).kind,
  );
}

void run();

// Wishlist rows load (and, in the React layout, recycle) lazily on scroll;
// re-run debounced to badge newly rendered (and re-badge recycled) rows.
new MutationObserver(debounce(() => void run(), 300)).observe(document.body, {
  childList: true,
  subtree: true,
});
