import { FEED_ORIGINS } from "./feed-origin";

/** Has the user granted access to the GeForce NOW catalog host yet?
 *  Callable from any extension context (background, popup, onboarding). */
export function hasFeedPermission(): Promise<boolean> {
  return browser.permissions.contains({ origins: FEED_ORIGINS });
}

/** Prompt the user to grant the feed host permission. MUST be called from a
 *  user-gesture handler in an extension *page* (popup/onboarding) — Firefox
 *  rejects it from content scripts and from non-interactive contexts. Resolves
 *  true if the user accepted. */
export function requestFeedPermission(): Promise<boolean> {
  return browser.permissions.request({ origins: FEED_ORIGINS });
}
