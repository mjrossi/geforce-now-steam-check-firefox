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

A background script caches NVIDIA's public supported-games feed (12 h TTL) and
indexes it by Steam app id. Content scripts on store/wishlist pages look games up
and inject namespaced (`gfn-check-*`) badges. Data source:
`https://static.nvidiagrid.net/supported-public-game-list/locales/gfnpc-en-US.json`.

Membership tiers are not shown — the public feed does not expose them.
