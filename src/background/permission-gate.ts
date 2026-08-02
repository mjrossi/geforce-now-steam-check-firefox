import { hasStandingSteamAccess } from "../shared/permission";
import { log } from "../shared/log";

const ONBOARDING_PAGE = "onboarding.html";

/** Badge the toolbar icon when badges won't appear on their own.
 *
 *  That means *standing* Steam access. Without it Firefox runs the add-on
 *  click-to-run, so pages stay bare until the icon is clicked — worth marking,
 *  since otherwise a game page silently shows nothing. Note this is "not
 *  automatic", not "broken": clicking the icon does work, and the popup says so.
 *
 *  The feed grant used to drive this and no longer does. It is opt-in but not
 *  required (the catalog fetch clears plain CORS without it — see
 *  feed-origin.ts), so badging the icon for it nagged users indefinitely about
 *  something that was not affecting them. */
async function updateActionBadge(): Promise<void> {
  const automatic = await hasStandingSteamAccess();
  await browser.action.setBadgeText({ text: automatic ? "" : "!" });
  if (!automatic) {
    await browser.action.setBadgeBackgroundColor({ color: "#b8860b" });
  }
}

/** Wire the background side of the permission flow:
 *  - badge the toolbar icon when badges won't appear without a click
 *  - on any grant, refresh the badge and warm the feed cache
 *  - open the onboarding tab once on first install
 *  `warmFeed` is injected to avoid a circular import with feed-service. */
export function initPermissionGate(warmFeed: () => Promise<void>): void {
  browser.permissions.onAdded.addListener((perms) => {
    log.info("permission granted:", perms.origins ?? perms);
    void updateActionBadge();
    void warmFeed();
  });
  browser.permissions.onRemoved.addListener((perms) => {
    log.warn("permission revoked:", perms.origins ?? perms);
    void updateActionBadge();
  });
  browser.runtime.onInstalled.addListener(async (details) => {
    log.info("onInstalled:", details.reason);
    // Unconditional on first install: onboarding's job is to say what the add-on
    // does and where its controls are. It used to be gated on the feed permission
    // being missing, back when that grant was believed to be required — with the
    // grant optional, skipping the introduction for users who happen to have it is
    // just an arbitrary rule.
    if (details.reason === "install") {
      log.info("first install — opening onboarding");
      await browser.tabs.create({ url: browser.runtime.getURL(ONBOARDING_PAGE) });
    }
    await updateActionBadge();
  });
  void updateActionBadge();
}
