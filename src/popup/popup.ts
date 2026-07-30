import { hasFeedPermission, requestFeedPermission } from "../shared/permission";
import type { RefreshRequest, StatusRequest, StatusResponse } from "../shared/messages";
import { asStatus, isRefreshResponse } from "../shared/messages";
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
 *  reporting a badge that looks wrong, so it names both size and age — and keeps
 *  "we couldn't ask" distinct from "there is no catalog yet", which are very
 *  different bug reports. */
function renderCatalog(status: StatusResponse | undefined): void {
  if (status === undefined) {
    catalogStatus.textContent = "Couldn't reach the extension's background service.";
    return;
  }
  if (status === null) {
    catalogStatus.textContent = "Catalog not loaded yet.";
    return;
  }
  const games = status.count.toLocaleString();
  catalogStatus.textContent = `Catalog: ${games} games · updated ${formatAge(Date.now() - status.fetchedAt)}`;
}

/** Send a message to the background, or `undefined` if it can't be reached.
 *
 *  Same event-page startup window the content scripts guard against (see
 *  shared/lookup.ts), and the same rule: an unhandled throw would strand the
 *  popup on its placeholder text. `sendMessage` also *resolves* with `undefined`
 *  when a listener declines the message — which is what an older background does
 *  mid-update for a message type it has never heard of — so callers validate the
 *  reply rather than casting it. */
async function send(req: StatusRequest | RefreshRequest): Promise<unknown> {
  try {
    return await browser.runtime.sendMessage(req);
  } catch (err) {
    log.warn("popup: background unreachable —", err);
    return undefined;
  }
}

// Note there is deliberately no "reload the Steam tab" path here. It was tried and
// silently did nothing: the manifest carries neither `tabs` nor a steampowered.com
// host permission, so `tabs.query` returns a tab with no `url` and there is no way
// to tell whether reloading would hit a Steam page or whatever else the user is on.
// Open pages heal themselves instead — the background publishes a catalog epoch to
// storage.local on every write and both content scripts watch for it
// (shared/catalog-epoch.ts), which reaches *every* open Steam page, not just the
// active one. Granting the permission warms the feed, so that path is covered too.

enableBtn.addEventListener("click", async () => {
  const granted = await requestFeedPermission();
  log.info("popup: permission request returned", granted);
  render(granted);
});

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing…";
  catalogStatus.textContent = "Fetching the GeForce NOW catalog…";

  const reply = await send({ type: "gfn-refresh" });
  const result = isRefreshResponse(reply) ? reply : null;
  log.info("popup: refresh returned ok =", result?.ok);

  refreshBtn.textContent = "Refresh catalog";
  // Re-enable per the *current* grant state: the permission can be revoked while
  // the popup is open, and re-enabling into that state only invites a failure.
  refreshBtn.disabled = !(await hasFeedPermission());
  // Four distinct outcomes, and collapsing any of them loses a bug report.
  if (result === null) {
    // No usable reply at all — not the same thing as a failed fetch.
    renderCatalog(undefined);
  } else if (result.ok) {
    // Open Steam pages pick the new catalog up on their own, via the epoch.
    renderCatalog(result.status);
  } else if (result.status === null) {
    catalogStatus.textContent = "Refresh failed — no catalog cached yet.";
  } else {
    // The fetch failed but the previous catalog is still there and still worth
    // showing; refreshCatalog returns the stale status on purpose.
    renderCatalog(result.status);
    catalogStatus.textContent += " · refresh failed";
  }
});

void (async () => {
  const granted = await hasFeedPermission();
  log.info("popup: opened, permission granted =", granted);
  render(granted);

  renderCatalog(asStatus(await send({ type: "gfn-status" })));
})();
