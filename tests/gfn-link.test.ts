import { describe, expect, test } from "vitest";
import { gfnAppUrl, gfnPlayUrl } from "../src/badge/gfn-link";

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
