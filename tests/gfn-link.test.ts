import { describe, expect, test } from "vitest";
import { gfnPlayUrl } from "../src/badge/gfn-link";

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
