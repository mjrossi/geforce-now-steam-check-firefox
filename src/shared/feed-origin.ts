/** The host the background must reach to read NVIDIA's GeForce NOW catalog.
 *  In Firefox MV3 this permission is *opt-in*: it is declared in the manifest's
 *  `host_permissions` but NOT granted when a user installs the signed add-on
 *  (only `web-ext run` auto-grants it). The popup/onboarding request it at
 *  runtime via `browser.permissions.request`, which needs the origin in this
 *  exact match-pattern form. Keep it in sync with `host_permissions`. */
export const FEED_ORIGINS = ["https://games.geforce.com/*"];
