# GeForce NOW Steam Badge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Firefox MV3 extension that badges Steam store and wishlist pages with NVIDIA GeForce NOW availability (supported / RTX-optimized / not-available / couldn't-check).

**Architecture:** A background script fetches NVIDIA's public supported-games feed, indexes it by Steam app id, and caches it in `storage.local` (12 h TTL). Tiny content scripts on store and wishlist pages read app ids, ask the background for a lookup, and inject namespaced (`gfn-check-*`) badges they fully own — coexisting defensively with Augmented Steam and alike03's subscription extension via a MutationObserver.

**Tech Stack:** TypeScript, esbuild (bundling), Vitest + jsdom (tests), web-ext (run/lint/package), mise + just (tooling). Node 22.

**Spec:** `docs/superpowers/specs/2026-06-26-geforce-now-steam-badge-design.md`

---

## File Structure

```
mise.toml, mise.development.toml, mise.ci.toml, mise.local.toml.example   # tool pinning
.nvmrc .editorconfig .gitignore justfile                                  # repo conventions
package.json tsconfig.json vitest.config.ts build.mjs                     # JS toolchain + bundler
.github/workflows/ci.yml                                                  # CI
icons/icon.svg                                                            # extension icon
src/
  manifest.json                 # MV3 manifest (copied to dist verbatim)
  feed/
    types.ts                    # GfnFeedEntry, GfnIndex
    parse-app-id.ts             # parseAppId, parseAppIdFromElement (pure)
    index-feed.ts               # buildIndex (pure)
    resolve-state.ts            # resolveState, BadgeState (pure)
    feed-cache.ts               # loadIndex with injected deps (pure-ish, testable)
  shared/
    messages.ts                 # LookupRequest, LookupResponse
    debounce.ts                 # debounce (pure)
  badge/
    badge.css.ts                # BADGE_CSS namespaced stylesheet string
    badge.ts                    # ensureStyles, renderSidebarBadge, renderWishlistPill, placeBefore
  background/
    feed-service.ts             # background entry: browser.storage + fetch + onMessage glue
  content/
    store.ts                    # store page content-script entry (glue)
    wishlist.ts                 # wishlist content-script entry (glue)
tests/
  parse-app-id.test.ts  index-feed.test.ts  resolve-state.test.ts
  feed-cache.test.ts    debounce.test.ts    badge.test.ts   (jsdom)
dist/  web-ext-artifacts/        # build output (gitignored)
```

Pure logic (`feed/`, `shared/`, `badge/`) is TDD'd with Vitest. The browser-API glue (`background/feed-service.ts`, `content/*.ts`) is thin and verified manually in Firefox (Task 12).

---

## Task 1: Repo conventions (mise, editorconfig, nvmrc, gitignore)

**Files:**
- Create: `mise.toml`, `mise.development.toml`, `mise.ci.toml`, `mise.local.toml.example`
- Create: `.nvmrc`, `.editorconfig`
- Modify: `.gitignore`

- [ ] **Step 1: Create `mise.toml`**

```toml
# Pin runtimes/tooling. Install mise (https://mise.jdx.dev), then `mise install`.
# Overlays: mise.development.toml (MISE_ENV=development), mise.ci.toml
# (MISE_ENV=ci), mise.local.toml (gitignored, see .example).
[tools]
node = "22.22.3"           # patch-pinned: reproducibility > convenience
"aqua:casey/just" = "1.51.0"
```

- [ ] **Step 2: Create `mise.development.toml`**

```toml
# Local dev overlay (MISE_ENV=development). web-ext is an npm devDependency,
# so nothing extra is pinned here yet — kept for parity with other repos.
[tools]
```

- [ ] **Step 3: Create `mise.ci.toml`**

```toml
# CI overlay (MISE_ENV=ci, set in .github/workflows/ci.yml).
[tools]
```

- [ ] **Step 4: Create `mise.local.toml.example`**

```toml
# Copy to mise.local.toml (gitignored) for machine-specific overrides.
# [tools]
# node = "22.22.3"
```

- [ ] **Step 5: Create `.nvmrc`**

```
22.22.3
```

- [ ] **Step 6: Create `.editorconfig`**

```ini
# https://editorconfig.org
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{ts,js,mjs,json,jsonc,yaml,yml,css,html,md}]
indent_style = space
indent_size = 2

# justfile recipes use 4-space indentation (avoids the Makefile tab gotcha).
[justfile]
indent_style = space
indent_size = 4
```

- [ ] **Step 7: Update `.gitignore`** (append build + local files)

Append these lines to the existing `.gitignore`:

```
dist/
web-ext-artifacts/
mise.local.toml
*.log
```

- [ ] **Step 8: Commit**

```bash
git add mise.toml mise.development.toml mise.ci.toml mise.local.toml.example .nvmrc .editorconfig .gitignore
git commit -m "chore: add mise/editorconfig/nvmrc repo conventions"
```

---

## Task 2: JS toolchain (package.json, tsconfig, vitest) + sanity test

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `tests/sanity.test.ts` (temporary, deleted at end of task)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "gfn-check-steam",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node build.mjs",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/firefox-webext-browser": "^120.0.0",
    "@types/node": "^22.0.0",
    "esbuild": "^0.24.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "web-ext": "^8.3.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["firefox-webext-browser", "node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests", "build.mjs", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

// Node environment by default. DOM-dependent test files opt in per-file with
// a `// @vitest-environment jsdom` docblock comment (see tests/badge.test.ts).
export default defineConfig({
  test: { environment: "node" },
});
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: creates `node_modules/` and `package-lock.json`, no errors.

- [ ] **Step 5: Create a sanity test `tests/sanity.test.ts`**

```ts
import { expect, test } from "vitest";

test("vitest runs", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 6: Run the sanity test**

Run: `npx vitest run`
Expected: PASS, 1 test passed.

- [ ] **Step 7: Delete the sanity test**

```bash
rm tests/sanity.test.ts
```

- [ ] **Step 8: Commit** (commit the lockfile — it is the reproducibility source of truth)

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts
git commit -m "chore: add TypeScript + Vitest toolchain"
```

---

## Task 3: Build script + justfile + CI

**Files:**
- Create: `build.mjs`, `justfile`, `.github/workflows/ci.yml`

- [ ] **Step 1: Create `build.mjs`**

```js
import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const outdir = "dist";
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await esbuild.build({
  entryPoints: {
    background: "src/background/feed-service.ts",
    store: "src/content/store.ts",
    wishlist: "src/content/wishlist.ts",
  },
  outdir,
  bundle: true,
  format: "iife",          // content/background scripts run as classic scripts
  target: "firefox115",
  logLevel: "info",
});

await cp("src/manifest.json", `${outdir}/manifest.json`);
await cp("icons", `${outdir}/icons`, { recursive: true });
console.log("built ->", outdir);
```

Note: `build.mjs` will fail until the entry files and `icons/` exist (Tasks 8–12). That is expected; we exercise it in Task 12.

- [ ] **Step 2: Create `justfile`**

```just
# gfn-check-steam — common dev commands. Run `just` to list recipes.
# node + just are pinned in mise.toml (`mise install`); JS deps via `npm ci`.

set shell := ["bash", "-cu"]

# ── default ──────────────────────────────────────────
[private]
default:
    @just --list --unsorted

# install JS dependencies from the lockfile
[group('setup')]
install:
    npm ci

# ── verify ───────────────────────────────────────────
# typecheck only (no emit)
[group('verify')]
typecheck:
    npx tsc --noEmit

# run unit tests once
[group('verify')]
test:
    npx vitest run

# watch tests
[group('verify')]
test-watch:
    npx vitest

# bundle then run web-ext's static analyzer over dist/
[group('verify')]
lint: build
    npx web-ext lint --source-dir dist

# full local gate (matches CI): typecheck + test + lint
[group('verify')]
check: typecheck test lint

# ── build & run ──────────────────────────────────────
# bundle the extension into dist/
[group('build')]
build:
    node build.mjs

# launch Firefox with the extension loaded
[group('build')]
dev: build
    npx web-ext run --source-dir dist --keep-profile-changes

# package a distributable zip into web-ext-artifacts/
[group('build')]
package: build
    npx web-ext build --source-dir dist --artifacts-dir web-ext-artifacts --overwrite-dest
```

- [ ] **Step 3: Create `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      MISE_ENV: ci
    steps:
      - uses: actions/checkout@v4
      - uses: jdx/mise-action@v2
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx vitest run
      - run: node build.mjs
      - run: npx web-ext lint --source-dir dist
```

- [ ] **Step 4: Verify just lists recipes**

Run: `just`
Expected: prints the recipe list grouped by `setup`/`verify`/`build` (requires `mise install` to have provisioned `just`; otherwise install just via mise first).

- [ ] **Step 5: Commit**

```bash
git add build.mjs justfile .github/workflows/ci.yml
git commit -m "chore: add esbuild build, justfile, and CI workflow"
```

---

## Task 4: Feed types, messages, and app-id parser (TDD)

**Files:**
- Create: `src/feed/types.ts`, `src/shared/messages.ts`, `src/feed/parse-app-id.ts`
- Test: `tests/parse-app-id.test.ts`

- [ ] **Step 1: Create `src/feed/types.ts`**

```ts
/** One entry of NVIDIA's public GFN supported-games feed
 *  (https://static.nvidiagrid.net/supported-public-game-list/locales/gfnpc-en-US.json). */
export interface GfnFeedEntry {
  id: number;
  title: string;
  sortName: string;
  isFullyOptimized: boolean;
  steamUrl: string;
  store: string;
  publisher: string;
  genres: string[];
  status: string;
}

/** Lookup index keyed by Steam app id (string). Only GFN-supported Steam games
 *  appear. Record form serializes cleanly into browser.storage.local. */
export type GfnIndex = Record<string, { rtx: boolean }>;
```

- [ ] **Step 2: Create `src/shared/messages.ts`**

```ts
/** Content script → background: look up these Steam app ids. */
export interface LookupRequest {
  type: "gfn-lookup";
  appIds: number[];
}

/** Background → content script. `ok:false` means the feed could not be loaded
 *  (render "unknown", never a false "not supported"). `found` carries only
 *  supported app ids, keyed by app-id string. */
export interface LookupResponse {
  ok: boolean;
  found: Record<string, { rtx: boolean }>;
}
```

- [ ] **Step 3: Write the failing test `tests/parse-app-id.test.ts`**

```ts
import { JSDOM } from "jsdom";
import { describe, expect, test } from "vitest";
import { parseAppId, parseAppIdFromElement } from "../src/feed/parse-app-id";

describe("parseAppId", () => {
  test("extracts id from a canonical store URL", () => {
    expect(parseAppId("https://store.steampowered.com/app/1358020")).toBe(1358020);
  });
  test("extracts id when a slug follows", () => {
    expect(parseAppId("https://store.steampowered.com/app/620/Portal_2/")).toBe(620);
  });
  test("returns null for a non-app URL", () => {
    expect(parseAppId("https://store.steampowered.com/wishlist/id/foo")).toBeNull();
  });
  test("returns null for empty input", () => {
    expect(parseAppId("")).toBeNull();
  });
});

describe("parseAppIdFromElement", () => {
  test("reads the id from a child /app/ anchor", () => {
    const { document } = new JSDOM(
      `<div class="row"><a href="/app/620/Portal_2/">Portal 2</a></div>`,
    ).window;
    const row = document.querySelector(".row")!;
    expect(parseAppIdFromElement(row)).toBe(620);
  });
  test("returns null when there is no app anchor", () => {
    const { document } = new JSDOM(`<div class="row"><span>no link</span></div>`).window;
    const row = document.querySelector(".row")!;
    expect(parseAppIdFromElement(row)).toBeNull();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/parse-app-id.test.ts`
Expected: FAIL — cannot find module `../src/feed/parse-app-id`.

- [ ] **Step 5: Create `src/feed/parse-app-id.ts`**

```ts
/** Extract the Steam app id from any URL/href containing `/app/<id>`.
 *  Returns null when there is no app segment. */
export function parseAppId(url: string): number | null {
  const match = /\/app\/(\d+)/.exec(url);
  return match ? Number(match[1]) : null;
}

/** Find the Steam app id for a row element via its first `/app/<id>` anchor.
 *  Robust to markup changes — relies on the stable app-link href, not a
 *  specific class/attribute. */
export function parseAppIdFromElement(el: Element): number | null {
  const anchor = el.querySelector<HTMLAnchorElement>('a[href*="/app/"]');
  return anchor ? parseAppId(anchor.getAttribute("href") ?? "") : null;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/parse-app-id.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 7: Commit**

```bash
git add src/feed/types.ts src/shared/messages.ts src/feed/parse-app-id.ts tests/parse-app-id.test.ts
git commit -m "feat: add feed types, message types, and app-id parser"
```

---

## Task 5: Feed indexer (TDD)

**Files:**
- Create: `src/feed/index-feed.ts`
- Test: `tests/index-feed.test.ts`

- [ ] **Step 1: Write the failing test `tests/index-feed.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { buildIndex } from "../src/feed/index-feed";
import type { GfnFeedEntry } from "../src/feed/types";

function entry(over: Partial<GfnFeedEntry>): GfnFeedEntry {
  return {
    id: 1, title: "T", sortName: "t", isFullyOptimized: false,
    steamUrl: "https://store.steampowered.com/app/100", store: "Steam",
    publisher: "P", genres: [], status: "AVAILABLE", ...over,
  };
}

describe("buildIndex", () => {
  test("indexes a Steam entry by app id with its rtx flag", () => {
    const idx = buildIndex([
      entry({ steamUrl: "https://store.steampowered.com/app/620", isFullyOptimized: true }),
    ]);
    expect(idx["620"]).toEqual({ rtx: true });
  });
  test("rtx defaults to false when not fully optimized", () => {
    const idx = buildIndex([entry({ steamUrl: "https://store.steampowered.com/app/10" })]);
    expect(idx["10"]).toEqual({ rtx: false });
  });
  test("skips non-Steam stores", () => {
    const idx = buildIndex([entry({ store: "Epic", steamUrl: "https://epicgames.com/x" })]);
    expect(Object.keys(idx)).toHaveLength(0);
  });
  test("skips entries whose steamUrl has no app id", () => {
    const idx = buildIndex([entry({ steamUrl: "https://store.steampowered.com/" })]);
    expect(Object.keys(idx)).toHaveLength(0);
  });
  test("indexes multiple entries", () => {
    const idx = buildIndex([
      entry({ steamUrl: "https://store.steampowered.com/app/1" }),
      entry({ steamUrl: "https://store.steampowered.com/app/2", isFullyOptimized: true }),
    ]);
    expect(idx).toEqual({ "1": { rtx: false }, "2": { rtx: true } });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/index-feed.test.ts`
Expected: FAIL — cannot find module `../src/feed/index-feed`.

- [ ] **Step 3: Create `src/feed/index-feed.ts`**

```ts
import type { GfnFeedEntry, GfnIndex } from "./types";
import { parseAppId } from "./parse-app-id";

/** Build a lookup index from the raw GFN feed. Only Steam entries with a
 *  parseable app id are kept; the value records the RTX (fully-optimized) flag.
 *  Maintenance/patching titles stay indexed — they are still supported. */
export function buildIndex(feed: GfnFeedEntry[]): GfnIndex {
  const index: GfnIndex = {};
  for (const entry of feed) {
    if (entry.store !== "Steam") continue;
    const appId = parseAppId(entry.steamUrl);
    if (appId === null) continue;
    index[String(appId)] = { rtx: entry.isFullyOptimized === true };
  }
  return index;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/index-feed.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/feed/index-feed.ts tests/index-feed.test.ts
git commit -m "feat: add GFN feed indexer"
```

---

## Task 6: State resolver (TDD)

**Files:**
- Create: `src/feed/resolve-state.ts`
- Test: `tests/resolve-state.test.ts`

- [ ] **Step 1: Write the failing test `tests/resolve-state.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { resolveState } from "../src/feed/resolve-state";
import type { LookupResponse } from "../src/shared/messages";

describe("resolveState", () => {
  test("feed error → unknown", () => {
    const res: LookupResponse = { ok: false, found: {} };
    expect(resolveState(620, res)).toEqual({ kind: "unknown" });
  });
  test("present in found → supported with rtx flag", () => {
    const res: LookupResponse = { ok: true, found: { "620": { rtx: true } } };
    expect(resolveState(620, res)).toEqual({ kind: "supported", rtx: true });
  });
  test("present without rtx → supported rtx:false", () => {
    const res: LookupResponse = { ok: true, found: { "10": { rtx: false } } };
    expect(resolveState(10, res)).toEqual({ kind: "supported", rtx: false });
  });
  test("absent but feed ok → not-supported", () => {
    const res: LookupResponse = { ok: true, found: {} };
    expect(resolveState(999, res)).toEqual({ kind: "not-supported" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/resolve-state.test.ts`
Expected: FAIL — cannot find module `../src/feed/resolve-state`.

- [ ] **Step 3: Create `src/feed/resolve-state.ts`**

```ts
import type { LookupResponse } from "../shared/messages";

export type BadgeState =
  | { kind: "supported"; rtx: boolean }
  | { kind: "not-supported" }
  | { kind: "unknown" };

/** Map a background lookup response for a single app id into a badge state.
 *  Feed unavailable → "unknown" (never a false negative); present → "supported"
 *  (+rtx); absent with a good feed → "not-supported". */
export function resolveState(appId: number, response: LookupResponse): BadgeState {
  if (!response.ok) return { kind: "unknown" };
  const hit = response.found[String(appId)];
  if (hit) return { kind: "supported", rtx: hit.rtx };
  return { kind: "not-supported" };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/resolve-state.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/feed/resolve-state.ts tests/resolve-state.test.ts
git commit -m "feat: add badge state resolver"
```

---

## Task 7: Feed cache loader (TDD with injected deps)

**Files:**
- Create: `src/feed/feed-cache.ts`
- Test: `tests/feed-cache.test.ts`

- [ ] **Step 1: Write the failing test `tests/feed-cache.test.ts`**

```ts
import { describe, expect, test, vi } from "vitest";
import { loadIndex, type FeedCache, type LoadDeps } from "../src/feed/feed-cache";
import type { GfnFeedEntry } from "../src/feed/types";

const steamEntry: GfnFeedEntry = {
  id: 1, title: "T", sortName: "t", isFullyOptimized: true,
  steamUrl: "https://store.steampowered.com/app/620", store: "Steam",
  publisher: "P", genres: [], status: "AVAILABLE",
};

function deps(over: Partial<LoadDeps>): LoadDeps {
  return {
    getCache: async () => null,
    setCache: async () => {},
    fetchFeed: async () => [steamEntry],
    now: () => 1_000_000,
    ttlMs: 1000,
    ...over,
  };
}

describe("loadIndex", () => {
  test("fresh cache is returned without fetching", async () => {
    const cache: FeedCache = { fetchedAt: 999_500, index: { "620": { rtx: true } } };
    const fetchFeed = vi.fn();
    const result = await loadIndex(deps({ getCache: async () => cache, fetchFeed, now: () => 1_000_000 }));
    expect(result).toEqual({ ok: true, index: { "620": { rtx: true } } });
    expect(fetchFeed).not.toHaveBeenCalled();
  });

  test("missing cache → fetches, builds, stores, returns index", async () => {
    const setCache = vi.fn(async () => {});
    const result = await loadIndex(deps({ getCache: async () => null, setCache }));
    expect(result).toEqual({ ok: true, index: { "620": { rtx: true } } });
    expect(setCache).toHaveBeenCalledWith({ fetchedAt: 1_000_000, index: { "620": { rtx: true } } });
  });

  test("stale cache → refetches", async () => {
    const stale: FeedCache = { fetchedAt: 0, index: { "1": { rtx: false } } };
    const fetchFeed = vi.fn(async () => [steamEntry]);
    const result = await loadIndex(deps({ getCache: async () => stale, fetchFeed }));
    expect(fetchFeed).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, index: { "620": { rtx: true } } });
  });

  test("fetch fails with stale cache present → serve stale, ok:true", async () => {
    const stale: FeedCache = { fetchedAt: 0, index: { "1": { rtx: false } } };
    const result = await loadIndex(deps({
      getCache: async () => stale,
      fetchFeed: async () => { throw new Error("network"); },
    }));
    expect(result).toEqual({ ok: true, index: { "1": { rtx: false } } });
  });

  test("fetch fails with no cache → ok:false", async () => {
    const result = await loadIndex(deps({
      getCache: async () => null,
      fetchFeed: async () => { throw new Error("network"); },
    }));
    expect(result).toEqual({ ok: false, index: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/feed-cache.test.ts`
Expected: FAIL — cannot find module `../src/feed/feed-cache`.

- [ ] **Step 3: Create `src/feed/feed-cache.ts`**

```ts
import type { GfnFeedEntry, GfnIndex } from "./types";
import { buildIndex } from "./index-feed";

export interface FeedCache {
  fetchedAt: number;
  index: GfnIndex;
}

export interface LoadDeps {
  getCache: () => Promise<FeedCache | null>;
  setCache: (cache: FeedCache) => Promise<void>;
  fetchFeed: () => Promise<GfnFeedEntry[]>;
  now: () => number;
  ttlMs: number;
}

export type LoadResult =
  | { ok: true; index: GfnIndex }
  | { ok: false; index: null };

/** Return a usable GFN index, refreshing from the network when the cache is
 *  missing or older than ttlMs. On fetch failure, fall back to stale cache if
 *  present; otherwise report failure so callers render "unknown", never a false
 *  "not supported". */
export async function loadIndex(deps: LoadDeps): Promise<LoadResult> {
  const cache = await deps.getCache();
  const fresh = cache !== null && deps.now() - cache.fetchedAt < deps.ttlMs;
  if (fresh) return { ok: true, index: cache.index };

  try {
    const feed = await deps.fetchFeed();
    const index = buildIndex(feed);
    await deps.setCache({ fetchedAt: deps.now(), index });
    return { ok: true, index };
  } catch {
    if (cache !== null) return { ok: true, index: cache.index };
    return { ok: false, index: null };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/feed-cache.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/feed/feed-cache.ts tests/feed-cache.test.ts
git commit -m "feat: add feed cache loader with stale-fallback"
```

---

## Task 8: Background feed service (glue)

**Files:**
- Create: `src/background/feed-service.ts`

No unit test — this is thin browser-API glue over the tested `loadIndex`. Verified manually in Task 12. The typecheck in Task 12 confirms it compiles against the `browser` types.

- [ ] **Step 1: Create `src/background/feed-service.ts`**

```ts
import type { GfnFeedEntry } from "../feed/types";
import type { LookupRequest, LookupResponse } from "../shared/messages";
import { loadIndex, type FeedCache, type LoadDeps } from "../feed/feed-cache";

const FEED_URL =
  "https://static.nvidiagrid.net/supported-public-game-list/locales/gfnpc-en-US.json";
const CACHE_KEY = "gfn-feed-cache";
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const deps: LoadDeps = {
  async getCache() {
    const stored = await browser.storage.local.get(CACHE_KEY);
    return (stored[CACHE_KEY] as FeedCache | undefined) ?? null;
  },
  async setCache(cache) {
    await browser.storage.local.set({ [CACHE_KEY]: cache });
  },
  async fetchFeed() {
    const res = await fetch(FEED_URL, { credentials: "omit" });
    if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error("feed is not an array");
    return data as GfnFeedEntry[];
  },
  now: () => Date.now(),
  ttlMs: TTL_MS,
};

/** Handle a lookup request: ensure the index is loaded, then return the subset
 *  of requested app ids that are supported. */
async function handleLookup(req: LookupRequest): Promise<LookupResponse> {
  const result = await loadIndex(deps);
  if (!result.ok) return { ok: false, found: {} };
  const found: Record<string, { rtx: boolean }> = {};
  for (const appId of req.appIds) {
    const hit = result.index[String(appId)];
    if (hit) found[String(appId)] = hit;
  }
  return { ok: true, found };
}

browser.runtime.onMessage.addListener((message: unknown): Promise<LookupResponse> | undefined => {
  const req = message as Partial<LookupRequest>;
  if (req?.type !== "gfn-lookup" || !Array.isArray(req.appIds)) return undefined;
  return handleLookup(req as LookupRequest);
});
```

- [ ] **Step 2: Commit**

```bash
git add src/background/feed-service.ts
git commit -m "feat: add background feed service"
```

---

## Task 9: Badge renderer + CSS (TDD, jsdom)

**Files:**
- Create: `src/badge/badge.css.ts`, `src/badge/badge.ts`
- Test: `tests/badge.test.ts` (jsdom environment)

- [ ] **Step 1: Create `src/badge/badge.css.ts`**

```ts
/** Namespaced stylesheet for all injected badges. Every selector is prefixed
 *  `gfn-check-` so we never touch markup owned by Steam or other extensions. */
export const BADGE_CSS = `
.gfn-check-badge { display:inline-flex; align-items:center; gap:7px; padding:6px 10px;
  border-radius:4px; font-size:12px; font-family:Arial,Helvetica,sans-serif;
  box-sizing:border-box; }
.gfn-check-badge--ok { background:#0c1a05; border:1px solid #76b900; color:#fff; }
.gfn-check-badge--no, .gfn-check-badge--unknown { background:#171a1d;
  border:1px solid #3a444d; color:#8f98a0; }
.gfn-check-dot { width:8px; height:8px; border-radius:50%; flex:0 0 auto; }
.gfn-check-badge--ok .gfn-check-dot { background:#76b900; }
.gfn-check-badge--no .gfn-check-dot, .gfn-check-badge--unknown .gfn-check-dot { background:#5a6b7c; }
.gfn-check-label { font-weight:bold; }
.gfn-check-badge--ok .gfn-check-label { color:#76b900; }
.gfn-check-rtx { margin-left:auto; background:#76b900; color:#000; font-size:9px;
  font-weight:bold; padding:1px 6px; border-radius:8px; letter-spacing:.5px; }
.gfn-check-pill { display:inline-flex; align-items:center; gap:5px; font-size:11px;
  padding:3px 8px; border-radius:10px; white-space:nowrap;
  font-family:Arial,Helvetica,sans-serif; }
.gfn-check-pill--ok { background:#0c1a05; border:1px solid #76b900; color:#76b900; }
.gfn-check-pill--no, .gfn-check-pill--unknown { background:#171a1d;
  border:1px solid #3a444d; color:#8f98a0; }
.gfn-check-pill .gfn-check-dot { width:6px; height:6px; }
.gfn-check-pill--ok .gfn-check-dot { background:#76b900; }
`;
```

- [ ] **Step 2: Write the failing test `tests/badge.test.ts`**

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import {
  ensureStyles,
  placeBefore,
  renderSidebarBadge,
  renderWishlistPill,
} from "../src/badge/badge";

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("renderSidebarBadge", () => {
  test("supported + rtx", () => {
    const el = renderSidebarBadge(document, { kind: "supported", rtx: true });
    expect(el.className).toContain("gfn-check-badge--ok");
    expect(el.querySelector(".gfn-check-label")!.textContent).toBe("On GeForce NOW");
    expect(el.querySelector(".gfn-check-rtx")).not.toBeNull();
  });
  test("supported without rtx omits the RTX chip", () => {
    const el = renderSidebarBadge(document, { kind: "supported", rtx: false });
    expect(el.querySelector(".gfn-check-rtx")).toBeNull();
  });
  test("not-supported", () => {
    const el = renderSidebarBadge(document, { kind: "not-supported" });
    expect(el.className).toContain("gfn-check-badge--no");
    expect(el.querySelector(".gfn-check-label")!.textContent).toBe("Not on GeForce NOW");
  });
  test("unknown", () => {
    const el = renderSidebarBadge(document, { kind: "unknown" });
    expect(el.className).toContain("gfn-check-badge--unknown");
    expect(el.querySelector(".gfn-check-label")!.textContent).toBe("GeForce NOW: couldn't check");
  });
});

describe("renderWishlistPill", () => {
  test("supported + rtx appends the RTX suffix", () => {
    const el = renderWishlistPill(document, { kind: "supported", rtx: true });
    expect(el.className).toContain("gfn-check-pill--ok");
    expect(el.textContent).toContain("GeForce NOW · RTX");
  });
  test("not-supported", () => {
    const el = renderWishlistPill(document, { kind: "not-supported" });
    expect(el.textContent).toContain("Not available");
  });
});

describe("ensureStyles", () => {
  test("injects the stylesheet exactly once", () => {
    ensureStyles(document);
    ensureStyles(document);
    expect(document.querySelectorAll("#gfn-check-style")).toHaveLength(1);
  });
});

describe("placeBefore", () => {
  test("inserts before the anchor and is idempotent by id", () => {
    document.body.innerHTML = `<div id="game_area_purchase">buy</div>`;
    const make = () => {
      const b = renderSidebarBadge(document, { kind: "not-supported" });
      b.id = "gfn-check-store-slot";
      return b;
    };
    expect(placeBefore(document, "#game_area_purchase", make())).toBe(true);
    placeBefore(document, "#game_area_purchase", make());
    expect(document.querySelectorAll("#gfn-check-store-slot")).toHaveLength(1);
    const anchor = document.getElementById("game_area_purchase")!;
    expect(anchor.previousElementSibling!.id).toBe("gfn-check-store-slot");
  });
  test("falls back to body when the anchor is missing", () => {
    const b = renderSidebarBadge(document, { kind: "unknown" });
    b.id = "gfn-check-store-slot";
    expect(placeBefore(document, "#nope", b)).toBe(false);
    expect(document.getElementById("gfn-check-store-slot")).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/badge.test.ts`
Expected: FAIL — cannot find module `../src/badge/badge`.

- [ ] **Step 4: Create `src/badge/badge.ts`**

```ts
import type { BadgeState } from "../feed/resolve-state";
import { BADGE_CSS } from "./badge.css";

const STYLE_ID = "gfn-check-style";

/** Inject the shared badge stylesheet once per document. */
export function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = BADGE_CSS;
  (doc.head ?? doc.documentElement).appendChild(style);
}

function modifier(state: BadgeState): "ok" | "no" | "unknown" {
  if (state.kind === "supported") return "ok";
  if (state.kind === "not-supported") return "no";
  return "unknown";
}

function sidebarLabel(state: BadgeState): string {
  if (state.kind === "supported") return "On GeForce NOW";
  if (state.kind === "not-supported") return "Not on GeForce NOW";
  return "GeForce NOW: couldn't check";
}

function pillLabel(state: BadgeState): string {
  if (state.kind === "supported") return state.rtx ? "GeForce NOW · RTX" : "GeForce NOW";
  if (state.kind === "not-supported") return "Not available";
  return "Couldn't check";
}

function dot(doc: Document): HTMLElement {
  const d = doc.createElement("span");
  d.className = "gfn-check-dot";
  return d;
}

/** Full-size sidebar badge for a store page. */
export function renderSidebarBadge(doc: Document, state: BadgeState): HTMLElement {
  const el = doc.createElement("div");
  el.className = `gfn-check-badge gfn-check-badge--${modifier(state)}`;
  el.appendChild(dot(doc));
  const label = doc.createElement("span");
  label.className = "gfn-check-label";
  label.textContent = sidebarLabel(state);
  el.appendChild(label);
  if (state.kind === "supported" && state.rtx) {
    const rtx = doc.createElement("span");
    rtx.className = "gfn-check-rtx";
    rtx.textContent = "RTX";
    el.appendChild(rtx);
  }
  return el;
}

/** Compact pill for a wishlist row. */
export function renderWishlistPill(doc: Document, state: BadgeState): HTMLElement {
  const el = doc.createElement("span");
  el.className = `gfn-check-pill gfn-check-pill--${modifier(state)}`;
  el.appendChild(dot(doc));
  const label = doc.createElement("span");
  label.textContent = pillLabel(state);
  el.appendChild(label);
  return el;
}

/** Insert `badge` immediately before the first element matching `anchorSelector`,
 *  removing any prior element that shares badge.id (idempotent re-injection).
 *  Returns true if anchored, false if it fell back to <body>. We only ever touch
 *  our own node. */
export function placeBefore(doc: Document, anchorSelector: string, badge: HTMLElement): boolean {
  if (badge.id) doc.getElementById(badge.id)?.remove();
  const anchor = doc.querySelector(anchorSelector);
  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(badge, anchor);
    return true;
  }
  (doc.body ?? doc.documentElement).appendChild(badge);
  return false;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/badge.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 6: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — all files (parse-app-id, index-feed, resolve-state, feed-cache, badge).

- [ ] **Step 7: Commit**

```bash
git add src/badge/badge.css.ts src/badge/badge.ts tests/badge.test.ts
git commit -m "feat: add namespaced badge renderer and placement helper"
```

---

## Task 10: Store content script (glue)

**Files:**
- Create: `src/content/store.ts`

Thin glue over tested units (`parseAppId`, `resolveState`, `renderSidebarBadge`, `placeBefore`). Verified manually in Task 12.

- [ ] **Step 1: Create `src/content/store.ts`**

```ts
import { parseAppId } from "../feed/parse-app-id";
import { resolveState, type BadgeState } from "../feed/resolve-state";
import type { LookupRequest, LookupResponse } from "../shared/messages";
import { ensureStyles, placeBefore, renderSidebarBadge } from "../badge/badge";

const SLOT_ID = "gfn-check-store-slot";
// Steam's purchase block; the badge is inserted just above it. This is the one
// selector to re-verify against the live store page if placement drifts.
const ANCHOR_SELECTOR = "#game_area_purchase";

let state: BadgeState | null = null;

/** Render (or re-render) the badge if it is not currently in the DOM. */
function paint(): void {
  if (state === null) return;
  if (document.getElementById(SLOT_ID)) return;
  ensureStyles(document);
  const badge = renderSidebarBadge(document, state);
  badge.id = SLOT_ID;
  placeBefore(document, ANCHOR_SELECTOR, badge);
}

async function run(): Promise<void> {
  const appId = parseAppId(location.href);
  if (appId === null) return;
  const req: LookupRequest = { type: "gfn-lookup", appIds: [appId] };
  const response = (await browser.runtime.sendMessage(req)) as LookupResponse;
  state = resolveState(appId, response);
  paint();
}

void run();

// Re-inject if Steam or another extension (Augmented Steam / alike03's) rebuilds
// the purchase area after us. paint() is a no-op while our node is present.
new MutationObserver(() => paint()).observe(document.body, {
  childList: true,
  subtree: true,
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/content/store.ts
git commit -m "feat: add store-page content script"
```

---

## Task 11: Wishlist content script (glue) + debounce util (TDD)

**Files:**
- Create: `src/shared/debounce.ts`, `src/content/wishlist.ts`
- Test: `tests/debounce.test.ts`

- [ ] **Step 1: Write the failing test `tests/debounce.test.ts`**

```ts
import { afterEach, describe, expect, test, vi } from "vitest";
import { debounce } from "../src/shared/debounce";

afterEach(() => vi.useRealTimers());

describe("debounce", () => {
  test("invokes once after the quiet window", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d(); d(); d();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/debounce.test.ts`
Expected: FAIL — cannot find module `../src/shared/debounce`.

- [ ] **Step 3: Create `src/shared/debounce.ts`**

```ts
/** Coalesce rapid calls; invoke `fn` once after `ms` of quiet. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/debounce.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Create `src/content/wishlist.ts`**

```ts
import { parseAppIdFromElement } from "../feed/parse-app-id";
import { resolveState } from "../feed/resolve-state";
import type { LookupRequest, LookupResponse } from "../shared/messages";
import { debounce } from "../shared/debounce";
import { ensureStyles, renderWishlistPill } from "../badge/badge";

// Steam wishlist row container. This is the single selector to re-verify against
// the live wishlist DOM; app-id extraction itself is markup-agnostic (it reads
// the row's /app/ anchor).
const ROW_SELECTOR = ".wishlist_row";
const PILL_SLOT = "gfn-check-pill-slot";

async function run(): Promise<void> {
  const rows = Array.from(document.querySelectorAll<HTMLElement>(ROW_SELECTOR));
  if (rows.length === 0) return;

  const appIds = [
    ...new Set(
      rows
        .map((r) => parseAppIdFromElement(r))
        .filter((id): id is number => id !== null),
    ),
  ];
  if (appIds.length === 0) return;

  const req: LookupRequest = { type: "gfn-lookup", appIds };
  const response = (await browser.runtime.sendMessage(req)) as LookupResponse;

  ensureStyles(document);
  for (const row of rows) {
    if (row.querySelector(`.${PILL_SLOT}`)) continue; // already badged
    const appId = parseAppIdFromElement(row);
    if (appId === null) continue;
    const slot = document.createElement("span");
    slot.className = PILL_SLOT;
    slot.appendChild(renderWishlistPill(document, resolveState(appId, response)));
    row.appendChild(slot);
  }
}

void run();

// Wishlist rows load lazily on scroll; re-run (debounced) to badge new rows.
new MutationObserver(debounce(() => void run(), 300)).observe(document.body, {
  childList: true,
  subtree: true,
});
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/shared/debounce.ts src/content/wishlist.ts tests/debounce.test.ts
git commit -m "feat: add wishlist content script and debounce util"
```

---

## Task 12: Manifest, icon, build, and manual verification in Firefox

**Files:**
- Create: `src/manifest.json`, `icons/icon.svg`

- [ ] **Step 1: Create `icons/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="18" fill="#0c1a05"/>
  <circle cx="48" cy="48" r="20" fill="#76b900"/>
</svg>
```

- [ ] **Step 2: Create `src/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "GeForce NOW check for Steam",
  "version": "0.1.0",
  "description": "Shows whether Steam games are playable on NVIDIA GeForce NOW.",
  "browser_specific_settings": {
    "gecko": { "id": "gfn-check@mjrossi", "strict_min_version": "115.0" }
  },
  "permissions": ["storage"],
  "host_permissions": ["https://static.nvidiagrid.net/*"],
  "background": { "scripts": ["background.js"] },
  "content_scripts": [
    {
      "matches": ["https://store.steampowered.com/app/*"],
      "js": ["store.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://store.steampowered.com/wishlist/*"],
      "js": ["wishlist.js"],
      "run_at": "document_idle"
    }
  ],
  "icons": { "48": "icons/icon.svg", "96": "icons/icon.svg" }
}
```

- [ ] **Step 3: Build the extension**

Run: `node build.mjs`
Expected: prints `built -> dist`; `dist/` contains `background.js`, `store.js`, `wishlist.js`, `manifest.json`, `icons/icon.svg`.

- [ ] **Step 4: Lint the built extension**

Run: `npx web-ext lint --source-dir dist`
Expected: no errors (warnings about the simple icon are acceptable).

- [ ] **Step 5: Run the full local gate**

Run: `just check`
Expected: typecheck clean, all Vitest tests pass, web-ext lint clean.

- [ ] **Step 6: Launch in Firefox and verify manually**

Run: `npx web-ext run --source-dir dist`
Verify in the opened Firefox:
- Open `https://store.steampowered.com/app/1091500` (Cyberpunk 2077) → green **On GeForce NOW** badge (with **RTX** if fully optimized) above the purchase box.
- Open a store page for a game not on GFN (e.g. a niche indie) → grey **Not on GeForce NOW**.
- Open your **wishlist** → a compact pill on each row. (If pills are missing, confirm `ROW_SELECTOR` in `src/content/wishlist.ts` matches the live wishlist row class, adjust, rebuild.)
- Install **Augmented Steam** alongside and reload an app page → both extensions' UI render without overlap; the GFN badge persists.

- [ ] **Step 7: Commit**

```bash
git add src/manifest.json icons/icon.svg
git commit -m "feat: add manifest, icon, and wire up the build"
```

---

## Task 13: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# GeForce NOW check for Steam (Firefox)

Badges Steam store and wishlist pages with NVIDIA GeForce NOW availability.

## Develop

Requires [mise](https://mise.jdx.dev).

\`\`\`bash
mise install      # node + just
just install      # npm ci
just check        # typecheck + test + lint
just dev          # launch Firefox with the extension loaded
just package      # build a distributable zip
\`\`\`

## How it works

A background script caches NVIDIA's public supported-games feed (12 h TTL) and
indexes it by Steam app id. Content scripts on store/wishlist pages look games up
and inject namespaced (\`gfn-check-*\`) badges. Data source:
\`https://static.nvidiagrid.net/supported-public-game-list/locales/gfnpc-en-US.json\`.

Membership tiers are not shown — the public feed does not expose them.
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Self-Review

**Spec coverage:**
- Data source (verified locale feed, app-id match) → Tasks 4, 5, 8. ✓
- Background cache + TTL + message passing → Tasks 7, 8. ✓
- Badge states (supported / +RTX / not-supported / couldn't-check) → Tasks 6, 9. ✓
- Store sidebar placement + wishlist pills → Tasks 10, 11, 12. ✓
- Good-citizen coexistence (namespacing, own node, MutationObserver) → Tasks 9 (placeBefore), 10, 11. ✓
- Error handling (stale fallback, unknown vs not-supported) → Tasks 6, 7. ✓
- TypeScript + Vitest + esbuild; mise/just/editorconfig/web-ext; CI → Tasks 1, 2, 3, 12. ✓
- Out-of-scope items (tiers, play links, search lists, library, non-Steam) → not implemented. ✓

**Type consistency:** `GfnIndex`, `FeedCache`, `LoadDeps`, `LookupRequest`/`LookupResponse`, `BadgeState` are defined once and reused with identical shapes across tasks. `loadIndex`, `buildIndex`, `parseAppId`, `parseAppIdFromElement`, `resolveState`, `renderSidebarBadge`, `renderWishlistPill`, `placeBefore`, `ensureStyles`, `debounce` names are consistent between definition and use. ✓

**Placeholder scan:** No TBD/TODO; every code step has full code. The two live-DOM-dependent selectors (`#game_area_purchase`, `.wishlist_row`) are real values with explicit "re-verify live" callouts and robust fallbacks — not placeholders. ✓
