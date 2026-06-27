/** Extract the Steam app id from any URL/href containing `/app/<id>`.
 *  Returns null when there is no app segment. */
export function parseAppId(url: string): number | null {
  const match = /\/app\/(\d+)/.exec(url);
  return match ? Number(match[1]) : null;
}

/** Extract the Steam app id from a capsule/header image URL, which embeds it as
 *  `.../apps/<id>/...` (e.g. cdn.cloudflare.steamstatic.com/steam/apps/620/...).
 *  Returns null when no app segment is present. */
export function parseAppIdFromImage(src: string): number | null {
  const match = /\/apps\/(\d+)\//.exec(src);
  return match ? Number(match[1]) : null;
}
