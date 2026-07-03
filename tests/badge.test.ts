// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import {
  ensureStyles,
  placeAfter,
  placeBefore,
  renderStoreBanner,
  renderWishlistPill,
} from "../src/badge/badge";
import { gfnPlayUrl } from "../src/badge/gfn-link";

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
  test("needs-permission prompts the user to enable from the toolbar", () => {
    const el = renderStoreBanner(document, { kind: "needs-permission" });
    expect(el.className).toContain("gfn-check-banner--unknown");
    expect(el.querySelector(".gfn-check-banner-text")!.textContent).toBe(
      "GeForce NOW: click the toolbar icon to enable checks",
    );
  });

  test("supported with a gfn id renders as a deep link to play.geforcenow.com", () => {
    const gfnId = "e5bd86f0-3f67-4bec-a505-d1315f3c0d50";
    const el = renderStoreBanner(document, { kind: "supported", rtx: false, gfnId });
    expect(el.tagName).toBe("A");
    // Exact URL serialization is owned by gfn-link.test.ts; here we only care
    // that the href is the deep link for this id.
    expect(el.getAttribute("href")).toBe(gfnPlayUrl(gfnId));
    expect(el.getAttribute("target")).toBe("_blank");
    expect(el.getAttribute("rel")).toContain("noopener");
    expect(el.getAttribute("rel")).toContain("noreferrer");
    expect(el.className).toContain("gfn-check-banner--link");
    expect(el.querySelector(".gfn-check-play")).not.toBeNull();
  });

  test("supported without a gfn id (stale pre-v2 cache) stays a plain div", () => {
    const el = renderStoreBanner(document, { kind: "supported", rtx: true });
    expect(el.tagName).toBe("DIV");
    expect(el.getAttribute("href")).toBeNull();
    expect(el.className).not.toContain("gfn-check-banner--link");
    expect(el.querySelector(".gfn-check-play")).toBeNull();
  });

  test("non-supported states are never links", () => {
    for (const state of [
      { kind: "not-supported" } as const,
      { kind: "unknown" } as const,
      { kind: "needs-permission" } as const,
    ]) {
      const el = renderStoreBanner(document, state);
      expect(el.tagName).toBe("DIV");
      expect(el.className).not.toContain("gfn-check-banner--link");
      expect(el.querySelector(".gfn-check-play")).toBeNull();
    }
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
  test("needs-permission", () => {
    const el = renderWishlistPill(document, { kind: "needs-permission" });
    expect(el.className).toContain("gfn-check-pill--unknown");
    expect(el.textContent).toContain("Enable in toolbar");
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
