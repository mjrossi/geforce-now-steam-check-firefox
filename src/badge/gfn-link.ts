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
