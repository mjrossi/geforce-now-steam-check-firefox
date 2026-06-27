import { hasFeedPermission, requestFeedPermission } from "../shared/permission";
import { log } from "../shared/log";

const dot = document.getElementById("dot")!;
const statusText = document.getElementById("status-text")!;
const explain = document.getElementById("explain")!;
const enableBtn = document.getElementById("enable") as HTMLButtonElement;

/** Reflect the current grant state into the popup UI. */
function render(granted: boolean): void {
  dot.className = `dot ${granted ? "dot--on" : "dot--off"}`;
  statusText.textContent = granted ? "Enabled" : "Not enabled";
  explain.textContent = granted
    ? "Badges will appear on Steam store and wishlist pages."
    : "Firefox needs your permission to read NVIDIA's GeForce NOW catalog before badges can appear on Steam pages.";
  enableBtn.disabled = granted;
  enableBtn.textContent = granted ? "Enabled" : "Enable GeForce NOW checks";
}

/** Reload the active tab if it's a Steam page, so badges repaint immediately. */
async function reloadActiveSteamTab(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined && tab.url?.startsWith("https://store.steampowered.com/")) {
    await browser.tabs.reload(tab.id);
  }
}

enableBtn.addEventListener("click", async () => {
  const granted = await requestFeedPermission();
  log.info("popup: permission request returned", granted);
  render(granted);
  if (granted) await reloadActiveSteamTab();
});

void (async () => {
  const granted = await hasFeedPermission();
  log.info("popup: opened, permission granted =", granted);
  render(granted);
})();
