/** Run `handler` whenever one `storage.local` key changes, with its new value.
 *
 *  Both halves of the filter matter and both are easy to get subtly wrong, which
 *  is why they live in one place: `area === "local"` (sync/managed changes are not
 *  ours) and `key in changes` (a change event carries only the keys that moved,
 *  but every listener sees every write — the catalog cache and the debug flag are
 *  in the same area and must not trigger each other's handlers).
 *
 *  `newValue` is `undefined` when the key was removed. */
export function onLocalKeyChange(key: string, handler: (newValue: unknown) => void): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && key in changes) handler(changes[key]?.newValue);
  });
}
