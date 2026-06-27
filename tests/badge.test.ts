// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import {
  ensureStyles,
  placeAfter,
  placeBefore,
  renderStoreBanner,
  renderWishlistPill,
} from "../src/badge/badge";

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("renderStoreBanner", () => {
  test("supported + rtx", () => {
    const el = renderStoreBanner(document, { kind: "supported", rtx: true });
    expect(el.className).toContain("gfn-check-banner--ok");
    expect(el.querySelector(".gfn-check-banner-text")!.textContent).toBe(
      "Playable on GeForce NOW",
    );
    expect(el.querySelector(".gfn-check-rtx")).not.toBeNull();
  });
  test("supported without rtx omits the RTX chip", () => {
    const el = renderStoreBanner(document, { kind: "supported", rtx: false });
    expect(el.querySelector(".gfn-check-rtx")).toBeNull();
  });
  test("not-supported", () => {
    const el = renderStoreBanner(document, { kind: "not-supported" });
    expect(el.className).toContain("gfn-check-banner--no");
    expect(el.querySelector(".gfn-check-banner-text")!.textContent).toBe(
      "Not on GeForce NOW",
    );
  });
  test("unknown", () => {
    const el = renderStoreBanner(document, { kind: "unknown" });
    expect(el.className).toContain("gfn-check-banner--unknown");
    expect(el.querySelector(".gfn-check-banner-text")!.textContent).toBe(
      "GeForce NOW: couldn't check",
    );
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
      const b = renderStoreBanner(document, { kind: "not-supported" });
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
    const b = renderStoreBanner(document, { kind: "unknown" });
    b.id = "gfn-check-store-slot";
    expect(placeBefore(document, "#nope", b)).toBe(false);
    expect(document.getElementById("gfn-check-store-slot")).not.toBeNull();
  });
});

describe("placeAfter", () => {
  test("inserts after the anchor and is idempotent by id", () => {
    document.body.innerHTML = `<div class="apphub_HeaderStandardTop">title</div><div id="next">x</div>`;
    const make = () => {
      const b = renderStoreBanner(document, { kind: "supported", rtx: false });
      b.id = "gfn-check-store-slot";
      return b;
    };
    expect(placeAfter(document, ".apphub_HeaderStandardTop", make())).toBe(true);
    placeAfter(document, ".apphub_HeaderStandardTop", make());
    expect(document.querySelectorAll("#gfn-check-store-slot")).toHaveLength(1);
    const header = document.querySelector(".apphub_HeaderStandardTop")!;
    expect(header.nextElementSibling!.id).toBe("gfn-check-store-slot");
  });
  test("returns false when the anchor is missing", () => {
    const b = renderStoreBanner(document, { kind: "unknown" });
    b.id = "gfn-check-store-slot";
    expect(placeAfter(document, "#nope", b)).toBe(false);
  });
});
