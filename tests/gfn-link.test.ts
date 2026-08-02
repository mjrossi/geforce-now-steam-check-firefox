import { describe, expect, test } from "vitest";
import { gfnAppUrl, gfnPlayUrl, resolveBannerLinks } from "../src/badge/gfn-link";
import type { BadgeState } from "../src/feed/resolve-state";

const GFN_ID = "e5bd86f0-3f67-4bec-a505-d1315f3c0d50";

describe("gfnPlayUrl", () => {
  test("builds the official deep link with game-id and utm params", () => {
    expect(gfnPlayUrl("e5bd86f0-3f67-4bec-a505-d1315f3c0d50")).toBe(
      "https://play.geforcenow.com/games?game-id=e5bd86f0-3f67-4bec-a505-d1315f3c0d50" +
        "&utm_source=gfn-check-steam&utm_campaign=steam-store-banner",
    );
  });

  test("percent-encodes a hostile id", () => {
    const url = new URL(gfnPlayUrl("a&b c?"));
    expect(url.searchParams.get("game-id")).toBe("a&b c?");
    expect(url.origin + url.pathname).toBe("https://play.geforcenow.com/games");
  });
});

describe("gfnAppUrl", () => {
  test("builds the native app route the desktop client's shortcuts use", () => {
    expect(gfnAppUrl(100885011, "e5bd86f0-3f67-4bec-a505-d1315f3c0d50")).toBe(
      "geforcenow://route/#?cmsId=100885011&launchSource=External" +
        "&shortName=e5bd86f0-3f67-4bec-a505-d1315f3c0d50" +
        "&parentGameId=e5bd86f0-3f67-4bec-a505-d1315f3c0d50",
    );
  });

  test("percent-encodes a hostile gfn id", () => {
    expect(gfnAppUrl(7, "a&b c#")).toBe(
      "geforcenow://route/#?cmsId=7&launchSource=External" +
        "&shortName=a%26b%20c%23&parentGameId=a%26b%20c%23",
    );
  });
});

// A stale cache written by an older extension version can be served after a
// failed refetch, so the banner has to cope with entries missing the newer ids.
// Degrading must always drop links, never produce a wrong one.
describe("resolveBannerLinks", () => {
  test("v3 entry (gfnId + cmsId) offers both the app and web links", () => {
    const links = resolveBannerLinks({ kind: "supported", rtx: true, gfnId: GFN_ID, cmsId: 100885011 });
    expect(links.appUrl).toBe(gfnAppUrl(100885011, GFN_ID));
    expect(links.webUrl).toBe(gfnPlayUrl(GFN_ID));
  });

  test("v2 entry (gfnId only) falls back to the web link", () => {
    const links = resolveBannerLinks({ kind: "supported", rtx: false, gfnId: GFN_ID });
    expect(links.appUrl).toBeNull();
    expect(links.webUrl).toBe(gfnPlayUrl(GFN_ID));
  });

  test("v1 entry (no ids) offers nothing — the banner stays inert", () => {
    expect(resolveBannerLinks({ kind: "supported", rtx: false })).toEqual({
      appUrl: null,
      webUrl: null,
    });
  });

  test("a cmsId without a gfnId cannot build either link", () => {
    expect(resolveBannerLinks({ kind: "supported", rtx: false, cmsId: 100885011 })).toEqual({
      appUrl: null,
      webUrl: null,
    });
  });

  test.each<BadgeState>([
    { kind: "not-supported" },
    { kind: "unknown" },
    { kind: "needs-permission" },
  ])("$kind links nowhere", (state) => {
    expect(resolveBannerLinks(state)).toEqual({ appUrl: null, webUrl: null });
  });
});
