# GeForce NOW check for Steam (Firefox)

Badges Steam store and wishlist pages with NVIDIA GeForce NOW availability.

## Develop

Requires [mise](https://mise.jdx.dev).

```bash
mise install      # node + just
just install      # npm ci
just check        # typecheck + test + lint
just dev          # launch Firefox with the extension loaded
just package      # build a distributable zip
```

## How it works

A background script caches NVIDIA's GeForce NOW catalog (12 h TTL) and indexes it
by Steam app id. Content scripts on store/wishlist pages look games up and inject
namespaced (`gfn-check-*`) badges. Data source: the GFN catalog GraphQL API the
GeForce NOW web app uses, `https://games.geforce.com/graphql` (the legacy static
`gfnpc-*.json` feed is abandoned and returns false negatives — it is missing
large parts of the catalog, including newer titles).

The green RTX chip reflects each game's per-title `RTX_ENABLED` flag. Membership
tiers are not shown.

## Debugging

The background script honors two `browser.storage.local` flags. Set them from
the extension's background console (`about:debugging` → Inspect):

```js
// Log every lookup: index size, and hit/miss per app id.
browser.storage.local.set({ "gfn-debug": true });
// Force a one-time feed refetch, bypassing the 12 h cache (auto-clears).
browser.storage.local.set({ "gfn-force-refresh": true });
```

With `gfn-debug` on, reload a store page (e.g.
`https://store.steampowered.com/app/1285190/` for Borderlands 4) and check the
background console to see whether that app id is present in the indexed feed.
