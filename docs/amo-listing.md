# AMO submission kit

Everything needed to submit this extension to addons.mozilla.org (AMO). Keep this in
sync when the listing copy or build process changes.

**Listing:** https://addons.mozilla.org/firefox/addon/geforce-now-check-for-steam/ (the
locale-less form redirects to the visitor's locale — prefer it when linking).

**Add-on ID:** `gfn-check@mjrossi` (already registered on AMO). Submit new versions under
the **existing** add-on (Developer Hub → Manage My Submissions → Upload a New Version),
**not** "Submit a New Add-on" — that errors with "Duplicate add-on ID".

**Distribution:** listed channel ("On this site"). The **"experimental"** flag was
unchecked as of 1.0.0 — leave it unchecked.

---

## Listing metadata

- **Name:** GeForce NOW check for Steam
- **Categories (pick 2, not 3):** Games & Entertainment (primary) + Shopping. No third —
  nothing else genuinely fits, and padding hurts relevance.
- **Homepage:** https://github.com/mjrossi/geforce-now-steam-check-firefox
- **Support site:** https://github.com/mjrossi/geforce-now-steam-check-firefox/issues
- **Support email:** link00seven@entropyforward.com (note: shown publicly on the listing)
- **License:** MIT
- **Privacy policy:** include it (text below) — optional since data collection is "none",
  but reassuring at no cost.
- **EULA:** none. Unnecessary for a free, MIT-licensed extension; skip it.
- **Applications:** Firefox (desktop) only. Leave **Firefox for Android** unchecked — the
  content scripts target desktop Steam markup and are untested on mobile.

---

## Summary (max 250 chars, plain text)

Primary (189):

> See instantly whether a Steam game streams on GeForce NOW — without leaving the store. A green RTX badge appears on supported titles; a neutral marker on the rest. No tracking, no accounts.

Alternative (208):

> Badges Steam store pages and your wishlist with GeForce NOW availability — a green RTX chip when a game is supported, a neutral marker when it isn't. No data collection. Just quick answers while you browse.

---

## Description (AMO limited markdown: bold, italic, links, lists, blockquote, code — no headings)

```
**GeForce NOW check for Steam** adds a small badge to every Steam game page and wishlist entry, so you can tell at a glance whether a title streams on **NVIDIA GeForce NOW** — without leaving Steam or searching separately.

**What you'll see**

- A green *Playable on GeForce NOW* marker (with an RTX chip on RTX-enabled titles) on supported games
- A neutral *Not available* marker when a game isn't in the catalog
- A *couldn't check* state if the catalog is temporarily unreachable — it **never** shows a false "not supported"

Works on Steam store pages and your Steam wishlist (store.steampowered.com).

**How it works**

The extension caches NVIDIA's public GeForce NOW catalog locally, refreshed every 12 hours. When you open a game page, it looks the game up in the local cache and draws the badge — no extra tabs, no searching.

**Privacy**

> No data collection, no analytics, no accounts. The only network request is to NVIDIA's public catalog at games.geforce.com. Nothing about you, your browsing, or your Steam account is ever sent anywhere.

Open source on [GitHub](https://github.com/mjrossi/geforce-now-steam-check-firefox) (MIT licensed) — bug reports welcome.

*GeForce NOW and RTX are trademarks of NVIDIA Corporation; Steam is a trademark of Valve Corporation. This extension is an independent project not affiliated with or endorsed by NVIDIA or Valve.*
```

---

## Release notes (per-version field)

Keep these a tight user-facing changelog — what changed for *them*, not for the codebase.
The full developer changelog lives in `CHANGELOG.md`.

1.0.0 (first stable release — the experimental flag comes off with this version):

```
First stable release.

- Fixed badges sometimes not appearing at all right after Firefox starts or the add-on updates. They now show "couldn't check" instead of nothing.
- The toolbar popup now shows how many games are in the catalog and when it was last updated, with a "Refresh catalog" button if a badge ever looks out of date.
- Wishlist badges keep up better when scrolling long lists.

Thanks to everyone who tried the beta and filed reports.
```

---

## Screenshots

Upload `docs/screenshots/store-badge.jpg` and `docs/screenshots/wishlist-pill.png` (same
images used in the README). The wishlist shot showing supported *and* "Not available"
side by side is the strongest single image.

Captions:

- `store-badge.jpg`: A "Playable on GeForce NOW" badge appears right in the Steam store
  page header — no searching, no leaving the page.
- `wishlist-pill.png`: Your wishlist at a glance: supported games get a green GeForce NOW
  pill, unsupported ones are clearly marked "Not available."

---

## Privacy policy (paste into the AMO privacy-policy field)

```
GeForce NOW check for Steam does not collect, store, or transmit any personal data. There are no analytics, no tracking, and no accounts.

- Network requests: The extension makes a single kind of outbound request — it fetches NVIDIA's public GeForce NOW game catalog from games.geforce.com. No information about you, your browsing, or your Steam account is sent; the request asks only for the public list of supported games.
- Local storage: The fetched catalog is cached in your browser for up to 12 hours so it isn't refetched on every page. This cache never leaves your device and contains only NVIDIA's public catalog data.
- Page access: Content scripts run only on store.steampowered.com store and wishlist pages, where they read the Steam app IDs already on the page to look them up and draw a badge. Nothing else is read or transmitted.

The extension declares no data collection in its manifest. Questions: https://github.com/mjrossi/geforce-now-steam-check-firefox/issues
```

---

## Source code submission (REQUIRED — esbuild bundles + transpiles)

Answer **Yes** to the "code generators / minifiers / bundlers" question. esbuild both
bundles many files into one and transpiles TS→JS, so AMO requires reviewable source.

Generate the source archive (matches the uploaded package; git-ignored files like
`mise.local.toml` secrets, `node_modules/`, and `dist/` are automatically excluded):

```bash
git archive --format=zip --output=web-ext-artifacts/source-<version>.zip HEAD
```

Upload that zip, and paste the build instructions from the reviewer notes below.

> Regenerate the archive after every version bump so the source matches the package.

---

## Notes to reviewer (paste-ready)

```
WHAT IT DOES
GeForce NOW check for Steam adds a small badge to Steam store and wishlist pages
indicating whether each game is playable on NVIDIA GeForce NOW. It runs only on
store.steampowered.com app and wishlist pages.

PERMISSIONS / DATA
- "storage": caches NVIDIA's GeForce NOW catalog locally (~12h TTL).
- host access to https://games.geforce.com/*: the only network request, used to
  fetch NVIDIA's public GFN catalog (the same catalog the GeForce NOW web app uses).
No user data, browsing activity, or Steam account info is collected or transmitted.
No analytics, no remote logging.

FIRST-RUN PERMISSION GRANT (please read before testing)
On install, the extension opens a short onboarding page asking you to grant access
to games.geforce.com. Please accept it — without that grant the catalog cannot be
fetched and badges will show a neutral "couldn't check" state instead of a
supported / not-supported result.

HOW TO TEST
1. Install and grant the games.geforce.com permission when prompted.
2. Open a supported title, e.g. https://store.steampowered.com/app/1091500/
   (Cyberpunk 2077) — a green "Playable on GeForce NOW" badge appears in the header.
3. Open your Steam wishlist (https://store.steampowered.com/wishlist/) — supported
   games show a green GeForce NOW pill; unsupported ones show "Not available".
   (If the catalog is momentarily unreachable you'll see "couldn't check"; reload.)

BUILDING FROM SOURCE (bundled with esbuild)
Tooling is pinned via mise (Node 22.22.3) and just:
    mise install     # installs Node 22.22.3 + just
    just install     # npm ci (exact deps from package-lock.json)
    just build       # node build.mjs -> writes the unpacked extension to dist/

Without mise/just, the equivalent (Node 22.22.3) is:
    npm ci
    node build.mjs

build.mjs bundles five entry points (background, store, wishlist, popup, onboarding)
as classic IIFE scripts and copies src/manifest.json, icons/, and the HTML pages
into dist/. There is no minification, no environment variables, and no other
post-processing; dist/ matches the uploaded package.

SOURCE
https://github.com/mjrossi/geforce-now-steam-check-firefox
(also attached as a source archive).
```

---

## Submission checklist

1. Bump version in `src/manifest.json` + `package.json`; update `CHANGELOG.md`; commit + tag.
2. `just package` → uploadable zip in `web-ext-artifacts/`.
3. `git archive ... source-<version>.zip HEAD` → source archive.
4. AMO → existing add-on → Upload a New Version → **listed** channel.
5. Upload package zip; answer source-required **Yes**; upload source zip + build instructions.
6. Fill/confirm listing metadata, screenshots, summary, description, release notes.
7. Confirm **experimental** stays **unchecked**; submit for review.
