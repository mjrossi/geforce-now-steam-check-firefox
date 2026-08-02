import { describe, expect, test } from "vitest";
import { isDefinitive, resolveState, stateStamp } from "../src/feed/resolve-state";
import type { BadgeState } from "../src/feed/resolve-state";
import type { LookupResponse } from "../src/shared/messages";

describe("resolveState", () => {
  test("feed error → unknown", () => {
    const res: LookupResponse = { ok: false, found: {} };
    expect(resolveState(620, res)).toEqual({ kind: "unknown" });
  });
  test("feed error from a transient network failure → unknown", () => {
    const res: LookupResponse = { ok: false, found: {}, reason: "network" };
    expect(resolveState(620, res)).toEqual({ kind: "unknown" });
  });
  test("feed unavailable because permission not granted → needs-permission", () => {
    const res: LookupResponse = { ok: false, found: {}, reason: "permission" };
    expect(resolveState(620, res)).toEqual({ kind: "needs-permission" });
  });
  test("present in found → supported with rtx flag, gfn id and cms id", () => {
    const res: LookupResponse = {
      ok: true,
      found: { "620": { rtx: true, gfnId: "uuid-620", cmsId: 100620 } },
    };
    expect(resolveState(620, res)).toEqual({
      kind: "supported",
      rtx: true,
      gfnId: "uuid-620",
      cmsId: 100620,
    });
  });
  test("present without rtx → supported rtx:false", () => {
    const res: LookupResponse = { ok: true, found: { "10": { rtx: false, gfnId: "u" } } };
    expect(resolveState(10, res)).toEqual({
      kind: "supported",
      rtx: false,
      gfnId: "u",
      cmsId: undefined,
    });
  });
  test("entry without ids (stale pre-v2 cache) → supported, ids undefined", () => {
    const res: LookupResponse = { ok: true, found: { "10": { rtx: false } } };
    const state = resolveState(10, res);
    expect(state).toEqual({ kind: "supported", rtx: false, gfnId: undefined, cmsId: undefined });
  });
  test("absent but feed ok → not-supported", () => {
    const res: LookupResponse = { ok: true, found: {} };
    expect(resolveState(999, res)).toEqual({ kind: "not-supported" });
  });
});

describe("isDefinitive", () => {
  test("supported and not-supported are real answers", () => {
    expect(isDefinitive({ kind: "supported", rtx: false })).toBe(true);
    expect(isDefinitive({ kind: "not-supported" })).toBe(true);
  });
  test("unknown and needs-permission mean 'not yet'", () => {
    expect(isDefinitive({ kind: "unknown" })).toBe(false);
    expect(isDefinitive({ kind: "needs-permission" })).toBe(false);
  });
});

describe("stateStamp", () => {
  test("non-supported states stamp as their kind", () => {
    expect(stateStamp({ kind: "not-supported" })).toBe("not-supported");
    expect(stateStamp({ kind: "unknown" })).toBe("unknown");
    expect(stateStamp({ kind: "needs-permission" })).toBe("needs-permission");
  });

  test("distinguishes two supported states that render differently", () => {
    // The reason the stamp isn't just `kind`. Once a page can be re-checked
    // against a *new* catalog, supported → supported is a real transition: the
    // banner shows an RTX chip in one and not the other, and a kind-only stamp
    // would leave the wrong one in place.
    const rtx: BadgeState = { kind: "supported", rtx: true };
    const std: BadgeState = { kind: "supported", rtx: false };
    expect(stateStamp(rtx)).not.toBe(stateStamp(std));
  });

  test("distinguishes supported states whose deep links differ", () => {
    // A v1 stale-cache hit carries no ids and links to the GFN home page; the
    // refetched v3 entry deep-links to the game. Same kind, different banner.
    const bare: BadgeState = { kind: "supported", rtx: true };
    const linked: BadgeState = { kind: "supported", rtx: true, gfnId: "u", cmsId: 100620 };
    expect(stateStamp(bare)).not.toBe(stateStamp(linked));
  });

  test("is stable for identical states", () => {
    const a: BadgeState = { kind: "supported", rtx: true, gfnId: "u", cmsId: 1 };
    const b: BadgeState = { kind: "supported", rtx: true, gfnId: "u", cmsId: 1 };
    expect(stateStamp(a)).toBe(stateStamp(b));
  });

  test("never collides across kinds", () => {
    const stamps = [
      stateStamp({ kind: "supported", rtx: false }),
      stateStamp({ kind: "not-supported" }),
      stateStamp({ kind: "unknown" }),
      stateStamp({ kind: "needs-permission" }),
    ];
    expect(new Set(stamps).size).toBe(stamps.length);
  });
});
