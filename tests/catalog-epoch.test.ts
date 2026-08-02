import { afterEach, describe, expect, test, vi } from "vitest";
import { onLocalKeyChange } from "../src/shared/storage";
import { EPOCH_KEY, onEpochChange } from "../src/shared/catalog-epoch";

/** The signature `browser.storage.onChanged` hands its listeners. */
type ChangeListener = (
  changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
  area: string,
) => void;

/** Stub `storage.onChanged` and hand back a way to fire a synthetic change at
 *  every registered listener, the way the browser would. */
function stubOnChanged(): (
  changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
  area: string,
) => void {
  const listeners: ChangeListener[] = [];
  vi.stubGlobal("browser", {
    storage: {
      onChanged: {
        addListener: (fn: ChangeListener) => listeners.push(fn),
      },
    },
  });
  return (changes, area) => {
    for (const fn of listeners) fn(changes, area);
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("onLocalKeyChange", () => {
  test("fires with the new value when its key changes in local", () => {
    const fire = stubOnChanged();
    const handler = vi.fn();
    onLocalKeyChange("gfn-debug", handler);

    fire({ "gfn-debug": { newValue: true } }, "local");

    expect(handler.mock.calls).toEqual([[true]]);
  });

  test("ignores writes to other keys in the same area", () => {
    // The catalog cache, the epoch, and the debug flag all share storage.local,
    // and every listener sees every write — so without the `key in changes`
    // filter, a debug-flag toggle would re-run both content scripts.
    const fire = stubOnChanged();
    const handler = vi.fn();
    onLocalKeyChange("gfn-catalog-epoch", handler);

    fire({ "gfn-debug": { newValue: true } }, "local");

    expect(handler).not.toHaveBeenCalled();
  });

  test("ignores the right key in the wrong area", () => {
    const fire = stubOnChanged();
    const handler = vi.fn();
    onLocalKeyChange("gfn-catalog-epoch", handler);

    fire({ "gfn-catalog-epoch": { newValue: 1 } }, "sync");
    fire({ "gfn-catalog-epoch": { newValue: 1 } }, "managed");

    expect(handler).not.toHaveBeenCalled();
  });

  test("passes undefined when the key is removed", () => {
    const fire = stubOnChanged();
    const handler = vi.fn();
    onLocalKeyChange("gfn-debug", handler);

    fire({ "gfn-debug": { oldValue: true } }, "local");

    expect(handler.mock.calls).toEqual([[undefined]]);
  });

  test("fires once per write when several keys move together", () => {
    // The background writes the cache and the epoch in one storage.local.set, so
    // the change event carries both keys.
    const fire = stubOnChanged();
    const handler = vi.fn();
    onLocalKeyChange("gfn-catalog-epoch", handler);

    fire(
      { "gfn-feed-cache": { newValue: { apps: [] } }, "gfn-catalog-epoch": { newValue: 42 } },
      "local",
    );

    expect(handler.mock.calls).toEqual([[42]]);
  });
});

describe("onEpochChange", () => {
  test("fires on a catalog publish", () => {
    const fire = stubOnChanged();
    const handler = vi.fn();
    onEpochChange(handler);

    fire({ [EPOCH_KEY]: { newValue: 1234 } }, "local");

    expect(handler).toHaveBeenCalledOnce();
  });

  test("passes no arguments — a change event is the whole signal", () => {
    // Content scripts must not start depending on the value; the key holds a
    // timestamp only so each write differs from the last.
    const fire = stubOnChanged();
    const handler = vi.fn();
    onEpochChange(handler);

    fire({ [EPOCH_KEY]: { newValue: 1234 } }, "local");

    expect(handler.mock.calls).toEqual([[]]);
  });

  test("does not fire on a cache write that carries no epoch", () => {
    const fire = stubOnChanged();
    const handler = vi.fn();
    onEpochChange(handler);

    fire({ "gfn-feed-cache": { newValue: { apps: [] } } }, "local");

    expect(handler).not.toHaveBeenCalled();
  });
});
