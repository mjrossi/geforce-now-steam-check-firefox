# AMO submission kit

Everything needed to submit this extension to addons.mozilla.org (AMO). Keep this in
sync when the listing copy or build process changes.

**Listing:** https://addons.mozilla.org/firefox/addon/geforce-now-check-for-steam/ (the
locale-less form redirects to the visitor's locale — prefer it when linking).

**Add-on ID:** `gfn-check@mjrossi` (already registered on AMO). Submit new versions under
the **existing** add-on (Developer Hub → Manage My Submissions → Upload a New Version),
**not** "Submit a New Add-on" — that errors with "Duplicate add-on ID".

**Distribution:** listed channel ("On this site"). Uncheck the **"experimental"** flag
when 1.0.0 goes up — that is what the release is for — and leave it unchecked after.

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
- **Minimum Firefox:** 128 (set via `strict_min_version`). Required by
  `optional_host_permissions`, which backs the popup's one-click "always run on Steam"
  button; 128 is also where the per-site "only when clicked" control shipped.
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
First stable release. This one is about badges being right and staying right, rather than new pages.

- Fixed badges sometimes not appearing at all right after Firefox starts or the add-on updates. They now show "couldn't check" instead of nothing.
- The toolbar popup shows how many games are in the catalog and when it was last updated, with a "Refresh catalog" button for when a badge looks out of date.
- "Refresh catalog" now updates the Steam pages you already have open, instead of only taking effect after a reload.
- A badge that couldn't be checked now fixes itself once it can be, without a reload.
- Wishlist badges keep up better when scrolling long lists.
- Several open Steam tabs no longer each download their own copy of the catalog.
- Badges now work the moment you install — the catalog permission the welcome page used to insist on turns out not to be needed, and is offered as an optional safeguard instead.
- If this add-on is set to run on Steam only when clicked, the toolbar icon and popup now say so — and offer a button to switch it to automatic, instead of leaving you to find the setting.
- Fixed the add-on's icon rendering at the wrong size on the Add-ons Manager page.

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
- Local storage: The fetched catalog is cached in your browser for up to 12 hours so it isn't refetched on every page, alongside the time of the last fetch (used to tell open Steam pages that a newer catalog is available). This never leaves your device and contains only NVIDIA's public catalog data and that timestamp.
- Page access: Content scripts run only on store.steampowered.com store and wishlist pages, where they read the Steam app IDs already on the page to look them up and draw a badge. Nothing else is read or transmitted.

The extension declares no data collection in its manifest. Questions: https://github.com/mjrossi/geforce-now-steam-check-firefox/issues
```

---

## Source code submission (REQUIRED — esbuild bundles + transpiles)

Answer **Yes** to the "code generators / minifiers / bundlers" question. esbuild both
bundles many files into one and transpiles TS→JS, so AMO requires reviewable source.

Generate the source archive (git-ignored files — `mise.local.toml` secrets, `node_modules/`,
`dist/` — are automatically excluded):

```bash
just source
```

It reads the version from `package.json` and archives the **tag** `v<version>`, not `HEAD`:
AMO rejects a source archive that doesn't build the uploaded package, and `just package`
bundles the working tree, so anything but the tag risks two zips that disagree. The recipe
refuses to run if the tag doesn't exist yet, and warns when `HEAD` has moved past it or the
working tree is dirty — heed those warnings rather than uploading.

Upload that zip, and paste the build instructions from the reviewer notes below.

> Tag first, then archive. Regenerate after every version bump.

---

## Notes to reviewer (paste-ready)

**Hard limit: 3000 characters.** The text below is 2982, so there is almost no room —
trim something before adding anything. Keep it ASCII: the field surprised us once by
counting a longer string than the prose looked, and smart quotes/em dashes are the usual
cause. The two sections a reviewer actually acts on are the games.geforce.com note (it
stops them testing against a false premise) and the build instructions (required for the
source submission) — cut elsewhere first.

```
WHAT IT DOES
Adds a badge to Steam store and wishlist pages showing whether each game is
playable on NVIDIA GeForce NOW. Runs only on store.steampowered.com /app/ and
/wishlist/ pages.

PERMISSIONS / DATA
- "storage": caches NVIDIA's public GFN catalog locally (~12h TTL) plus the
  timestamp of the last fetch.
- content scripts on https://store.steampowered.com/app/* and /wishlist/*: read
  the Steam app IDs already on the page in order to draw a badge.
- optional_host_permissions for those same two patterns: declared only so the
  popup can call permissions.request() when the user has set the add-on to "only
  when clicked". Nothing beyond what the content scripts already match.
- host_permissions for https://games.geforce.com/*: the one host contacted, to
  fetch NVIDIA's public catalog (the same one the GFN web app uses). Requested at
  runtime, and NOT required - see below.
No user data, browsing activity or Steam account info is collected or sent. No
analytics, no remote logging.

ABOUT THE games.geforce.com GRANT (please read before testing)
Firefox MV3 does not grant host_permissions at install, so the add-on requests
this one at runtime from its popup and onboarding page. Testing does NOT depend
on accepting it: games.geforce.com/graphql responds with
access-control-allow-origin: * and permits the content-type header, and we fetch
with credentials omitted, so the request satisfies ordinary CORS whether or not
the grant is given. Badges work on a clean install with nothing accepted. The
grant is offered as insurance against NVIDIA tightening that CORS policy, and
the UI presents it as optional.

HOW TO TEST
1. Install. No prompt is needed; accept or ignore the optional grant on the
   onboarding page - badges work either way.
2. Open https://store.steampowered.com/app/1091500/ (Cyberpunk 2077): a green
   "Playable on GeForce NOW" badge appears in the header.
3. Open https://store.steampowered.com/wishlist/: supported games get a green
   pill, unsupported ones "Not available". ("couldn't check" = catalog
   unreachable; reload.)
4. Failure path: go offline and reload a game page. The badge reads "couldn't
   check", never a false "not supported".

BUILDING FROM SOURCE (bundled with esbuild, no minification)
Tooling is pinned via mise (Node 22.22.3) and just:
    mise install     # Node 22.22.3 + just
    just install     # npm ci from package-lock.json
    just build       # node build.mjs -> unpacked extension in dist/
Without mise/just, on Node 22.22.3: npm ci && node build.mjs

build.mjs bundles five entry points (background, store, wishlist, popup,
onboarding) as classic IIFE scripts and copies src/manifest.json, the icon
assets, and the HTML pages into dist/. No minification, no environment
variables, no other post-processing; dist/ matches the uploaded package. The
icon PNGs are committed assets, not build output.

SOURCE
https://github.com/mjrossi/geforce-now-steam-check-firefox
(also attached as a source archive)
```

---

## Submission checklist

0. Run `just check`, then work through `docs/pre-release-testing.md`. Its §A covers the
   things unit tests structurally can't reach (the permission opt-in, real browser events,
   the storage broadcast that heals open pages) — and note `just dev` auto-grants the host
   permission, so the permission flows need a real install to test at all.
1. Bump version in `src/manifest.json` + `package.json`; update `CHANGELOG.md`; commit + tag.
2. `just package` → uploadable zip in `web-ext-artifacts/`.
3. `just source` → source archive, built from the `v<version>` tag.
4. AMO → existing add-on → Upload a New Version → **listed** channel.
5. Upload package zip; answer source-required **Yes**; upload source zip + build instructions.
6. Fill/confirm listing metadata, screenshots, summary, description, release notes.
7. Confirm **experimental** stays **unchecked**; submit for review.
