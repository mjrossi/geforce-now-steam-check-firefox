# Privacy Policy

**GeForce NOW check for Steam** does not collect, store, or transmit any personal
data. There are no analytics, no tracking, and no accounts.

## What the extension does

- **Network requests.** The extension makes one kind of outbound request: it fetches
  NVIDIA's public GeForce NOW game catalog from
  `https://games.geforce.com/graphql` (the same API the GeForce NOW web app uses).
  No information about you, your browsing, or your Steam account is sent with these
  requests — they ask only for the public list of supported games.

- **Local storage.** The fetched catalog is cached locally in your browser
  (`browser.storage.local`) for up to 12 hours to avoid refetching on every page.
  This cache never leaves your device and contains only NVIDIA's public catalog data.

- **Page access.** Content scripts run only on `store.steampowered.com` app and
  wishlist pages. They read the Steam app IDs already present on the page in order to
  look them up in the cached catalog and draw an availability badge. They do not read,
  collect, or transmit anything else from those pages.

## Data collection declaration

The extension's manifest declares `data_collection_permissions: { required: ["none"] }`
— it collects no user data of any kind.

## Permissions

- `storage` — to cache the GeForce NOW catalog locally (see above).
- Host access to `https://games.geforce.com/*` — to fetch the catalog.

## Contact

Questions or concerns: open an issue at
<https://github.com/mjrossi/geforce-now-steam-check-firefox/issues>.
