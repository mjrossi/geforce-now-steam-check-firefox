# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-08-02

First stable release: the AMO listing drops its **experimental** flag. No new page
coverage — this release is about surviving and supporting a wider install base.

- **Badges no longer vanish when the background is slow to start.** Content scripts
  awaited `browser.runtime.sendMessage` with no failure path, so a lookup issued before
  the MV3 background had spun up — during browser startup, or across an extension
  update — rejected and left the page with *no badge at all*. Messaging now degrades to
  the existing "couldn't check" state, which is honest and never a false "not supported".
- **The popup reports on the catalog and can refresh it.** It now shows how many games
  are indexed and how long ago they were fetched, with a *Refresh catalog* button. This
  replaces the `gfn-force-refresh` storage flag, which required typing into the
  background console and so was useless as a support instruction.
- **Faster wishlist repaints.** Scrolling a virtualized wishlist re-asked the background
  about every visible row on each mutation batch — including batches triggered by our own
  pill injection. Lookups are now memoized per tab and only newly seen games are
  requested; transient states stay retryable, so badges self-heal once the network
  recovers.
- **Store banners recover from a slow start.** A game page opened while the add-on's
  background was still waking painted "couldn't check" and kept it until the tab was
  reloaded — it was only ever looked up once. It now retries briefly (2s, then 10s), which
  covers that case; after that the banner stays "couldn't check" until you reload, which is
  deliberate. A badge that says it doesn't know is honest and cheap to fix; the failure worth
  guarding against is a confident *wrong* answer, and that is handled separately — a stale
  catalog is always preferred over reporting "not available".
- **"Refresh catalog" now fixes the page you pressed it on.** It refetched the catalog
  but nothing told the already-open Steam pages, so a badge you pressed it *because of*
  kept its old answer until you reloaded — and a wrong "Not on GeForce NOW", being a
  definitive answer, was never re-checked at all. The background now publishes a
  catalog-changed signal that every open Steam page picks up: store banners re-check and
  wishlist rows are all re-asked. The same signal fires after the 12-hour refresh, so
  pages heal then too.
- **The popup can't be stranded by an unrecognized reply.** `runtime.sendMessage`
  *resolves* with `undefined` when a listener declines a message — what an older
  background does mid-update for a message type it has never heard of — and the popup
  cast the reply instead of checking it, throwing before it could render anything. Replies
  are now validated, and "couldn't reach the background" reads differently from "no
  catalog cached yet".
- **One catalog fetch, not one per tab.** Restoring a session with several Steam tabs
  open woke them all within milliseconds of each other, and on an expired cache each
  independently drove a full paginated catalog fetch. Loads are now shared and
  serialized: a burst collapses onto a single fetch (sharing its failure too, rather
  than retrying it once per tab while offline), and a manual refresh can no longer
  run a second full fetch alongside a lookup-driven one.
- **A failed refresh is reported as failed.** Whether the refresh worked was inferred
  from the cache timestamp moving, which a *different* concurrent fetch could do just as
  well — so a refresh that failed could report success. The load that writes the cache
  now says so directly. A failed refresh also keeps showing the previous catalog's size
  and age instead of replacing it with an error, since that catalog is still what your
  badges are being answered from.
- **The catalog permission is no longer sold as required, because it isn't.** NVIDIA's
  catalog endpoint allows cross-origin reads, so the add-on fetches it perfectly well
  without the `games.geforce.com` grant — badges have always worked on a clean install with
  nothing accepted. The onboarding page, the popup, and the `!` toolbar badge all claimed
  otherwise. The grant is now offered as what it is: optional insurance, in case NVIDIA ever
  changes how the catalog may be read. Onboarding introduces the add-on instead of demanding
  a step, and the offer disappears once taken rather than sitting there as an unfinished
  task.
- **The toolbar badge and popup now report the setting that actually changes behaviour.**
  If you set this add-on's access to Steam to "only when clicked" — in Firefox's Add-ons
  Manager, or from the toolbar icon's own menu — badges stop appearing on their own and show
  up only after you click the icon. Nothing surfaced that before, so the popup showed a green
  "Enabled" light while game pages sat bare. It now reads **Runs when clicked**, explains
  that clicking the icon is what just badged the page behind it, and offers an **Always run
  on Steam pages** button that raises Firefox's own permission prompt — one click, rather
  than directions to a settings page. The `!` badge tracks the same thing instead of nagging
  about the optional catalog grant.
- **Now requires Firefox 128 or later** (was 120). That is what `optional_host_permissions`
  needs, and it's also the release where the per-site "only when clicked" control arrived —
  so the one-click fix exists on every version that can get into the state it fixes.
- **"Couldn't check" no longer blames the permission.** A failed catalog fetch showed
  "click the toolbar icon to enable checks" whenever the optional grant was missing, which
  was usually wrong — the fetch works without it, so the real cause was normally the
  network, and offline users were pointed at a button that could not help them. It now reads
  "couldn't check — the toolbar icon may help": a suggestion, not a diagnosis.
- The popup labels its count **Steam games**, since it counts the indexed subset (~2000)
  rather than NVIDIA's full catalog (~2200). The gap is titles with no Steam version,
  delisted entries, and unreleased placeholders.
- Internal: `resolveBannerLinks` splits store-banner link resolution out of DOM building,
  making the stale-cache degradation matrix directly testable. The refresh success rule,
  the load coordinator, the wishlist memo, the catalog page walk, and the trigger
  coalescing both content scripts share likewise moved into pure modules
  (`feed/refresh.ts`, `feed/load-coordinator.ts`, `content/wishlist-memo.ts`,
  `feed/fetch-catalog.ts`, `shared/coalesce.ts`) with tests. The store page's retry went
  the other way: it shrank from a tested `store-controller.ts` to six lines inlined in
  `store.ts`, and is covered by the manual plan rather than a unit test.

## [0.4.0] — 2026-07-04

- The "Playable on GeForce NOW" banner on store pages is now a link. Clicking it opens
  the game **in the native GeForce NOW app** (via the client's `geforcenow://` route —
  Firefox itself can't stream GFN, so the app is the default), with a one-time Firefox
  "open this application?" confirmation. A muted "web ↗" chip next to the Play chip
  keeps the official play.geforcenow.com deep link for anyone without the app
  installed. Other banner states remain plain, non-clickable text.
- The wishlist pill intentionally stays informational — it overlays each row's capsule,
  which is itself a link to the store page.
- Feed cache schema v3: the index now stores each game's GFN catalog id (web link) and
  cms id (app link). Upgrading triggers a one-time catalog refetch; a stale pre-v3
  cache served during a network outage degrades gracefully (web-only link or
  non-clickable banner — never a wrong answer).

## [0.3.0] — 2026-06-27

- Fix the toolbar / add-on icon rendering: ship the SVG icon directly instead of
  rasterized PNGs. The earlier PNGs were generated as document-style thumbnails (the
  icon shrunk into a corner on a transparent canvas), so the installed add-on showed a
  tiny icon in a white box. The icon now scales crisply at every size.

## [0.2.1] — 2026-06-27

- Open-sourced under the MIT license; added a privacy policy, changelog, and a
  public-facing README with screenshots.
- Replace the placeholder icon with a designed cloud + check mark (SVG plus
  PNGs at 16/32/48/96/128).

## [0.2.0] — 2026-06-27

- Overlay the GeForce NOW pill directly on the wishlist capsule image so it reads as
  part of each row.

## [0.1.2] — 2026-06-27

- Fix the GeForce NOW catalog fetch being blocked on signed/installed builds.
- Add a runtime host-permission grant flow so the extension can request access to the
  catalog API after install.

## [0.1.1] — 2026-06-27

- Migrate the data source to NVIDIA's GeForce NOW catalog GraphQL API
  (`games.geforce.com/graphql`); the legacy static `gfnpc-*.json` feed returned false
  negatives.
- Fix wishlist rendering on the modern virtualized (recycled-row) wishlist.
- Harden Steam app-id matching and redesign the store badge.

## [0.1.0] — 2026-06-27

- Initial release: badge Steam store and wishlist pages with GeForce NOW availability.
- Background service caches the catalog (12 h TTL) and indexes it by Steam app id;
  content scripts inject namespaced `gfn-check-*` badges.

[Unreleased]: https://github.com/mjrossi/geforce-now-steam-check-firefox/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mjrossi/geforce-now-steam-check-firefox/compare/v0.4.0...v1.0.0
[0.4.0]: https://github.com/mjrossi/geforce-now-steam-check-firefox/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/mjrossi/geforce-now-steam-check-firefox/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/mjrossi/geforce-now-steam-check-firefox/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/mjrossi/geforce-now-steam-check-firefox/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/mjrossi/geforce-now-steam-check-firefox/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/mjrossi/geforce-now-steam-check-firefox/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/mjrossi/geforce-now-steam-check-firefox/releases/tag/v0.1.0
