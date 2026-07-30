import { FEED_ORIGINS, STEAM_ORIGINS } from "./feed-origin";

/** Has the user granted access to the GeForce NOW catalog host yet?
 *  Callable from any extension context (background, popup, onboarding).
 *
 *  Note this is *not* the question "can the extension work" — the catalog fetch
 *  succeeds under plain CORS without it (see feed-origin.ts). Use it to decide
 *  whether to offer the grant, never to explain a failure. */
export function hasFeedPermission(): Promise<boolean> {
  return browser.permissions.contains({ origins: FEED_ORIGINS });
}

/** Does the add-on hold *standing* access to Steam — i.e. will content scripts run
 *  without the user doing anything?
 *
 *  Granted by default. Turning it off in `about:addons`, or picking "Only when
 *  clicked" from the toolbar icon's context menu, puts Firefox's per-site control
 *  into click-to-run: the standing grant is dropped and access is handed to the
 *  active tab only when the user clicks the toolbar icon.
 *
 *  **False therefore means "not automatic", not "broken".** Observed directly:
 *  with the permission revoked, opening a game page paints nothing, and clicking
 *  the toolbar icon injects the content script and paints the banner. Two
 *  consequences worth remembering:
 *  - `permissions.contains` reports only the standing grant, so it is still false
 *    at the moment the click-granted content script is running happily. There is
 *    no API that distinguishes "only when clicked" from a hard block, so the UI
 *    must word this as click-to-run rather than as a failure.
 *  - Opening the popup to read this value is itself the gesture that grants
 *    access, so anything rendered from it is describing the state one moment
 *    before the user's click changed it. Don't tell them nothing can work. */
export function hasStandingSteamAccess(): Promise<boolean> {
  return browser.permissions.contains({ origins: STEAM_ORIGINS });
}

/** Prompt the user to grant the feed host permission. MUST be called from a
 *  user-gesture handler in an extension *page* (popup/onboarding) — Firefox
 *  rejects it from content scripts and from non-interactive contexts. Resolves
 *  true if the user accepted. */
export function requestFeedPermission(): Promise<boolean> {
  return browser.permissions.request({ origins: FEED_ORIGINS });
}

/** Prompt the user to restore *standing* Steam access, i.e. to leave click-to-run
 *  mode so badges appear without clicking the toolbar icon.
 *
 *  Same user-gesture rule as above. `STEAM_ORIGINS` is declared in the manifest's
 *  `optional_host_permissions` purely so this call is legal — `permissions.request`
 *  only accepts origins the manifest marks requestable, and a `content_scripts`
 *  match pattern alone does not. Without it the only remedy we could offer was a
 *  paragraph of instructions for Firefox's own menus.
 *
 *  Resolves false rather than throwing if Firefox refuses the request outright, so
 *  the caller can fall back to those instructions instead of dying on a rejected
 *  promise. */
export async function requestSteamAccess(): Promise<boolean> {
  try {
    return await browser.permissions.request({ origins: STEAM_ORIGINS });
  } catch {
    return false;
  }
}
