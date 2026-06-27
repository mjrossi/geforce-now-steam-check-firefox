# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A Firefox MV3 extension that badges Steam store and wishlist pages with NVIDIA GeForce NOW availability.

## Commands

Tooling (node, just) is pinned in `mise.toml` — run `mise install` once, then `just install` (`npm ci`). `just` lists all recipes.

- `just check` — full local gate (matches CI): typecheck + test + lint. Run this before considering work done.
- `just typecheck` — **two** passes: `tsc --noEmit` (browser sources, `tsconfig.json`) and `tsc --noEmit -p tsconfig.node.json` (build script). Both must pass.
- `just test` / `just test-watch` — Vitest. Run one file: `npx vitest run tests/index-feed.test.ts`; one case: `npx vitest run -t "recycled"`.
- `just build` — `node build.mjs` (esbuild) → `dist/`.
- `just lint` — builds, then `web-ext lint` over `dist/`. Must stay 0 errors / 0 warnings.
- `just dev` — launches Firefox with the extension loaded (the only way to verify live-DOM behavior; an agent can't do this).
- `just package` / `just sign` — distributable zip / signed `.xpi` (signing needs `WEB_EXT_API_*`).

Tests that touch the DOM start with `// @vitest-environment jsdom`.

## Architecture

**Data flow:** content script (store/wishlist page) → `browser.runtime.sendMessage` → background service → cached index lookup → response → badge rendered into the page.

- **Background (`src/background/feed-service.ts`)** is the only network/state owner. It answers `gfn-lookup` messages by calling `loadIndex` and returning the supported subset of requested Steam app ids. Content scripts never fetch.
- **Feed cache (`src/feed/feed-cache.ts`)** is pure and dependency-injected (`LoadDeps`: `getCache`/`setCache`/`fetchFeed`/`now`/`ttlMs`). `loadIndex` returns fresh cache, else refetches+rebuilds (12h TTL). **Key invariant:** on fetch failure it serves stale cache if present, and only returns `{ok:false}` when there's no cache at all — so the UI shows "couldn't check", never a false "not supported". The real `LoadDeps` lives in `feed-service.ts`; tests inject fakes.
- **Index build (`src/feed/index-feed.ts`)** is pure: `GfnApp[]` → `Record<steamAppId, {rtx}>`. Keeps each game's `STEAM` variant; `rtx` comes from the per-game `RTX_ENABLED` capability flag.
- **`resolve-state.ts`** maps a lookup response to a `BadgeState` (`supported`/`not-supported`/`unknown`); **`badge/`** renders it. The two content scripts (`store.ts`, `wishlist.ts`) are thin glue: find anchors, message the background, paint.

**Data source (see README + `feed-service.ts` header):** NVIDIA's catalog GraphQL API, `POST https://games.geforce.com/graphql` (the source the GFN web app uses). The legacy static `gfnpc-*.json` feed is abandoned and returns false negatives — do not go back to it. The schema is reverse-engineered (introspection is disabled); `apps(...)` caps `first` at 1300, so `fetchFeed` paginates on `pageInfo.endCursor`. Steam app id is parsed from each variant's `storeUrl` (which carries a `?utm_source=` suffix — the `/\/app\/(\d+)/` regex handles it).

**DOM injection is a good citizen:** everything injected is namespaced `gfn-check-*` (CSS in `badge/badge.css.ts`, one `<style>` per document via `ensureStyles`). SVG/markup is built with `createElement`/`createElementNS`, never `innerHTML`, to keep `web-ext lint` clean and avoid host/asset permissions. This must coexist with extensions like Augmented Steam.

**Wishlist row derivation (`src/content/wishlist-rows.ts`)** is the riskiest area and is unit-tested in isolation. The modern wishlist is a virtualized React list with hashed class names: when the legacy `.wishlist_row` selector matches nothing, rows are derived by seeding from `/app/` links + `/apps/` capsule images and climbing to each game's single-app block, excluding Steam chrome (`#global_header`, `#footer`, `.footerv2`, `#responsive_page_menu`). Because rows are recycled, injected pill slots are stamped with `data-gfn-app-id` and re-rendered on mismatch.

**Build:** `build.mjs` bundles three entry points (`background`, `store`, `wishlist`) as IIFE (classic scripts, not modules), copies `src/manifest.json` and `icons/` into `dist/`. Adding a content/background script means adding it both here and in the manifest.

## Conventions

- Keep the fetch/transform split: I/O lives in `feed-service.ts`; transforms (`buildIndex`, `resolve-state`, `wishlist-rows`) stay pure and importable so they're testable without mocking `browser`. Prefer adding a test next to the pure function over testing through the message layer.
- Selectors that depend on live Steam markup (store placement anchors `.apphub_HeaderStandardTop`/`.page_title_area`/`#game_area_purchase`, wishlist chrome exclusions) are the things most likely to break and the only things that need manual `just dev` verification — flag them when touched.
