import { hasFeedPermission } from "../shared/permission";
import { log } from "../shared/log";

const ONBOARDING_PAGE = "onboarding.html";

/** Reflect the feed-permission grant state on the toolbar icon: a "!" badge
 *  while it's missing (so the disabled state is visible without opening a Steam
 *  page), cleared once granted. */
async function updateActionBadge(): Promise<void> {
  const granted = await hasFeedPermission();
  await browser.action.setBadgeText({ text: granted ? "" : "!" });
  if (!granted) {
    await browser.action.setBadgeBackgroundColor({ color: "#b8860b" });
  }
}

/** Wire the background side of the Firefox MV3 host-permission opt-in flow:
 *  - badge the toolbar icon while the feed permission is missing
 *  - on grant, clear the badge and warm the feed cache so the next lookup is instant
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
    if (details.reason === "install" && !(await hasFeedPermission())) {
      log.info("first install without feed permission — opening onboarding");
      await browser.tabs.create({ url: browser.runtime.getURL(ONBOARDING_PAGE) });
    }
    await updateActionBadge();
  });
  void updateActionBadge();
}
