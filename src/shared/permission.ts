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

/** Can the content scripts still run on Steam? Granted by default, but revocable
 *  from `about:addons` — and revoking it silently disables the entire extension,
 *  so the popup reports on it rather than showing a green light for the feed
 *  permission alone. */
export function hasSteamAccess(): Promise<boolean> {
  return browser.permissions.contains({ origins: STEAM_ORIGINS });
}

/** Prompt the user to grant the feed host permission. MUST be called from a
 *  user-gesture handler in an extension *page* (popup/onboarding) — Firefox
 *  rejects it from content scripts and from non-interactive contexts. Resolves
 *  true if the user accepted. */
export function requestFeedPermission(): Promise<boolean> {
  return browser.permissions.request({ origins: FEED_ORIGINS });
}
