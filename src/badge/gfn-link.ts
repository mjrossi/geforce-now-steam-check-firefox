/** Deep link into the GeForce NOW web app for one game, per NVIDIA's GFN SDK
 *  deep-linking spec (game-id plus the utm params the spec requires). `gfnId`
 *  is the catalog app UUID carried in the index as `gfnId`. */
export function gfnPlayUrl(gfnId: string): string {
  const url = new URL("https://play.geforcenow.com/games");
  url.searchParams.set("game-id", gfnId);
  url.searchParams.set("utm_source", "gfn-check-steam");
  url.searchParams.set("utm_campaign", "steam-store-banner");
  return url.toString();
}

/** Deep link into the *native* GeForce NOW client. The `geforcenow://` scheme
 *  is registered by the desktop app but undocumented: the client strips the
 *  `geforcenow://route/` prefix and treats the remainder as its `--url-route`
 *  argument, so the fragment mirrors the app's own per-game desktop shortcuts
 *  (`#?cmsId=…&launchSource=External&shortName=<uuid>&parentGameId=<uuid>`).
 *  Verified against GFN 2.0.85 on macOS; a URL without the `route/` prefix is
 *  received but rejected. Built by hand — the params live in a URL *fragment*,
 *  which URLSearchParams would serialize into a query instead. */
export function gfnAppUrl(cmsId: number, gfnId: string): string {
  const id = encodeURIComponent(gfnId);
  return (
    `geforcenow://route/#?cmsId=${String(cmsId)}&launchSource=External` +
    `&shortName=${id}&parentGameId=${id}`
  );
}
