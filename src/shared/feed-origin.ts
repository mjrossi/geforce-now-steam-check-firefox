/** The host the background reads NVIDIA's GeForce NOW catalog from.
 *
 *  Declared in the manifest's `host_permissions`, which Firefox MV3 does not grant
 *  on install — the popup/onboarding request it at runtime via
 *  `browser.permissions.request`, which needs the origin in this exact
 *  match-pattern form. Keep it in sync with `host_permissions`.
 *
 *  **This grant is insurance, not a gate.** `games.geforce.com/graphql` answers
 *  with `access-control-allow-origin: *` and allows the `content-type` header, and
 *  `fetchFeed` sends `credentials: "omit"` — so the catalog fetch satisfies
 *  ordinary CORS and succeeds with the permission ungranted. Verified against the
 *  live endpoint; the extension shipped for a while believing otherwise. What the
 *  grant buys is independence from NVIDIA's CORS policy (and from Firefox's
 *  quarantined-domains feature), which is worth having and worth offering — but it
 *  must never be described to users, or to AMO reviewers, as required for badges
 *  to work. */
export const FEED_ORIGINS = ["https://games.geforce.com/*"];

/** The Steam pages the content scripts are declared against.
 *
 *  These come from `content_scripts[].matches`, never from `host_permissions` —
 *  they have never appeared there in this repo's history. Firefox MV3 still
 *  surfaces them in `about:addons` → Permissions as a user-revocable toggle, and
 *  unlike FEED_ORIGINS they are granted by default.
 *
 *  This is the grant that actually gates the product: revoke it and the content
 *  scripts are never injected, so no badge appears anywhere. The popup checks it
 *  for exactly that reason — reporting "Enabled" off the feed permission alone
 *  would show a green light on a browser where nothing can possibly work. Keep in
 *  sync with the manifest's `content_scripts`. */
export const STEAM_ORIGINS = [
  "https://store.steampowered.com/app/*",
  "https://store.steampowered.com/wishlist/*",
];
