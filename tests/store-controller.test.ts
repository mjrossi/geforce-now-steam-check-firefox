import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStoreController } from "../src/content/store-controller";
import type { BadgeState } from "../src/feed/resolve-state";

const SUPPORTED: BadgeState = { kind: "supported", rtx: true };
const NOT_SUPPORTED: BadgeState = { kind: "not-supported" };
const UNKNOWN: BadgeState = { kind: "unknown" };
const NEEDS_PERMISSION: BadgeState = { kind: "needs-permission" };

const DELAYS = [10, 20, 40];

/** A controller over a scripted sequence of answers. Runs out to the last one,
 *  so `[UNKNOWN, SUPPORTED]` means "fails once, then resolves forever". */
function harness(answers: BadgeState[], delays: readonly number[] = DELAYS) {
  const painted: BadgeState[] = [];
  let calls = 0;
  const controller = createStoreController({
    lookup: () => {
      const answer = answers[Math.min(calls, answers.length - 1)];
      calls += 1;
      return Promise.resolve(answer as BadgeState);
    },
    paint: (state) => painted.push(state),
    delays,
  });
  return {
    controller,
    painted,
    lookups: () => calls,
    /** Advance timers and let the resulting async lookups settle. */
    async advance(ms: number) {
      await vi.advanceTimersByTimeAsync(ms);
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createStoreController", () => {
  it("paints a definitive answer and never asks again", async () => {
    const h = harness([SUPPORTED]);
    await h.controller.run();

    expect(h.painted).toEqual([SUPPORTED]);
    // Well past the whole backoff schedule.
    await h.advance(1_000);
    expect(h.lookups()).toBe(1);
  });

  it("retries a non-definitive answer on the backoff schedule", async () => {
    const h = harness([UNKNOWN]);
    await h.controller.run();
    expect(h.lookups()).toBe(1);

    // Nothing before the first delay elapses.
    await h.advance(9);
    expect(h.lookups()).toBe(1);

    await h.advance(1);
    expect(h.lookups()).toBe(2);
    await h.advance(20);
    expect(h.lookups()).toBe(3);
    await h.advance(40);
    expect(h.lookups()).toBe(4);
  });

  it("stops once the backoff is exhausted", async () => {
    const h = harness([UNKNOWN]);
    await h.controller.run();

    await h.advance(10_000);
    expect(h.lookups()).toBe(1 + DELAYS.length);
  });

  it("stops retrying as soon as an answer resolves", async () => {
    const h = harness([UNKNOWN, UNKNOWN, NOT_SUPPORTED]);
    await h.controller.run();

    await h.advance(10_000);
    expect(h.lookups()).toBe(3);
    expect(h.painted).toEqual([UNKNOWN, UNKNOWN, NOT_SUPPORTED]);
  });

  it("drops a lookup issued while one is already in flight", async () => {
    let release!: (state: BadgeState) => void;
    const painted: BadgeState[] = [];
    let calls = 0;
    const controller = createStoreController({
      lookup: () => {
        calls += 1;
        return new Promise<BadgeState>((resolve) => {
          release = resolve;
        });
      },
      paint: (state) => painted.push(state),
      delays: DELAYS,
    });

    void controller.run();
    void controller.run();
    controller.recheck();
    expect(calls).toBe(1);

    release(SUPPORTED);
    await vi.advanceTimersByTimeAsync(0);
    expect(painted).toEqual([SUPPORTED]);
  });

  describe("retryPending", () => {
    it("re-asks and restarts the backoff while the answer is non-definitive", async () => {
      const h = harness([NEEDS_PERMISSION]);
      await h.controller.run();

      // Burn most of the schedule so the next delay would be the long one.
      await h.advance(10);
      await h.advance(20);
      expect(h.lookups()).toBe(3);

      h.controller.retryPending();
      await vi.advanceTimersByTimeAsync(0);
      expect(h.lookups()).toBe(4);

      // Back at the *first* delay, not the 40 it had climbed to.
      await h.advance(10);
      expect(h.lookups()).toBe(5);
    });

    it("does nothing once the answer is definitive", async () => {
      const h = harness([SUPPORTED]);
      await h.controller.run();

      h.controller.retryPending();
      await vi.advanceTimersByTimeAsync(0);
      expect(h.lookups()).toBe(1);
    });

    it("does nothing before the first answer arrives", async () => {
      const h = harness([SUPPORTED]);
      h.controller.retryPending();
      await vi.advanceTimersByTimeAsync(0);
      expect(h.lookups()).toBe(0);
    });

    it("revives a page whose backoff already gave up", async () => {
      // The user leaves a "click the toolbar icon" banner sitting for an hour,
      // then grants the permission and comes back. The backoff is long dead; the
      // focus/visibility retry is the only thing left, and it has to work.
      const h = harness([NEEDS_PERMISSION, NEEDS_PERMISSION, NEEDS_PERMISSION,
        NEEDS_PERMISSION, SUPPORTED]);
      await h.controller.run();
      await h.advance(10_000);
      expect(h.lookups()).toBe(1 + DELAYS.length);

      h.controller.retryPending();
      await vi.advanceTimersByTimeAsync(0);
      expect(h.painted.at(-1)).toEqual(SUPPORTED);
    });
  });

  describe("recheck", () => {
    it("re-asks even when the current answer is definitive", async () => {
      // A new catalog landed, so "not on GeForce NOW" may have just become wrong.
      const h = harness([NOT_SUPPORTED, SUPPORTED]);
      await h.controller.run();
      expect(h.painted).toEqual([NOT_SUPPORTED]);

      h.controller.recheck();
      await vi.advanceTimersByTimeAsync(0);
      expect(h.painted).toEqual([NOT_SUPPORTED, SUPPORTED]);
    });

    it("restarts the backoff rather than stacking a second timer chain", async () => {
      const h = harness([UNKNOWN]);
      await h.controller.run();
      await h.advance(10);
      expect(h.lookups()).toBe(2);

      h.controller.recheck();
      await vi.advanceTimersByTimeAsync(0);
      expect(h.lookups()).toBe(3);

      // One chain, from the first delay: exactly one more lookup at t+10, not two.
      await h.advance(10);
      expect(h.lookups()).toBe(4);
    });
  });

  it("treats a rejected lookup as retryable rather than dying", async () => {
    // shared/lookup.ts is contracted never to reject. If that ever breaks, an
    // escaping rejection inside a timer callback would silently end the backoff.
    let first = true;
    const painted: BadgeState[] = [];
    const controller = createStoreController({
      lookup: () => {
        if (first) {
          first = false;
          return Promise.reject(new Error("contract broken"));
        }
        return Promise.resolve(SUPPORTED);
      },
      paint: (state) => painted.push(state),
      delays: DELAYS,
    });

    await controller.run();
    expect(painted).toEqual([UNKNOWN]);

    await vi.advanceTimersByTimeAsync(10);
    expect(painted).toEqual([UNKNOWN, SUPPORTED]);
  });

  it("exposes the latest answer for repaints", async () => {
    const h = harness([SUPPORTED]);
    expect(h.controller.state()).toBeNull();
    await h.controller.run();
    expect(h.controller.state()).toEqual(SUPPORTED);
  });
});
