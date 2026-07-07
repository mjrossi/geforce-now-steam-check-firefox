// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import {
  ensureStyles,
  placeAfter,
  placeBefore,
  renderStoreBanner,
  renderWishlistPill,
} from "../src/badge/badge";
import { gfnAppUrl, gfnPlayUrl } from "../src/badge/gfn-link";

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

  test("supported with cms + gfn ids: main link opens the native app, web chip falls back", () => {
    const gfnId = "e5bd86f0-3f67-4bec-a505-d1315f3c0d50";
    const cmsId = 100885011;
    const el = renderStoreBanner(document, { kind: "supported", rtx: true, gfnId, cmsId });
    expect(el.tagName).toBe("DIV");
    expect(el.className).toContain("gfn-check-banner--link");

    // Exact URL serialization is owned by gfn-link.test.ts; here we only care
    // which link goes where.
    const main = el.querySelector("a.gfn-check-banner-main")!;
    expect(main.getAttribute("href")).toBe(gfnAppUrl(cmsId, gfnId));
    // Custom-scheme links stay in-tab: Firefox hands them to the OS without
    // navigating, so no target/_blank churn.
    expect(main.getAttribute("target")).toBeNull();
    // Logo, label and chips all live inside the click target.
    expect(main.querySelector(".gfn-check-banner-text")!.textContent).toBe(
      "Playable on GeForce NOW",
    );
    expect(main.querySelector(".gfn-check-rtx")).not.toBeNull();
    expect(main.querySelector(".gfn-check-play")!.textContent).toBe("Play");

    const web = el.querySelector("a.gfn-check-web")!;
    expect(web.getAttribute("href")).toBe(gfnPlayUrl(gfnId));
    expect(web.getAttribute("target")).toBe("_blank");
    expect(web.getAttribute("rel")).toContain("noopener");
    expect(web.getAttribute("rel")).toContain("noreferrer");
  });

  test("supported with only a gfn id (stale v2 cache) links to the web app, no web chip", () => {
    const gfnId = "uuid-only";
    const el = renderStoreBanner(document, { kind: "supported", rtx: false, gfnId });
    expect(el.className).toContain("gfn-check-banner--link");
    const main = el.querySelector("a.gfn-check-banner-main")!;
    expect(main.getAttribute("href")).toBe(gfnPlayUrl(gfnId));
    expect(main.getAttribute("target")).toBe("_blank");
    expect(main.getAttribute("rel")).toContain("noopener");
    expect(main.querySelector(".gfn-check-play")!.textContent).toBe("Play ↗");
    expect(el.querySelector(".gfn-check-web")).toBeNull();
  });

  test("supported without ids (stale pre-v2 cache) stays a plain non-link banner", () => {
    const el = renderStoreBanner(document, { kind: "supported", rtx: true });
    expect(el.tagName).toBe("DIV");
    expect(el.querySelector("a")).toBeNull();
    expect(el.className).not.toContain("gfn-check-banner--link");
    expect(el.querySelector(".gfn-check-play")).toBeNull();
    expect(el.querySelector(".gfn-check-rtx")).not.toBeNull();
  });

  test("non-supported states are never links", () => {
    for (const state of [
      { kind: "not-supported" } as const,
      { kind: "unknown" } as const,
      { kind: "needs-permission" } as const,
    ]) {
      const el = renderStoreBanner(document, state);
      expect(el.tagName).toBe("DIV");
      expect(el.querySelector("a")).toBeNull();
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
