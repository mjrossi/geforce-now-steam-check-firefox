import { afterEach, describe, expect, test, vi } from "vitest";
import { lookup } from "../src/shared/lookup";
import { resolveState } from "../src/feed/resolve-state";

/** Stub just enough of the `browser` global for the message send. */
function stubSendMessage(impl: () => Promise<unknown>): ReturnType<typeof vi.fn> {
  const sendMessage = vi.fn(impl);
  vi.stubGlobal("browser", { runtime: { sendMessage } });
  return sendMessage;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("lookup", () => {
  test("passes a well-formed request to the background", async () => {
    const send = stubSendMessage(() => Promise.resolve({ ok: true, found: {} }));
    await lookup([620, 730]);
    expect(send).toHaveBeenCalledWith({ type: "gfn-lookup", appIds: [620, 730] });
  });

  test("returns the background's response untouched on success", async () => {
    const found = { "620": { rtx: true, gfnId: "uuid-620" } };
    stubSendMessage(() => Promise.resolve({ ok: true, found }));
    await expect(lookup([620])).resolves.toEqual({ ok: true, found });
  });

  test("passes a permission failure through so the badge can guide the user", async () => {
    stubSendMessage(() => Promise.resolve({ ok: false, found: {}, reason: "permission" }));
    const response = await lookup([620]);
    expect(resolveState(620, response)).toEqual({ kind: "needs-permission" });
  });

  // The whole point of this module: a content script that messages before the
  // MV3 background has started, or across an extension reload, must still badge.
  test("degrades to 'couldn't check' when the background is unreachable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    stubSendMessage(() => Promise.reject(new Error("Could not establish connection")));
    const response = await lookup([620]);
    expect(response).toEqual({ ok: false, found: {}, reason: "network" });
    expect(resolveState(620, response)).toEqual({ kind: "unknown" });
  });

  test("degrades when no listener replies (undefined)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    stubSendMessage(() => Promise.resolve(undefined));
    await expect(lookup([620])).resolves.toEqual({ ok: false, found: {}, reason: "network" });
  });

  test("degrades on a malformed reply rather than throwing downstream", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    stubSendMessage(() => Promise.resolve({ ok: true }));
    const response = await lookup([620]);
    expect(resolveState(620, response)).toEqual({ kind: "unknown" });
  });

  // Never a false negative: an unreachable background must not read as
  // "not on GeForce NOW".
  test("unreachable never resolves to not-supported", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    stubSendMessage(() => Promise.reject(new Error("boom")));
    const state = resolveState(620, await lookup([620]));
    expect(state.kind).not.toBe("not-supported");
  });
});
