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

- **Background (`src/background/feed-service.ts`)** is the only network/state owner. It routes three message types (`shared/messages.ts` — `gfn-lookup` from content scripts, `gfn-status`/`gfn-refresh` from the popup) via an exhaustive switch. `gfn-status` must never trigger a fetch. Content scripts never fetch.
- **Messaging (`src/shared/lookup.ts`)** is the only path content scripts use to reach the background, and it **never rejects**: `sendMessage` throws when there's no live receiver (the MV3 background is an event page, so startup and extension-update windows both hit this), and an unhandled rejection means *no badge at all*. Failures degrade to `{ok:false, reason:"network"}` → "couldn't check".
- **Feed cache (`src/feed/feed-cache.ts`)** is pure and dependency-injected (`LoadDeps`: `getCache`/`setCache`/`fetchFeed`/`now`/`ttlMs`). `loadIndex` returns fresh cache, else refetches+rebuilds (12h TTL). **Key invariant:** on fetch failure it serves stale cache if present, and only returns `{ok:false}` when there's no cache at all — so the UI shows "couldn't check", never a false "not supported". The real `LoadDeps` lives in `feed-service.ts`; tests inject fakes.
- **All loads go through `feed/load-coordinator.ts`.** `loadIndex` is stateless, so nothing stopped concurrent callers each driving a full paginated fetch — the ordinary case being a restored session where every Steam tab wakes at once on a stale cache. `createLoadCoordinator` shares one in-flight `load()` across concurrent callers (so they share its failure too) and serializes `forceLoad()` against it. Serialization is not optional: `refreshCatalog` judges success by `fetchedAt` advancing, so a concurrent lookup-driven write would make it report on the wrong fetch. The shared slot is cleared inside the operation's `finally`, not by chaining onto the returned promise — a chained handler runs a microtask after the awaiting caller resumes, which let a load issued right after a failure be handed that same failure instead of retrying.
- **`feed/refresh.ts`** holds `readStatus` (cache-only, never fetches) and `refreshCatalog`. **Refresh success is `fetchedAt` advancing, never `LoadResult.ok`** — `loadIndex` reports `ok` when it falls back to a stale cache, which is right for a lookup but would tell the user a failed refresh worked. `tests/refresh.test.ts` pins this.
- **Index build (`src/feed/index-feed.ts`)** is pure: `GfnApp[]` → `Record<steamAppId, {rtx}>`. Keeps each game's `STEAM` variant; `rtx` comes from the per-game `RTX_ENABLED` capability flag.
- **`resolve-state.ts`** maps a lookup response to a `BadgeState` (`supported`/`not-supported`/`unknown`/`needs-permission`); **`badge/`** renders it (`gfn-link.ts`'s `resolveBannerLinks` decides which deep links a banner can offer). The two content scripts (`store.ts`, `wishlist.ts`) are thin glue: find anchors, message the background, paint.

**Non-definitive states must stay retryable in both content scripts.** `unknown` (background asleep/offline) and `needs-permission` mean "not yet", not "no", so neither may be frozen into the page. `wishlist.ts` gets this for free — it memoizes only definitive states, and scrolling supplies a steady stream of retries. A store page can sit idle forever, so `store.ts` drives its own: a backoff (`RETRY_DELAYS_MS`) plus a `visibilitychange` retry, which is what catches the user returning from granting the permission in the popup. Both scripts stamp injected nodes with `data-gfn-state` so a placeholder is replaced once the real answer lands. Note the manifest carries no `tabs` permission and no steampowered.com host permission, so `popup.ts`'s reload-the-active-tab path can't be relied on to heal an open page — the content script has to.

**Host permission is opt-in and this is load-bearing.** Firefox MV3 does *not* grant `host_permissions` on a normal install — only `web-ext run` auto-grants them — so a signed build can't fetch the catalog until the user says yes. `permissions.request` only works from a user gesture in an extension *page*, hence `popup/` and `onboarding/` (opened once on install by `background/permission-gate.ts`, which also drives the `!` toolbar badge and warms the cache on grant). `shared/permission.ts` + `shared/feed-origin.ts` wrap the check/request; keep `FEED_ORIGINS` in sync with the manifest. When the feed is unavailable, `feed-service.ts` distinguishes "permission" from "network" so the badge can tell the user which it is.

**Data source (see README + `feed-service.ts` header):** NVIDIA's catalog GraphQL API, `POST https://games.geforce.com/graphql` (the source the GFN web app uses). The legacy static `gfnpc-*.json` feed is abandoned and returns false negatives — do not go back to it. The schema is reverse-engineered (introspection is disabled); `apps(...)` caps `first` at 1300, so `fetchFeed` paginates on `pageInfo.endCursor`. Steam app id is parsed from each variant's `storeUrl` (which carries a `?utm_source=` suffix — the `/\/app\/(\d+)/` regex handles it).

**DOM injection is a good citizen:** everything injected is namespaced `gfn-check-*` (CSS in `badge/badge.css.ts`, one `<style>` per document via `ensureStyles`). SVG/markup is built with `createElement`/`createElementNS`, never `innerHTML`, to keep `web-ext lint` clean and avoid host/asset permissions. This must coexist with extensions like Augmented Steam.

**Wishlist row derivation (`src/content/wishlist-rows.ts`)** is the riskiest area and is unit-tested in isolation. The modern wishlist is a virtualized React list with hashed class names: when the legacy `.wishlist_row` selector matches nothing, rows are derived by seeding from `/app/` links + `/apps/` capsule images and climbing to each game's single-app block, excluding Steam chrome (`#global_header`, `#footer`, `.footerv2`, `#responsive_page_menu`). Because rows are recycled, injected pill slots are stamped with **both** `data-gfn-app-id` and `data-gfn-state` and re-rendered on either mismatch — the state stamp is what lets a row painted "couldn't check" (lookup still pending) be replaced once it resolves, since the app id alone would match. `wishlist.ts` memoizes only *definitive* states per tab via `content/wishlist-memo.ts` (`createStateMemo`, one per tab, unit-tested); `unknown`/`needs-permission` stay retryable so badges self-heal without a reload. `isDefinitive` lives in `resolve-state.ts` and is the shared rule for both content scripts.

**Build:** `build.mjs` bundles five entry points (`background`, `store`, `wishlist`, `popup`, `onboarding`) as IIFE (classic scripts, not modules), copies `src/manifest.json`, `icons/`, and the popup/onboarding HTML into `dist/`. Adding a script means adding it both here and in the manifest.

## Conventions

- Keep the fetch/transform split: I/O lives in `feed-service.ts`; transforms (`buildIndex`, `resolve-state`, `wishlist-rows`) stay pure and importable so they're testable without mocking `browser`. Prefer adding a test next to the pure function over testing through the message layer.
- Selectors that depend on live Steam markup (store placement anchors `.apphub_HeaderStandardTop`/`.page_title_area`/`#game_area_purchase`, wishlist chrome exclusions) are the things most likely to break and the only things that need manual `just dev` verification — flag them when touched.
