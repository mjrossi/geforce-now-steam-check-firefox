const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Human-readable age for the popup's "updated …" line, e.g. "just now",
 *  "12 min ago", "3 h ago", "2 days ago". Coarse on purpose: the catalog has a
 *  12 h TTL, so minute-level precision past the first hour is noise. Negative
 *  ages (clock skew) read as "just now" rather than a nonsensical future. */
export function formatAge(ageMs: number): string {
  if (ageMs < MINUTE) return "just now";
  if (ageMs < HOUR) return `${String(Math.floor(ageMs / MINUTE))} min ago`;
  if (ageMs < DAY) return `${String(Math.floor(ageMs / HOUR))} h ago`;
  const days = Math.floor(ageMs / DAY);
  return days === 1 ? "1 day ago" : `${String(days)} days ago`;
}
