/** Extract the Steam app id from any URL/href containing `/app/<id>`.
 *  Returns null when there is no app segment. */
export function parseAppId(url: string): number | null {
  const match = /\/app\/(\d+)/.exec(url);
  return match ? Number(match[1]) : null;
}

/** Find the Steam app id for a row element via its first `/app/<id>` anchor.
 *  Robust to markup changes — relies on the stable app-link href, not a
 *  specific class/attribute. */
export function parseAppIdFromElement(el: Element): number | null {
  const anchor = el.querySelector<HTMLAnchorElement>('a[href*="/app/"]');
  return anchor ? parseAppId(anchor.getAttribute("href") ?? "") : null;
}
