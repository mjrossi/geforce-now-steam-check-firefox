import { parseAppId } from "../feed/parse-app-id";
import { resolveState, type BadgeState } from "../feed/resolve-state";
import type { LookupRequest, LookupResponse } from "../shared/messages";
import { ensureStyles, placeBefore, renderSidebarBadge } from "../badge/badge";

const SLOT_ID = "gfn-check-store-slot";
// Steam's purchase block; the badge is inserted just above it. This is the one
// selector to re-verify against the live store page if placement drifts.
const ANCHOR_SELECTOR = "#game_area_purchase";

let state: BadgeState | null = null;

/** Render (or re-render) the badge if it is not currently in the DOM. */
function paint(): void {
  if (state === null) return;
  if (document.getElementById(SLOT_ID)) return;
  ensureStyles(document);
  const badge = renderSidebarBadge(document, state);
  badge.id = SLOT_ID;
  placeBefore(document, ANCHOR_SELECTOR, badge);
}

async function run(): Promise<void> {
  const appId = parseAppId(location.href);
  if (appId === null) return;
  const req: LookupRequest = { type: "gfn-lookup", appIds: [appId] };
  const response = (await browser.runtime.sendMessage(req)) as LookupResponse;
  state = resolveState(appId, response);
  paint();
}

void run();

// Re-inject if Steam or another extension (Augmented Steam / alike03's) rebuilds
// the purchase area after us. paint() is a no-op while our node is present.
new MutationObserver(() => paint()).observe(document.body, {
  childList: true,
  subtree: true,
});
