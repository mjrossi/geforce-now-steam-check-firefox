import { hasFeedPermission, requestFeedPermission } from "../shared/permission";
import type { RefreshRequest, RefreshResponse, StatusRequest, StatusResponse } from "../shared/messages";
import { formatAge } from "../shared/format-age";
import { log } from "../shared/log";

const dot = document.getElementById("dot")!;
const statusText = document.getElementById("status-text")!;
const explain = document.getElementById("explain")!;
const enableBtn = document.getElementById("enable") as HTMLButtonElement;
const catalogStatus = document.getElementById("catalog-status")!;
const refreshBtn = document.getElementById("refresh") as HTMLButtonElement;

/** Reflect the current grant state into the popup UI. */
function render(granted: boolean): void {
  dot.className = `dot ${granted ? "dot--on" : "dot--off"}`;
  statusText.textContent = granted ? "Enabled" : "Not enabled";
  explain.textContent = granted
    ? "Badges will appear on Steam store and wishlist pages."
    : "Firefox needs your permission to read NVIDIA's GeForce NOW catalog before badges can appear on Steam pages.";
  enableBtn.disabled = granted;
  enableBtn.textContent = granted ? "Enabled" : "Enable GeForce NOW checks";
  // Refreshing needs the host permission; without it the fetch can only fail.
  refreshBtn.disabled = !granted;
}

/** Describe the cached catalog. This is the line a user reads back to us when
 *  reporting a badge that looks wrong, so it names both size and age. */
function renderCatalog(status: StatusResponse): void {
  if (status === null) {
    catalogStatus.textContent = "Catalog not loaded yet.";
    return;
  }
  const games = status.count.toLocaleString();
  catalogStatus.textContent = `Catalog: ${games} games · updated ${formatAge(Date.now() - status.fetchedAt)}`;
}

/** Ask the background something, or `null` if it can't be reached. Same event-page
 *  startup window the content scripts guard against — here an unhandled throw
 *  would strand the popup on its placeholder text. */
async function ask<T>(req: StatusRequest | RefreshRequest): Promise<T | null> {
  try {
    return (await browser.runtime.sendMessage(req)) as T;
  } catch (err) {
    log.warn("popup: background unreachable —", err);
    return null;
  }
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

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing…";
  catalogStatus.textContent = "Fetching the GeForce NOW catalog…";

  const result = await ask<RefreshResponse>({ type: "gfn-refresh" });
  log.info("popup: refresh returned ok =", result?.ok);

  refreshBtn.textContent = "Refresh catalog";
  refreshBtn.disabled = false;
  if (result?.ok) {
    renderCatalog(result.status);
    // A page showing "couldn't check" (or a since-corrected answer) only picks
    // the new catalog up on reload.
    await reloadActiveSteamTab();
  } else {
    catalogStatus.textContent = "Refresh failed — check your connection.";
  }
});

void (async () => {
  const granted = await hasFeedPermission();
  log.info("popup: opened, permission granted =", granted);
  render(granted);

  renderCatalog(await ask<StatusResponse>({ type: "gfn-status" }));
})();
