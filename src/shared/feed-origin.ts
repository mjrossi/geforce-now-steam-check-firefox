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
 *  This is the grant that governs whether badges appear *on their own* — but
 *  revoking it does not disable the add-on. Firefox switches to **click-to-run**,
 *  injecting the content scripts into the active tab when the user clicks the
 *  toolbar icon, and everything then works normally. No API distinguishes "only
 *  when clicked" from a hard block, and `hasStandingSteamAccess()` reads false
 *  while a click-granted content script is running perfectly well — so this state
 *  is worded as click-to-run, never as broken (permission.ts spells out why, and
 *  the add-on shipped once claiming otherwise).
 *
 *  The popup checks it because it is the setting that actually changes behaviour:
 *  reporting "Enabled" off the feed permission alone showed a green light while
 *  game pages sat bare. It is also mirrored into `optional_host_permissions` so
 *  `requestSteamAccess()` can offer a one-click way out — `permissions.request`
 *  rejects an origin the manifest doesn't mark requestable, and a `content_scripts`
 *  match alone does not count. Keep in sync with both. */
export const STEAM_ORIGINS = [
  "https://store.steampowered.com/app/*",
  "https://store.steampowered.com/wishlist/*",
];
