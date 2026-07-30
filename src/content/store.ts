import { parseAppId } from "../feed/parse-app-id";
import { resolveState, stateStamp, type BadgeState } from "../feed/resolve-state";
import { lookup } from "../shared/lookup";
import { debounce } from "../shared/debounce";
import { onEpochChange } from "../shared/catalog-epoch";
import { ensureStyles, placeAfter, placeBefore, renderStoreBanner } from "../badge/badge";
import { createStoreController } from "./store-controller";
import { log } from "../shared/log";

const SLOT_ID = "gfn-check-store-slot";
const STATE_ATTR = "data-gfn-state";
// The banner sits right under the game title/header. We try the header anchors
// first (placed after them) and fall back to just above the purchase block.
// These are the selectors to re-verify against the live store page if placement
// drifts.
const HEADER_SELECTORS = [".apphub_HeaderStandardTop", ".page_title_area"];
const PURCHASE_SELECTOR = "#game_area_purchase";

// Backoff for re-asking after a non-definitive answer. Short at first — the
// usual cause is the event-page background still waking — then slow enough that
// a game page left open all day costs a handful of messages, not a poll loop.
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 45_000, 120_000];

const appId = parseAppId(location.href);

/** Render the badge, or replace one that is showing a stale state.
 *
 *  The state stamp is what lets a banner painted "couldn't check" be swapped out
 *  once the lookup resolves — the same trick wishlist-rows.ts uses for recycled
 *  rows. Without it, a transient failure was frozen into the page until reload. */
function paint(state: BadgeState): void {
  const stamp = stateStamp(state);
  const existing = document.getElementById(SLOT_ID);
  if (existing !== null) {
    if (existing.getAttribute(STATE_ATTR) === stamp) return;
    existing.remove();
  }
  ensureStyles(document);
  const badge = renderStoreBanner(document, state);
  badge.id = SLOT_ID;
  badge.setAttribute(STATE_ATTR, stamp);
  for (const sel of HEADER_SELECTORS) {
    if (placeAfter(document, sel, badge)) return;
  }
  placeBefore(document, PURCHASE_SELECTOR, badge);
}

if (appId !== null) {
  const controller = createStoreController({
    lookup: async () => {
      const state = resolveState(appId, await lookup([appId]));
      log.info(`store app ${String(appId)} -> ${state.kind}`);
      return state;
    },
    paint,
    delays: RETRY_DELAYS_MS,
  });

  void controller.run();

  // Re-inject if Steam or another extension (Augmented Steam / alike03's) rebuilds
  // the purchase area after us. paint() is a no-op while our node is present and
  // current, but debounce anyway: store pages mutate constantly (carousels, live
  // player counts) and there is no reason to re-check the DOM on every one.
  const repaint = debounce(() => {
    const state = controller.state();
    if (state !== null) paint(state);
  }, 300);
  new MutationObserver(repaint).observe(document.body, { childList: true, subtree: true });

  // A new catalog landed in the background, so even a definitive answer may now be
  // wrong — this is what makes the popup's "Refresh catalog" button repair the page
  // you pressed it for. It also covers the permission grant, whose warm-on-grant
  // fetch publishes an epoch.
  onEpochChange(() => {
    log.info("store: new catalog published, re-checking");
    controller.recheck();
  });

  // Returning to the page is the other hint that a non-definitive banner is now
  // wrong. Two events, because they cover different paths and neither covers both:
  //   - visibilitychange fires when the user switches back from another tab, which
  //     is the onboarding-tab grant path.
  //   - focus fires when the browser-action popup closes. Opening that popup does
  //     NOT change the tab's visibilityState — the tab stays "visible" — so the
  //     popup grant path, the one the banner's own "enable in the toolbar" text
  //     sends people down, would otherwise be caught only by the backoff, which
  //     gives up after ~3 minutes.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") controller.retryPending();
  });
  window.addEventListener("focus", () => controller.retryPending());
}
