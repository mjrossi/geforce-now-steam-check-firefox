import { hasFeedPermission, hasSteamAccess, requestFeedPermission } from "../shared/permission";
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

/** Reflect the current permission state into the popup UI.
 *
 *  Two grants, and the status light reports the one that actually gates the
 *  product. `steam` comes from the content scripts' match patterns: granted by
 *  default, but revocable in about:addons, and revoking it stops the scripts being
 *  injected so no badge can appear anywhere. `feed` is the opt-in
 *  games.geforce.com host permission, which is *not* required — the catalog fetch
 *  clears plain CORS without it (feed-origin.ts). Showing a green "Enabled" light
 *  off `feed` alone was backwards on both counts: it nagged users whose extension
 *  worked fine, and it showed all-clear on a browser where nothing could work. */
function render(steam: boolean, feed: boolean): void {
  dot.className = `dot ${steam ? "dot--on" : "dot--off"}`;
  statusText.textContent = steam ? "Enabled" : "Disabled for Steam";
  explain.textContent = !steam
    ? "This add-on's access to store.steampowered.com has been turned off, so no badges can appear. Re-enable it in Firefox's Add-ons Manager under Permissions."
    : feed
      ? "Badges appear on Steam store and wishlist pages. The catalog is read directly from NVIDIA."
      : "Badges appear on Steam store and wishlist pages. Optionally, allow direct access to NVIDIA's catalog — not required today, but it keeps checks working if NVIDIA changes how the catalog may be read.";
  enableBtn.hidden = feed || !steam;
  enableBtn.disabled = feed || !steam;
  // Refreshing is a network fetch; it works with or without the feed grant, but
  // there is nothing to refresh if the content scripts can't run.
  refreshBtn.disabled = !steam;
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
  // "Steam games", not "games": this counts the *indexed* entries, which is the
  // GFN catalog narrowed to titles with a resolvable Steam app id — currently
  // ~2000 of ~2200. Saying "games" invites a comparison with the raw catalog size
  // in the background log and reads like one of the two is wrong.
  const games = status.count.toLocaleString();
  catalogStatus.textContent = `Catalog: ${games} Steam games · updated ${formatAge(Date.now() - status.fetchedAt)}`;
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
// silently did nothing: the manifest carries no `tabs` permission, and the Steam
// access that content scripts run under is not a host permission the popup can read
// a URL through, so `tabs.query` returns a tab with no `url` — leaving no way to
// tell whether reloading would hit a Steam page or whatever else the user is on.
// Open pages heal themselves instead — the background publishes a catalog epoch to
// storage.local on every write and both content scripts watch for it
// (shared/catalog-epoch.ts), which reaches *every* open Steam page, not just the
// active one.

enableBtn.addEventListener("click", async () => {
  const granted = await requestFeedPermission();
  log.info("popup: permission request returned", granted);
  render(await hasSteamAccess(), granted);
});

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing…";
  catalogStatus.textContent = "Fetching the GeForce NOW catalog…";

  const reply = await send({ type: "gfn-refresh" });
  const result = isRefreshResponse(reply) ? reply : null;
  log.info("popup: refresh returned ok =", result?.ok);

  refreshBtn.textContent = "Refresh catalog";
  // Re-enable per the *current* state: access can be revoked while the popup is
  // open, and re-enabling into that state only invites a failure.
  refreshBtn.disabled = !(await hasSteamAccess());
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
  const [steam, feed] = await Promise.all([hasSteamAccess(), hasFeedPermission()]);
  log.info(`popup: opened, steam access = ${String(steam)}, feed grant = ${String(feed)}`);
  render(steam, feed);

  renderCatalog(asStatus(await send({ type: "gfn-status" })));
})();
