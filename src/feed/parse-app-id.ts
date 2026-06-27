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

/** Find the Steam app id for a row element. Prefers the row's first `/app/<id>`
 *  anchor; falls back to a capsule image whose src embeds the app id. Robust to
 *  markup changes — relies on the stable app link / asset URL, not a specific
 *  class or attribute. */
export function parseAppIdFromElement(el: Element): number | null {
  const anchor = el.querySelector<HTMLAnchorElement>('a[href*="/app/"]');
  const fromAnchor = anchor ? parseAppId(anchor.getAttribute("href") ?? "") : null;
  if (fromAnchor !== null) return fromAnchor;
  for (const img of el.querySelectorAll<HTMLImageElement>("img[src]")) {
    const fromImg = parseAppIdFromImage(img.getAttribute("src") ?? "");
    if (fromImg !== null) return fromImg;
  }
  return null;
}
