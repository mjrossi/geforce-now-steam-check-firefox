import { resolveState, type BadgeState } from "../feed/resolve-state";
import { lookup } from "../shared/lookup";
import { debounce } from "../shared/debounce";
import { ensureStyles, renderWishlistPill } from "../badge/badge";
import { findRows, paint } from "./wishlist-rows";
import { log } from "../shared/log";

/** Per-tab memo of app ids we already have a *definitive* answer for.
 *
 *  The wishlist is virtualized, so scrolling re-runs this constantly — and our
 *  own pill injection wakes the observer that schedules the next run. Without a
 *  memo every batch re-asks the background about every visible row.
 *
 *  Only "supported" / "not-supported" are stored: "unknown" and
 *  "needs-permission" are transient (offline, or permission not granted yet) and
 *  must stay retryable so badges self-heal without a page reload. */
const resolved = new Map<number, BadgeState>();

function isDefinitive(state: BadgeState): boolean {
  return state.kind === "supported" || state.kind === "not-supported";
}

async function run(): Promise<void> {
  const rows = findRows(document.body);
  if (rows.size === 0) return;

  const pending = [...rows.keys()].filter((id) => !resolved.has(id));
  if (pending.length > 0) {
    const response = await lookup(pending);
    for (const appId of pending) {
      const state = resolveState(appId, response);
      if (isDefinitive(state)) resolved.set(appId, state);
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
  const stateFor = (appId: number): BadgeState => resolved.get(appId) ?? { kind: "unknown" };

  ensureStyles(document);
  paint(
    document,
    rows,
    (appId) => renderWishlistPill(document, stateFor(appId)),
    (appId) => stateFor(appId).kind,
  );
}

void run();

// Wishlist rows load (and, in the React layout, recycle) lazily on scroll;
// re-run debounced to badge newly rendered (and re-badge recycled) rows.
new MutationObserver(debounce(() => void run(), 300)).observe(document.body, {
  childList: true,
  subtree: true,
});
