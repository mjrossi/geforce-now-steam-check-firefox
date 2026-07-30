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
});
