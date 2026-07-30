import { onLocalKeyChange } from "./storage";

/** Broadcast channel for "the catalog changed", from the background to whatever
 *  Steam pages happen to be open.
 *
 *  The popup's Refresh button used to claim it repaired the page you pressed it
 *  for, via `tabs.reload`. It could not: the manifest carries neither `tabs` nor a
 *  steampowered.com host permission, so `tabs.query` hands back a tab with no
 *  `url` and the guard never passed. Reloading blind was not an option either —
 *  the popup opens over whatever tab you are on.
 *
 *  `storage.local` needs no permission a content script doesn't already have, and
 *  `storage.onChanged` reaches every content script at once, which is the actual
 *  requirement: after a refetch, *all* open Steam pages are potentially wrong, not
 *  just the active one.
 *
 *  The key holds the new `fetchedAt`. Nothing reads the value — a change event is
 *  the whole signal — but a timestamp keeps it debuggable and guarantees each
 *  write differs from the last.
 */
export const EPOCH_KEY = "gfn-catalog-epoch";

/** Run `handler` whenever a new catalog is published.
 *
 *  Watching the cache key directly would work just as well; a separate key exists
 *  so content scripts depend on "a new catalog landed" rather than on the
 *  background's storage layout. Note it buys no bandwidth: the epoch is written in
 *  the same `set` call as the cache, so the cache's ~150 KB value is in the change
 *  event either way. That is the cost of this channel, paid twice a day plus once
 *  per manual refresh. */
export function onEpochChange(handler: () => void): void {
  // The value is ignored — a change event is the whole signal.
  onLocalKeyChange(EPOCH_KEY, () => {
    handler();
  });
}
