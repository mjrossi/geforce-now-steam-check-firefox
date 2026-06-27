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
  test("matches the store label case/space-insensitively", () => {
    const idx = buildIndex([
      entry({ store: "STEAM", steamUrl: "https://store.steampowered.com/app/7" }),
      entry({ store: " Steam ", steamUrl: "https://store.steampowered.com/app/8" }),
    ]);
    expect(idx["7"]).toEqual({ rtx: false });
    expect(idx["8"]).toEqual({ rtx: false });
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
