import { describe, expect, test } from "vitest";
import { coalesce } from "../src/shared/coalesce";

/** A task whose completion the test controls, so "while it runs" is expressible. */
function gate() {
  let release = (): void => undefined;
  let fail = (_err: Error): void => undefined;
  let calls = 0;
  const task = () => {
    calls += 1;
    return new Promise<void>((resolve, reject) => {
      release = resolve;
      fail = reject;
    });
  };
  return {
    task,
    calls: () => calls,
    release: () => {
      release();
      return Promise.resolve();
    },
    fail: (err: Error) => {
      fail(err);
      return Promise.resolve();
    },
  };
}

describe("coalesce", () => {
  test("runs the task", async () => {
    const g = gate();
    const run = coalesce(g.task);
    const done = run();
    expect(g.calls()).toBe(1);
    await g.release();
    await done;
  });

  test("does not re-enter while the task is in flight", async () => {
    const g = gate();
    const run = coalesce(g.task);
    const first = run();
    void run();
    void run();
    expect(g.calls()).toBe(1); // still just the one, mid-flight
    await g.release();
    await g.release(); // the single follow-up the two requests collapsed into
    await first;
  });

  test("requests arriving mid-flight collapse into exactly one follow-up run", async () => {
    // The wishlist case: several mutation batches land during one slow lookup.
    // One later run re-reads the DOM and the memo from scratch, so it subsumes
    // every request that queued behind it.
    const g = gate();
    const run = coalesce(g.task);
    const first = run();
    void run();
    void run();
    void run();

    await g.release(); // first settles; the queued follow-up starts
    expect(g.calls()).toBe(2);
    await g.release(); // follow-up settles; nothing further is queued
    await first;
    expect(g.calls()).toBe(2);
  });

  test("a request arriving mid-flight is never dropped", async () => {
    // The store case: a catalog epoch landing during a lookup is the one trigger
    // that must survive, since a new catalog is what invalidates the badge.
    const g = gate();
    const run = coalesce(g.task);
    const first = run();
    void run(); // "new catalog published"
    await g.release();
    expect(g.calls()).toBe(2);
    await g.release();
    await first;
  });

  test("runs again for a request that arrives after the task settled", async () => {
    const g = gate();
    const run = coalesce(g.task);
    const first = run();
    await g.release();
    await first;
    const second = run();
    expect(g.calls()).toBe(2);
    await g.release();
    await second;
  });

  test("a rejecting task clears the in-flight flag so the next trigger still runs", async () => {
    const g = gate();
    const run = coalesce(g.task);
    const first = run();
    await g.fail(new Error("boom"));
    await expect(first).rejects.toThrow("boom");

    const second = run(); // not wedged
    expect(g.calls()).toBe(2);
    await g.release();
    await second;
  });

  test("a rejecting task clears the queued flag too", async () => {
    // The queued run is skipped on rejection, but the flag has to go with it:
    // leaving it set made the *next* trigger run the task a second time, long
    // after the request that queued it was abandoned.
    const g = gate();
    const run = coalesce(g.task);
    const first = run();
    void run(); // queues behind the run that is about to fail
    await g.fail(new Error("boom"));
    await expect(first).rejects.toThrow("boom");
    expect(g.calls()).toBe(1); // the queued run was skipped, as documented

    const second = run();
    expect(g.calls()).toBe(2);
    await g.release();
    // Assert before awaiting `second`: a stale flag re-runs the task here, and the
    // re-run never settles (the gate's resolver has moved on), so awaiting first
    // would turn a clear "3 calls, expected 2" into a test timeout.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(g.calls()).toBe(2); // not re-run by a flag left over from the failure
    await second;
  });
});
