# Pre-release manual test plan

`just check` covers the pure logic. This file covers what it structurally cannot: live
Steam markup, real browser events, the Firefox MV3 permission opt-in, and the
storage-broadcast channel that lets open pages heal themselves. Run this before every
AMO upload; step 0 of the submission checklist in `docs/amo-listing.md` points here.

Times are rough: **§A ~15 min** (mostly a 4-minute wait), **§B ~10 min**, **§C ~5 min**,
**§D ~5 min**.

---

## Don't re-test these

Automated and mutation-checked; re-doing them by hand is wasted time.

- Backoff schedule, in-flight dedupe, definitive-vs-transient retry rules — `tests/store-controller.test.ts`
- Refresh success/failure reporting, including the concurrent-write case — `tests/refresh.test.ts`
- Stale-cache-over-false-negative, `refetched` semantics — `tests/feed-cache.test.ts`
- Concurrent load sharing and serialization — `tests/load-coordinator.test.ts`
- Wishlist row derivation against captured markup — `tests/wishlist-rows.test.ts`
- Badge DOM structure and link degradation — `tests/badge.test.ts`, `tests/gfn-link.test.ts`

What follows is only the part a test can't reach.

---

## Setup

### The two permissions

Keep these straight — they are opposites of what the names suggest, and an earlier version
of this plan had it backwards:

| Toggle | Source | Default | If revoked |
|---|---|---|---|
| `store.steampowered.com` | `content_scripts[].matches` | **on** | Content scripts never inject — **nothing works at all** |
| `games.geforce.com` | `host_permissions` | off | **Nothing.** The catalog fetch clears plain CORS without it |

`games.geforce.com` is insurance against NVIDIA tightening CORS, not a gate. Verified
against the live endpoint: it answers `access-control-allow-origin: *`, allows the
`content-type` header, and the add-on fetches with `credentials: "omit"`. **Badges work on
a clean install with nothing accepted** — so no test below may assume that withholding this
grant disables anything.

The `!` toolbar badge tracks `store.steampowered.com`, i.e. "this add-on cannot function".
It is not a nag about the optional grant.

### Install modes

`just dev` (`web-ext run`) auto-grants `games.geforce.com`; a real install leaves it for the
user. Since that grant no longer gates behaviour, the distinction now only matters for §A.2
and §D, which exercise the grant UI itself.

- **Dev:** `just dev` — fine for §A.1, §B, §C.
- **Real:** `just build`, then `about:debugging#/runtime/this-firefox` → *Load Temporary
  Add-on* → pick `dist/manifest.json`. Use for §A.2 and §D.

To check which grant state you're actually in, open the popup: the **Allow direct catalog
access** button is present only while the optional grant is missing.

### Consoles

- **Background** — the one with `browser` in scope, needed for every helper below:
  1. New tab → `about:debugging`
  2. **This Firefox** in the left sidebar
  3. Find *GeForce NOW check for Steam* (under **Temporary Extensions** if loaded that way)
  4. Click **Inspect** → a separate DevTools window opens
  5. **Console** tab

  Clicking Inspect also wakes the event page if MV3 has suspended it.
- **Content scripts:** the Steam page's own DevTools console (F12). Content-script output
  lands here, not in the background console.
- **Catching install-time logs** (`onInstalled:`) is the awkward case, since you can't attach
  the inspector before the extension exists. Either read it from the background console's
  buffer straight after installing, or — if the background has since restarted and dropped it
  — tick **Enable browser chrome and add-on debugging toolboxes** in `about:debugging` and use
  the Browser Console (Ctrl+Shift+J), which survives extension reloads. `browser` is *not* in
  scope there; it's for reading output, not running helpers.

Everything is prefixed `[gfn-check]`; filter on it. §A.1 needs both consoles open at once.

> **`ReferenceError: browser is not defined`** means you're in the wrong console — `browser`
> exists only in extension contexts, and a content script's isolated world is *not*
> reachable from the page console. Run `location.href` to see where you are: a background
> console reports `moz-extension://…/_generated_background_page.html`. A Steam URL means the
> page console; `chrome://browser/…` means the Browser Console (Ctrl+Shift+J), which doesn't
> expose `browser` either. Go through `about:debugging` → **Inspect**.

### Console helpers

Paste these in the **background** console.

```js
// See everything the extension has stored.
await browser.storage.local.get()
// → gfn-feed-cache, gfn-catalog-epoch, and gfn-debug if you enabled it

// Wipe back to a first-install state.
await browser.storage.local.clear()

// Turn on per-lookup logging (takes effect immediately, no reload).
await browser.storage.local.set({ "gfn-debug": true })
```

**Doctor the catalog** — makes supported games read as unsupported, so you can watch a
*wrong, definitive* answer get corrected. This is the exact state 1.0.0 claims it can fix:

```js
const K = "gfn-feed-cache";
const c = (await browser.storage.local.get(K))[K];
const ids = ["1091500", "570", "292030"];        // Cyberpunk 2077, Dota 2, The Witcher 3
const had = ids.filter((id) => id in c.index);
for (const id of ids) delete c.index[id];
c.fetchedAt = Date.now();                         // keep it "fresh" so nothing auto-refetches
await browser.storage.local.set({ [K]: c });      // NOTE: cache key only — no epoch, so open pages are NOT told
console.log("removed", had, "· index now", Object.keys(c.index).length);
```

Two things about that snippet matter:

1. It writes **only** the cache key. Publishing the epoch is what notifies pages, and
   withholding it is how you set up the "page is showing a stale wrong answer" state.
2. `feed-service.ts` keeps an **in-memory copy** of the cache, so after running it you must
   **Reload** the extension in `about:debugging` for the doctored cache to be read. Open the
   Steam page *after* that reload — reloading orphans the content scripts in tabs that were
   already open.

---

## §A — The claims this release makes

These three are the reason 1.0.0 exists. If any fails, don't ship.

### A.1 · "Refresh catalog" repairs an already-open page

The bug: a wrong *definitive* answer was never re-checked, so the one badge you'd press
Refresh to fix was the one that couldn't heal.

1. Dev or Real mode, permission granted, catalog loaded (popup shows a game count).
2. Run the **doctor the catalog** snippet, then **Reload** the extension.
3. Open <https://store.steampowered.com/app/1091500/>. Banner reads **"Not on GeForce NOW"** —
   wrong, and definitive. Open the page's DevTools console.
4. **Leave the tab where it is.** Click the toolbar icon → **Refresh catalog**.
5. ✅ Within a second or two, and **with no reload**, the banner becomes
   **"Playable on GeForce NOW"**.
6. ✅ The page console shows `[gfn-check] store: new catalog published, re-checking`.

Step 6 is the important one: it's direct evidence that `storage.onChanged` fires in a
content script, which is the assumption the entire healing channel rests on. If the banner
flips but that line is absent, something else fixed it and the channel is not working.

> Note the popup opening does *not* explain this: the state is `not-supported`, which is
> definitive, so the focus-retry path deliberately ignores it. Only the epoch can do this.

**Wishlist half:** with the catalog still doctored, open
<https://store.steampowered.com/wishlist/> (needs those games on your wishlist). Rows show
**"Not available"**. Hit Refresh; ✅ pills flip to **"GeForce NOW"** without a reload, and the
console shows `wishlist: new catalog published, re-checking visible rows`.

### A.2 · A page that gave up retrying revives when you come back (focus path)

The bug: `visibilitychange` was relied on to catch the user returning from the toolbar
popup, and never fires for it — opening a browser-action popup leaves the tab `visible`.
Once the ~3-minute backoff expired, a non-definitive banner was stuck until reload.

Note this no longer involves the permission at all. Withholding the feed grant doesn't
break anything, so the way to produce a stuck banner is to break the *network*:

1. Any mode. `await browser.storage.local.clear()`, then **Reload** the extension.
2. Go offline (Firefox menu → **More tools** → *Work Offline*).
3. Open <https://store.steampowered.com/app/1091500/>. Banner reads
   **"GeForce NOW: couldn't check"**.
4. **Wait 4 minutes.** Non-negotiable — the backoff is `2 + 5 + 15 + 45 + 120 s`, exhausted
   at ~3 min 07 s. Waiting past it is what proves the fix rather than the backoff. Set a timer.
5. Go back online. **Don't touch the page, don't reload, don't switch tabs.**
6. ✅ The banner is still "couldn't check" — confirming it really had given up.
7. Click the toolbar icon to open the popup, then dismiss it by clicking on the page.
8. ✅ The banner resolves within a couple of seconds, no reload.

Step 7 fires `window` `focus` but **not** `visibilitychange`, which is exactly the path that
was broken. Before this release, the banner stayed stuck indefinitely.

### A.3 · A failed refresh says so, and keeps the catalog line

1. Permission granted, catalog cached, popup shows `Catalog: N Steam games · updated …`.
2. Go offline (Firefox menu → **More tools** → *Work Offline*, or drop your network).
3. Popup → **Refresh catalog**.
4. ✅ Reads `Catalog: N Steam games · updated … · refresh failed`. The count and age **survive** —
   that catalog is still what badges are answered from, so replacing it with a bare error
   would be throwing away the useful half.
5. ✅ It does **not** report success.
6. Now `await browser.storage.local.clear()`, reload the extension, still offline, press
   Refresh again. ✅ Reads **"Refresh failed — no catalog cached yet."** — a different
   message, because it's a different bug report.
7. Back online, press Refresh. ✅ Recovers to a normal catalog line.

### A.4 · The same, via a tab switch (visibilitychange path)

Identical setup to §A.2, but return to the page a different way — this covers the event the
popup path can't reach.

1. Repeat §A.2 steps 1–6, so the banner is stuck at "couldn't check" and you're back online.
2. Switch to another tab, then switch back.
3. ✅ The banner resolves without a reload.

### A.5 · The permission model is honest

New this release, and the reason to check it: the feed grant is optional, and the grant that
actually matters is the one nobody thinks about.

**The optional grant is genuinely optional.** On a **Real mode** install with
`games.geforce.com` never accepted:

- [ ] ✅ Badges work anyway — the catalog fetches under plain CORS.
- [ ] ✅ The toolbar icon carries **no** `!`. It is not a nag about this grant.
- [ ] ✅ The popup reads **Enabled**, and offers **Allow direct catalog access** as optional.
- [ ] ✅ Onboarding says the add-on is ready, with the grant framed as optional insurance.
- [ ] Accept the grant. ✅ The button and the optional paragraph disappear rather than
      becoming a permanent "done" marker.

**The grant that does matter.** In `about:addons` → the extension → **Permissions**, turn
off `store.steampowered.com`:

- [ ] ✅ A `!` appears on the toolbar icon.
- [ ] ✅ The popup's status light goes amber and reads **Disabled for Steam**, pointing at
      the Add-ons Manager. It must **not** show a green "Enabled".
- [ ] ✅ Reload a Steam page: no badge at all, as expected — the content scripts aren't injected.
- [ ] Turn it back on and reload. ✅ Badges return, `!` clears.

**Onboarding fires once.** To get a genuine first install, **Remove** the temporary add-on
in `about:debugging` and Load Temporary Add-on again — **Reload** deliberately does not
re-fire it, reporting `"update"` instead. The background logs
`[gfn-check] onInstalled: <reason>` unconditionally, so check that before calling a missing
onboarding tab a bug.

- [ ] ✅ Onboarding opens on a genuine first install, whether or not the feed grant is held.
- [ ] ✅ It does not reopen on reload or update.

---

## §B — Live Steam markup

The repo's own convention: these selectors are the most likely thing to break and the only
things that need `just dev`. `paint()` was restructured this release, so the injection
sequence is new even though the selectors aren't.

### B.1 · Store banner placement

Check the banner lands under the title/header and above the purchase block, on each of:

- [ ] Standard paid game — <https://store.steampowered.com/app/1091500/>
- [ ] Free-to-play — <https://store.steampowered.com/app/570/>
- [ ] A game **not** on GFN, for the neutral state
- [ ] A DLC page
- [ ] An age-gated / mature-content page (the interstitial changes the header)
- [ ] A page with no `.apphub_HeaderStandardTop`, exercising the `#game_area_purchase` fallback

✅ Exactly one banner per page, correctly placed, no layout breakage.

### B.2 · Wishlist rows

- [ ] Scroll a wishlist of 50+ games top to bottom, then back up.
- [ ] ✅ Every row's pill matches **that** row's game — recycling must not smear a pill onto
      the wrong title. This is the single highest-risk behavior in the extension.
- [ ] ✅ No pills injected into Steam chrome (header, footer, nav).
- [ ] ✅ Scrolling stays smooth; no runaway lookups in the console.

### B.3 · Coexistence

- [ ] Install **Augmented Steam**, reload a store page and the wishlist.
- [ ] ✅ Both extensions' UI appear; ours isn't duplicated or displaced when Augmented Steam
      rebuilds the purchase area.
- [ ] ✅ No `gfn-check-*` styles leaking onto Steam's own elements.

---

## §C — Upgrade from 0.4.0

Users upgrading arrive with a v3 cache and **no** epoch key.

1. Install 0.4.0 (`git stash && git checkout v0.4.0 && just build`, load it, then return).
2. Grant permission, load a store page, confirm badges work.
3. Build 1.0.0 and load it over the top.
4. ✅ Badges still work — the v3 cache is current, so no forced refetch.
5. ✅ No console errors about the missing `gfn-catalog-epoch` key.
6. ✅ Pressing **Refresh catalog** publishes the first epoch and heals open pages from then on.

> Expected and fine: between upgrading and the first catalog write (up to 12 h, or one
> Refresh press), no epoch exists, so pages heal via the focus/backoff path only.

Also confirm the removed `gfn-force-refresh` flag is inert: `await
browser.storage.local.set({ "gfn-force-refresh": true })` ✅ changes nothing — no code reads
it any more.

---

## §D — Smoke

- [ ] Popup: status light, Steam-game count, and age all render.
- [ ] Popup's catalog count is labelled **Steam games** — it is the indexed subset (~2000),
      not the raw catalog size the background logs (~2200). Both numbers are correct; see
      the header comment in `src/feed/index-feed.ts` for the full reconciliation.
- [ ] Supported banner's **Play** chip opens the GFN app; **web ↗** opens
      play.geforcenow.com.
- [ ] No unhandled errors in the background console across a full session.
- [ ] No unhandled errors in the page console on either content-script surface.

---

## Sign-off

Ship only with all of §A green — those are the reliability claims that justify unchecking
AMO's *experimental* flag, and a stability claim the code doesn't back is worse than no
claim. A §B failure means a Steam markup change; fix before shipping. §C and §D failures are
judgement calls.

Record the date, the Firefox version, and anything skipped in the release PR.
