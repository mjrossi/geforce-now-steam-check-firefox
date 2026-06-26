# GeForce NOW availability badge for Steam — Firefox extension

**Date:** 2026-06-26
**Status:** Approved design (pre-implementation)

## Summary

A Firefox extension that, while browsing Steam, shows whether each game is
playable on NVIDIA GeForce NOW. It injects a badge on **store app pages** and
**wishlist** rows, reporting a supported / not-available state plus an
"RTX-optimized" marker, sourced from NVIDIA's public supported-games feed. It is
built to coexist cleanly with other Steam-augmenting extensions.

## Goals

- Tell the user, in-context on Steam, whether a game is on GeForce NOW.
- Surface the "fully optimized" (RTX) quality signal when available.
- Never show a false negative: distinguish "confirmed not supported" from
  "couldn't check".
- Coexist as a good citizen with Augmented Steam and alike03's subscription-info
  extension — no DOM collisions, no visual overlap.

## Non-goals (YAGNI — revisit later)

- Membership tiers (Free / Performance / Ultimate) — **not available** in the
  public feed; GFN access is generally not gated per-tier.
- Launch / "play on GeForce NOW" links.
- Badges on search results, category/browse lists, or library pages.
- Non-Steam stores (Epic, Ubisoft, GOG, etc.).
- Maintenance/patching status surfacing (data exists but deferred).

## Scope (in)

- **Pages:** `store.steampowered.com/app/*` and the Steam **wishlist**.
- **Store:** Steam only.
- **Browser:** Firefox (MV3).

## Data source (verified 2026-06-26)

The historical `gfnpc.json` endpoint now returns `null`. The current working feed
is the locale file:

```
https://static.nvidiagrid.net/supported-public-game-list/locales/gfnpc-en-US.json
```

- ~1,550 entries (~400 KB); 1,144 are Steam titles.
- Per-entry fields: `id, title, sortName, isFullyOptimized, steamUrl, store,
  publisher, genres, status`.
- `steamUrl` embeds the Steam app ID, e.g.
  `https://store.steampowered.com/app/1358020` → matching key `1358020`.
- `status` values observed: `AVAILABLE` (1,539), `MAINTENANCE` (10),
  `PATCHING` (1).
- `isFullyOptimized` (boolean) → the "RTX / fully optimized" signal.
- **No membership-tier field exists** — hence tiers are out of scope.

> Implementation note: the endpoint/schema is unofficial and has already changed
> once. Treat the parser/indexer as the single place that knows the feed shape,
> and fail gracefully (see Error handling) if the shape or URL changes.

## Architecture

**Chosen approach: background feed cache.** A non-persistent background script
fetches the feed once, builds an app-ID→entry index, and caches it in
`browser.storage.local` with a TTL (~12–24 h). Content scripts stay tiny and ask
the background for lookups via message passing.

Rejected alternatives:
- *Content script fetches directly* — re-downloads ~400 KB per page, needs the
  NVIDIA host permission in every content script, slower.
- *Bundled static snapshot* — no network but goes stale (~daily changes) and
  bloats the package.

### Components

Each unit is small, single-purpose, and independently testable.

1. **`manifest.json`** — Firefox MV3. Non-persistent background. Host permission
   for `static.nvidiagrid.net`. Content scripts matched to
   `store.steampowered.com/app/*` and the wishlist URL(s). `storage` permission.
2. **Feed service (background)** — fetch + parse + index by Steam app ID; cache
   with TTL; serve lookups over `runtime.onMessage`. Refetches when stale; serves
   stale-but-present cache while refreshing.
3. **App-ID parser** (pure) — extract the Steam app ID from a store URL and from
   wishlist rows. Unit-tested.
4. **Feed indexer** (pure) — turn the raw feed array into a `Map` keyed by app
   ID, carrying `{ supported, rtx }`. Unit-tested.
5. **State resolver** (pure) — given a lookup result, return one of:
   `supported` (+`rtx` flag), `not-supported`, or `unknown` (feed/network
   error). Unit-tested.
6. **Badge renderer** — build the namespaced badge DOM and an injected `<style>`,
   all prefixed `gfn-check-`. Two variants: sidebar badge (store page) and
   compact pill (wishlist). Tested against jsdom.
7. **Store content script** — read app ID from the URL, request a lookup, inject
   the sidebar badge into our own container near the purchase area; a
   `MutationObserver` re-injects if the DOM is rebuilt.
8. **Wishlist content script** — read per-row app IDs, inject a compact pill per
   row; a `MutationObserver` handles lazily-loaded rows.

### Data flow

```
page load
  → content script reads app ID(s)
  → runtime.sendMessage(lookup) to feed service
  → feed service returns cached index entry (refetch if stale)
  → state resolver maps entry → badge state
  → badge renderer injects into our own gfn-check-* node
```

## Badge UI

States and appearance (approved via mockups):

- **Supported + RTX** — green-bordered badge, green dot, "On GeForce NOW", with
  an "RTX" chip. (`isFullyOptimized === true`)
- **Supported** — same green badge without the RTX chip.
- **Not available** — muted grey badge, "Not on GeForce NOW".
- **Couldn't check** — muted badge variant shown only on feed/network error, so a
  failed fetch never reads as a confirmed "not supported".

**Placement:**
- *Store page:* inside the purchase/sidebar column, directly above the buy box.
- *Wishlist:* a compact pill on the right of each row.

## Coexistence (good-citizen)

- All CSS classes and element IDs are prefixed `gfn-check-`.
- We create and own a single wrapper node per injection point; we never query,
  move, or restyle nodes we did not create.
- Defensive selectors + `MutationObserver` so we re-inject if Augmented Steam or
  alike03's subscription-info extension rebuild the DOM after us.
- No active detection of other extensions — purely defensive and namespaced.

## Error handling

- **Feed fetch fails** → serve stale cache if present; otherwise render the
  "Couldn't check" state. Never render "Not on GeForce NOW" from an error.
- **App ID not in feed** → "Not on GeForce NOW" (confirmed absent).
- **App ID unparseable / non-app page** → render nothing.
- **Feed schema/shape unexpected** → indexer returns empty/partial safely; log
  once; badges fall back to "Couldn't check".

## Language, build & testing

- **TypeScript** throughout. The feed entry is modelled as a type once; the
  parser/indexer/state-resolver are checked against it (the feed schema is
  unofficial and has already changed once — types earn their keep here).
- **esbuild** bundles the TS sources into one classic-script file per injection
  point: `background`, `store-content`, `wishlist-content`. (Firefox content
  scripts can't use top-level ES-module `import`, so a bundle step is required
  regardless of language; esbuild is the smallest fast option.)
- **Vitest** for unit tests — ESM/TS-native, near-zero config:
  - **TDD** on the pure modules: app-ID parser, feed indexer, state resolver —
    including malformed-URL and malformed-feed cases.
  - **jsdom environment** for the badge renderer (correct state → correct
    namespaced markup).
- **Manual verification** on real Steam store + wishlist pages, with Augmented
  Steam installed alongside, confirming no overlap and correct re-injection.

## Dev tooling & project conventions

Mirrors the conventions in the maintainer's other repos (urbanist-atlas,
mjrossi-portfolio-website). Philosophy: **patch-pin everything, reproducibility
over convenience.**

- **mise** pins runtimes/tools, using the overlay pattern:
  - `mise.toml` — committed defaults; `node = "22.x"` (patch-pinned) and
    `"aqua:casey/just"` pinned.
  - `mise.development.toml` (`MISE_ENV=development`) — dev overlay (e.g.
    `web-ext` if managed via mise, otherwise via npm).
  - `mise.ci.toml` (`MISE_ENV=ci`) — CI overlay.
  - `mise.local.toml` — gitignored, machine-specific, with a committed
    `mise.local.toml.example`.
- **`.nvmrc`** mirrors the mise node version.
- **`just`** — a `justfile` following the urbanist style: header comment,
  `set shell := ["bash", "-cu"]`, a `[private] default` recipe running
  `just --list --unsorted`, and `[group(...)]`/`[doc(...)]`-annotated recipes.
  Planned recipes: `dev` (web-ext run), `build` (esbuild bundle + manifest copy),
  `lint` (web-ext lint + tsc --noEmit / eslint), `test` (vitest), `fmt`,
  `package` (web-ext build → distributable zip).
- **`web-ext`** (Mozilla official) as a devDependency for run/lint/package.
- **`.editorconfig`** — LF, final newline, trim trailing whitespace; 2-space for
  TS/JS/JSON/YAML/CSS/MD, 4-space for `justfile`.
- **`package.json`** holds the JS-side deps (typescript, esbuild, vitest,
  web-ext, jsdom) and thin scripts that the justfile recipes call.
- **GitHub Actions** CI mirroring the local gates (lint, typecheck, test, build)
  under `MISE_ENV=ci`.

## Open implementation notes

- Confirm the exact Steam wishlist URL pattern(s) and per-row app-ID attribute at
  implementation time.
- Decide TTL precisely (start at 12 h).
- Confirm Firefox MV3 background style (event page vs service worker) for the
  target Firefox version.
