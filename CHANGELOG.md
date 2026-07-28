# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-07-28

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
  recovers or the permission is granted.
- Internal: `resolveBannerLinks` splits store-banner link resolution out of DOM building,
  making the stale-cache degradation matrix directly testable.

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
