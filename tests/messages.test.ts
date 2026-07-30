import { describe, expect, it } from "vitest";
import {
  asStatus,
  isCatalogStatus,
  isLookupRequest,
  isRefreshResponse,
} from "../src/shared/messages";

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

describe("isLookupRequest", () => {
  it("accepts a well-formed lookup, including an empty batch", () => {
    expect(isLookupRequest({ type: "gfn-lookup", appIds: [570, 620] })).toBe(true);
    expect(isLookupRequest({ type: "gfn-lookup", appIds: [] })).toBe(true);
  });

  it("rejects the other request types and non-objects", () => {
    // onMessage hears from every content script and from other extensions, so
    // anything that isn't ours must be declined rather than half-handled.
    expect(isLookupRequest({ type: "gfn-status" })).toBe(false);
    expect(isLookupRequest({ type: "gfn-refresh" })).toBe(false);
    expect(isLookupRequest(null)).toBe(false);
    expect(isLookupRequest("gfn-lookup")).toBe(false);
  });

  it("rejects a lookup whose appIds are not all numbers", () => {
    // The elements matter, not just the array: appIds reach the index as
    // String(appId), so a non-number looks up a key that cannot exist and reads
    // back as a confident "not supported".
    expect(isLookupRequest({ type: "gfn-lookup", appIds: ["570"] })).toBe(false);
    expect(isLookupRequest({ type: "gfn-lookup", appIds: [570, null] })).toBe(false);
    expect(isLookupRequest({ type: "gfn-lookup" })).toBe(false);
    expect(isLookupRequest({ type: "gfn-lookup", appIds: "570" })).toBe(false);
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
