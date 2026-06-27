// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import {
  parseAppId,
  parseAppIdFromElement,
  parseAppIdFromImage,
} from "../src/feed/parse-app-id";

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

describe("parseAppIdFromElement", () => {
  test("reads the id from a child /app/ anchor", () => {
    document.body.innerHTML = `<div class="row"><a href="/app/620/Portal_2/">Portal 2</a></div>`;
    const row = document.querySelector(".row")!;
    expect(parseAppIdFromElement(row)).toBe(620);
  });
  test("falls back to a capsule image when there is no anchor", () => {
    document.body.innerHTML = `<div class="row"><img src="https://cdn.cloudflare.steamstatic.com/steam/apps/620/capsule.jpg"></div>`;
    const row = document.querySelector(".row")!;
    expect(parseAppIdFromElement(row)).toBe(620);
  });
  test("returns null when there is no app anchor or image", () => {
    document.body.innerHTML = `<div class="row"><span>no link</span></div>`;
    const row = document.querySelector(".row")!;
    expect(parseAppIdFromElement(row)).toBeNull();
  });
});
