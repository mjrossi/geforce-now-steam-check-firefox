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
