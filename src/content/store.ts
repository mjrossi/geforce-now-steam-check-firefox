import { parseAppId } from "../feed/parse-app-id";
import { isDefinitive, resolveState, type BadgeState } from "../feed/resolve-state";
import { lookup } from "../shared/lookup";
import { debounce } from "../shared/debounce";
import { ensureStyles, placeAfter, placeBefore, renderStoreBanner } from "../badge/badge";
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

let state: BadgeState | null = null;
let attempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let inFlight = false;

/** Render the badge, or replace one that is showing a stale state.
 *
 *  The state stamp is what lets a banner painted "couldn't check" be swapped out
 *  once the lookup resolves — the same trick wishlist-rows.ts uses for recycled
 *  rows. Without it, a transient failure was frozen into the page until reload. */
function paint(): void {
  if (state === null) return;
  const existing = document.getElementById(SLOT_ID);
  if (existing !== null) {
    if (existing.getAttribute(STATE_ATTR) === state.kind) return;
    existing.remove();
  }
  ensureStyles(document);
  const badge = renderStoreBanner(document, state);
  badge.id = SLOT_ID;
  badge.setAttribute(STATE_ATTR, state.kind);
  for (const sel of HEADER_SELECTORS) {
    if (placeAfter(document, sel, badge)) return;
  }
  placeBefore(document, PURCHASE_SELECTOR, badge);
}

/** Queue the next retry, or stop once the backoff is exhausted. Keeps a single
 *  timer so a visibility-driven retry can't stack a second chain on top. */
function scheduleRetry(): void {
  const delay = RETRY_DELAYS_MS[attempt];
  if (delay === undefined) return;
  attempt += 1;
  if (retryTimer !== undefined) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void run(), delay);
}

/** Look up this page's app and paint the result, retrying while the answer is
 *  non-definitive.
 *
 *  A game page can sit idle indefinitely, so unlike the wishlist — where
 *  scrolling supplies a steady stream of retries — the retries here are driven
 *  by a timer, plus the tab becoming visible again, which is exactly what
 *  happens when the user grants the permission in the popup and comes back. */
async function run(): Promise<void> {
  const appId = parseAppId(location.href);
  if (appId === null) return;
  if (inFlight) return;

  inFlight = true;
  let next: BadgeState;
  try {
    next = resolveState(appId, await lookup([appId]));
  } finally {
    inFlight = false;
  }

  state = next;
  log.info(`store app ${appId} -> ${next.kind}`);
  paint();
  if (!isDefinitive(next)) scheduleRetry();
}

void run();

// Re-inject if Steam or another extension (Augmented Steam / alike03's) rebuilds
// the purchase area after us. paint() is a no-op while our node is present and
// current, but debounce anyway: store pages mutate constantly (carousels, live
// player counts) and there is no reason to re-check the DOM on every one.
new MutationObserver(debounce(paint, 300)).observe(document.body, {
  childList: true,
  subtree: true,
});

// Coming back to the tab is the strongest hint that a "needs-permission" banner
// is now wrong: the user just granted it in the popup or onboarding tab. Restart
// the backoff so that lands promptly rather than waiting out the current delay.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (state === null || isDefinitive(state)) return;
  attempt = 0;
  void run();
});
