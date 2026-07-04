import { describe, expect, test } from "vitest";
import { resolveState } from "../src/feed/resolve-state";
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
