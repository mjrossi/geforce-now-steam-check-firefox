import { describe, expect, it } from "vitest";
import { asStatus, isCatalogStatus, isRefreshResponse } from "../src/shared/messages";

describe("asStatus", () => {
  it("passes a well-formed catalog status through", () => {
    const status = { count: 2187, fetchedAt: 1_700_000_000_000 };
    expect(asStatus(status)).toEqual(status);
  });

  it("keeps null (no cache yet) distinct from undefined (couldn't ask)", () => {
    // The popup renders these differently, and they are different bug reports:
    // "the catalog never loaded" vs "the background never answered".
    expect(asStatus(null)).toBeNull();
    expect(asStatus(undefined)).toBeUndefined();
  });

  it("treats a declined message as unreachable, not as an empty catalog", () => {
    // runtime.sendMessage resolves with undefined when a listener declines —
    // an older background mid-update does exactly that for gfn-status. Casting
    // this to StatusResponse put `undefined.count` one access away and stranded
    // the popup on its placeholder.
    expect(asStatus(undefined)).toBeUndefined();
  });

  it("rejects replies missing either field", () => {
    expect(asStatus({ count: 10 })).toBeUndefined();
    expect(asStatus({ fetchedAt: 1 })).toBeUndefined();
    expect(asStatus({ count: "10", fetchedAt: 1 })).toBeUndefined();
    expect(asStatus("nope")).toBeUndefined();
  });
});

describe("isCatalogStatus", () => {
  it("accepts a zero-count catalog", () => {
    // A catalog that legitimately indexed nothing is still a real answer.
    expect(isCatalogStatus({ count: 0, fetchedAt: 0 })).toBe(true);
  });

  it("rejects null and non-objects", () => {
    expect(isCatalogStatus(null)).toBe(false);
    expect(isCatalogStatus(undefined)).toBe(false);
    expect(isCatalogStatus(42)).toBe(false);
  });
});

describe("isRefreshResponse", () => {
  it("accepts a success carrying a status", () => {
    expect(isRefreshResponse({ ok: true, status: { count: 5, fetchedAt: 1 } })).toBe(true);
  });

  it("accepts a failure whose status is null", () => {
    // ok:false with no cache at all is a legitimate reply shape.
    expect(isRefreshResponse({ ok: false, status: null })).toBe(true);
  });

  it("rejects a declined or malformed reply", () => {
    expect(isRefreshResponse(undefined)).toBe(false);
    expect(isRefreshResponse({ ok: true })).toBe(false);
    expect(isRefreshResponse({ ok: "yes", status: null })).toBe(false);
    expect(isRefreshResponse({ ok: true, status: { count: 5 } })).toBe(false);
  });
});
