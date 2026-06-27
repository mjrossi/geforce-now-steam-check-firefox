import { describe, expect, test } from "vitest";
import { parseAppId, parseAppIdFromImage } from "../src/feed/parse-app-id";

describe("parseAppId", () => {
  test("extracts id from a canonical store URL", () => {
    expect(parseAppId("https://store.steampowered.com/app/1358020")).toBe(1358020);
  });
  test("extracts id when a slug follows", () => {
    expect(parseAppId("https://store.steampowered.com/app/620/Portal_2/")).toBe(620);
  });
  test("extracts id when a query string follows (GFN storeUrl form)", () => {
    expect(
      parseAppId("https://store.steampowered.com/app/1285190?utm_source=nvidia&utm_campaign=geforce_now"),
    ).toBe(1285190);
  });
  test("returns null for a non-app URL", () => {
    expect(parseAppId("https://store.steampowered.com/wishlist/id/foo")).toBeNull();
  });
  test("returns null for empty input", () => {
    expect(parseAppId("")).toBeNull();
  });
});

describe("parseAppIdFromImage", () => {
  test("extracts id from a capsule image URL", () => {
    expect(
      parseAppIdFromImage(
        "https://cdn.cloudflare.steamstatic.com/steam/apps/620/header.jpg",
      ),
    ).toBe(620);
  });
  test("returns null when the URL has no apps segment", () => {
    expect(parseAppIdFromImage("https://cdn.cloudflare.steamstatic.com/x.jpg")).toBeNull();
  });
});
