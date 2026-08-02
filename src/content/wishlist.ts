import { resolveState, stateStamp } from "../feed/resolve-state";
import { lookup } from "../shared/lookup";
import { debounce } from "../shared/debounce";
import { coalesce } from "../shared/coalesce";
import { onEpochChange } from "../shared/catalog-epoch";
import { ensureStyles, renderWishlistPill } from "../badge/badge";
import { findRows, paint } from "./wishlist-rows";
import { createStateMemo } from "./wishlist-memo";
import { log } from "../shared/log";

const memo = createStateMemo();

// Scrolling, our own pill injection, and a new catalog all trigger a run, and a
// run is only as fast as the background's answer. Coalesced so a slow lookup
// isn't re-asked by every mutation batch that lands while it is outstanding —
// the memo can't dedupe those, since it only records an answer once it arrives.
const run = coalesce(async () => {
  // Every call site is `void run()`, so anything escaping here would be an
  // unhandled rejection in the page console rather than a caught failure — and a
  // scrolling wishlist would repeat it on every mutation batch. `lookup()` is
  // contracted never to reject; this covers the DOM walk and the paint, which run
  // against third-party markup that other extensions also rewrite.
  try {
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
      (appId) => stateStamp(memo.stateFor(appId)),
    );
  } catch (err) {
    // Nothing is memoized on this path, so the next scroll retries from scratch.
    log.warn("wishlist: run failed —", err);
  }
});

void run();

// Wishlist rows load (and, in the React layout, recycle) lazily on scroll;
// re-run debounced to badge newly rendered (and re-badge recycled) rows.
new MutationObserver(debounce(() => void run(), 300)).observe(document.body, {
  childList: true,
  subtree: true,
});

// A new catalog invalidates the memo wholesale — every pill it is holding was
// answered against the old one. Dropping it makes the next run re-ask about every
// visible row, which is what the popup's "Refresh catalog" button is for.
onEpochChange(() => {
  log.info("wishlist: new catalog published, re-checking visible rows");
  memo.forgetAll();
  void run();
});
