import {
  hasFeedPermission,
  hasStandingSteamAccess,
  requestFeedPermission,
  requestSteamAccess,
} from "../shared/permission";
import type { StatusResponse } from "../shared/messages";
import { asStatus, isRefreshResponse } from "../shared/messages";
import { sendToBackground } from "../shared/send";
import { formatAge } from "../shared/format-age";
import { log } from "../shared/log";

const dot = document.getElementById("dot")!;
const statusText = document.getElementById("status-text")!;
const explain = document.getElementById("explain")!;
const enableBtn = document.getElementById("enable") as HTMLButtonElement;
const catalogStatus = document.getElementById("catalog-status")!;
const refreshBtn = document.getElementById("refresh") as HTMLButtonElement;
const allowSteamBtn = document.getElementById("allow-steam") as HTMLButtonElement;

/** Reflect the current permission state into the popup UI.
 *
 *  Two grants, and the status light reports the one that governs whether badges
 *  appear on their own. `steam` is *standing* access from the content scripts'
 *  match patterns: granted by default, and dropped when Firefox's per-site control
 *  is set to "only when clicked". `feed` is the opt-in games.geforce.com host
 *  permission, which is not required at all — the catalog fetch clears plain CORS
 *  without it (feed-origin.ts). Driving the light off `feed` was backwards: it
 *  nagged users whose add-on worked fine and said nothing about the grant that
 *  actually changes behaviour.
 *
 *  **The `!steam` copy must not claim nothing works.** Opening this popup is the
 *  very gesture that grants click-to-run access, so by the time it renders, the
 *  page behind it has usually just been badged. An earlier version said "no badges
 *  can appear" and was contradicted on screen a second later. */
function render(steam: boolean, feed: boolean): void {
  dot.className = `dot ${steam ? "dot--on" : "dot--off"}`;
  statusText.textContent = steam ? "Enabled" : "Runs when clicked";
  explain.textContent = !steam
    ? "Badges appear only after you click this icon — which is why the page behind this popup has one now."
    : feed
      ? "Badges appear on Steam store and wishlist pages. The catalog is read directly from NVIDIA."
      : "Badges appear on Steam store and wishlist pages. Optionally, allow direct access to NVIDIA's catalog — not required today, but it keeps checks working if NVIDIA changes how the catalog may be read.";

  // One call to action at a time, and click-to-run is the one that changes what
  // the user sees. The optional catalog grant waits its turn.
  allowSteamBtn.hidden = steam;
  enableBtn.hidden = !steam || feed;
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

// Note there is deliberately no "reload the Steam tab" path here. It was tried and
// silently did nothing: the manifest carries no `tabs` permission, and the Steam
// access that content scripts run under is not a host permission the popup can read
// a URL through, so `tabs.query` returns a tab with no `url` — leaving no way to
// tell whether reloading would hit a Steam page or whatever else the user is on.
// Open pages heal themselves instead — the background publishes a catalog epoch to
// storage.local on every write and both content scripts watch for it
// (shared/catalog-epoch.ts), which reaches *every* open Steam page, not just the
// active one.

allowSteamBtn.addEventListener("click", async () => {
  const granted = await requestSteamAccess();
  log.info("popup: steam access request returned", granted);
  if (!granted) {
    // Either declined, or Firefox refused the request outright. Only now is the
    // manual route worth spelling out — offering it up front, as this popup used
    // to, buried a one-click fix under a paragraph about context menus.
    explain.textContent =
      "Still click-to-run. You can also allow it from the Add-ons Manager, under this add-on's Permissions.";
    return;
  }
  render(true, await hasFeedPermission());
  // Tabs opened before the grant have no content script in them at all, so unlike
  // every other healing path in the extension this one can't reach them.
  explain.textContent = "Done — badges now appear on their own. Reload any Steam pages you already have open.";
});

enableBtn.addEventListener("click", async () => {
  const granted = await requestFeedPermission();
  log.info("popup: permission request returned", granted);
  render(await hasStandingSteamAccess(), granted);
});

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing…";
  catalogStatus.textContent = "Fetching the GeForce NOW catalog…";

  const reply = await sendToBackground({ type: "gfn-refresh" });
  const result = isRefreshResponse(reply) ? reply : null;
  log.info("popup: refresh returned ok =", result?.ok);

  refreshBtn.textContent = "Refresh catalog";
  refreshBtn.disabled = false; // Unconditional — a failed refresh is worth retrying.
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
  // All three in flight together: the catalog status depends on neither grant, and
  // it is the slow one — it may have to wake the MV3 event page — so waiting for
  // the two `permissions.contains` round trips first only lengthens how long the
  // popup sits on "Checking catalog…".
  const [steam, feed, status] = await Promise.all([
    hasStandingSteamAccess(),
    hasFeedPermission(),
    sendToBackground({ type: "gfn-status" }),
  ]);
  log.info(`popup: opened, steam access = ${String(steam)}, feed grant = ${String(feed)}`);
  render(steam, feed);
  renderCatalog(asStatus(status));
})();
