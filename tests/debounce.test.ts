import { afterEach, describe, expect, test, vi } from "vitest";
import { debounce } from "../src/shared/debounce";

afterEach(() => vi.useRealTimers());

describe("debounce", () => {
  test("invokes once after the quiet window", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d(); d(); d();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledOnce();
  });
});
