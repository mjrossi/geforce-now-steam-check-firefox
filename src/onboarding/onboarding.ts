import { hasFeedPermission, hasSteamAccess, requestFeedPermission } from "../shared/permission";
import { log } from "../shared/log";

const dot = document.getElementById("dot")!;
const statusText = document.getElementById("status-text")!;
const optional = document.getElementById("optional")!;
const enableBtn = document.getElementById("enable") as HTMLButtonElement;

/** The status line reports whether the add-on can work at all — that is Steam
 *  access, not the feed grant, which is optional (see shared/feed-origin.ts). The
 *  optional grant and its button disappear once taken, rather than sitting there
 *  as a permanent "not done" marker for something that was never required. */
function render(steam: boolean, feed: boolean): void {
  dot.className = `dot ${steam ? "dot--on" : "dot--off"}`;
  statusText.textContent = steam
    ? "Ready — open a Steam game page to see GeForce NOW badges."
    : "This add-on's access to store.steampowered.com is turned off, so badges can't appear. Re-enable it in Firefox's Add-ons Manager under Permissions.";
  optional.hidden = feed;
  enableBtn.hidden = feed;
}

enableBtn.addEventListener("click", async () => {
  const granted = await requestFeedPermission();
  log.info("onboarding: permission request returned", granted);
  render(await hasSteamAccess(), granted);
});

void (async () => {
  const [steam, feed] = await Promise.all([hasSteamAccess(), hasFeedPermission()]);
  log.info(`onboarding: opened, steam access = ${String(steam)}, feed grant = ${String(feed)}`);
  render(steam, feed);
})();
