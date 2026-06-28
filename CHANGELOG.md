# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/mjrossi/geforce-now-steam-check-firefox/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/mjrossi/geforce-now-steam-check-firefox/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/mjrossi/geforce-now-steam-check-firefox/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/mjrossi/geforce-now-steam-check-firefox/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/mjrossi/geforce-now-steam-check-firefox/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/mjrossi/geforce-now-steam-check-firefox/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/mjrossi/geforce-now-steam-check-firefox/releases/tag/v0.1.0
