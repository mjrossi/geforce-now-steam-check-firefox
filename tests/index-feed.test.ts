import { describe, expect, test } from "vitest";
import { buildIndex } from "../src/feed/index-feed";
import type { GfnApp, GfnFeature, GfnVariant } from "../src/feed/types";

function variant(over: Partial<GfnVariant>): GfnVariant {
  return {
    appStore: "STEAM",
    storeUrl: "https://store.steampowered.com/app/100?utm_source=nvidia",
    gfn: null,
    ...over,
  };
}

function app(variants: GfnVariant[], over: Partial<GfnApp> = {}): GfnApp {
  return { id: "x", title: "T", variants, ...over };
}

const rtxFeatures: GfnFeature[] = [
  { key: "HDR_ENABLED", value: "true" },
  { key: "RTX_ENABLED", value: "true" },
];

describe("buildIndex", () => {
  test("indexes a Steam variant by app id, rtx from RTX_ENABLED feature", () => {
    const idx = buildIndex([
      app([
        variant({
          storeUrl: "https://store.steampowered.com/app/620?utm_source=nvidia",
          gfn: { features: rtxFeatures },
        }),
      ]),
    ]);
    expect(idx["620"]).toEqual({ rtx: true });
  });

  test("rtx is false without an RTX_ENABLED=true feature", () => {
    const idx = buildIndex([
      app([
        variant({
          storeUrl: "https://store.steampowered.com/app/10",
          gfn: { features: [{ key: "HDR_ENABLED", value: "true" }] },
        }),
      ]),
    ]);
    expect(idx["10"]).toEqual({ rtx: false });
  });

  test("rtx is false when gfn / features are null", () => {
    const idx = buildIndex([
      app([variant({ storeUrl: "https://store.steampowered.com/app/11", gfn: null })]),
    ]);
    expect(idx["11"]).toEqual({ rtx: false });
  });

  test("keeps only the Steam variant of a multi-store game", () => {
    const idx = buildIndex([
      app([
        variant({ appStore: "EPIC", storeUrl: "https://www.epicgames.com/store/p/thief" }),
        variant({ appStore: "STEAM", storeUrl: "https://store.steampowered.com/app/239160" }),
      ]),
    ]);
    expect(idx).toEqual({ "239160": { rtx: false } });
  });

  test("matches the STEAM store label case/space-insensitively", () => {
    const idx = buildIndex([
      app([variant({ appStore: "STEAM", storeUrl: "https://store.steampowered.com/app/7" })]),
      app([variant({ appStore: " steam ", storeUrl: "https://store.steampowered.com/app/8" })]),
    ]);
    expect(idx["7"]).toEqual({ rtx: false });
    expect(idx["8"]).toEqual({ rtx: false });
  });

  test("skips variants with a null or app-id-less storeUrl", () => {
    const idx = buildIndex([
      app([variant({ appStore: "STEAM", storeUrl: null })]),
      app([variant({ appStore: "STEAM", storeUrl: "https://store.steampowered.com/" })]),
    ]);
    expect(Object.keys(idx)).toHaveLength(0);
  });

  test("tolerates a null variants list", () => {
    const idx = buildIndex([app([], { variants: null } as Partial<GfnApp>)]);
    expect(Object.keys(idx)).toHaveLength(0);
  });

  test("indexes multiple apps", () => {
    const idx = buildIndex([
      app([variant({ storeUrl: "https://store.steampowered.com/app/1" })]),
      app([
        variant({
          storeUrl: "https://store.steampowered.com/app/2",
          gfn: { features: rtxFeatures },
        }),
      ]),
    ]);
    expect(idx).toEqual({ "1": { rtx: false }, "2": { rtx: true } });
  });
});
