import { hasFeedPermission, hasStandingSteamAccess, requestFeedPermission } from "../shared/permission";
import { log } from "../shared/log";

const dot = document.getElementById("dot")!;
const statusText = document.getElementById("status-text")!;
const optional = document.getElementById("optional")!;
const enableBtn = document.getElementById("enable") as HTMLButtonElement;

/** The status line reports how the add-on runs on Steam, not whether the optional
 *  feed grant is held (see shared/feed-origin.ts). Standing access is the default;
 *  without it Firefox runs the add-on click-to-run, which still works — so that
 *  state is described, never reported as broken. The optional grant and its button
 *  disappear once taken, rather than sitting there as a permanent "not done"
 *  marker for something that was never required. */
function render(steam: boolean, feed: boolean): void {
  dot.className = `dot ${steam ? "dot--on" : "dot--off"}`;
  statusText.textContent = steam
    ? "Ready — open a Steam game page to see GeForce NOW badges."
    : "Set to run only when you click the toolbar icon. Badges still work; you'll just click the icon on each page. The popup can switch this to automatic.";
  optional.hidden = feed;
  enableBtn.hidden = feed;
}

enableBtn.addEventListener("click", async () => {
  const granted = await requestFeedPermission();
  log.info("onboarding: permission request returned", granted);
  render(await hasStandingSteamAccess(), granted);
});

void (async () => {
  const [steam, feed] = await Promise.all([hasStandingSteamAccess(), hasFeedPermission()]);
  log.info(`onboarding: opened, steam access = ${String(steam)}, feed grant = ${String(feed)}`);
  render(steam, feed);
})();
