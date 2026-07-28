import { describe, expect, it } from "vitest";
import { createStateMemo } from "../src/content/wishlist-memo";
import type { BadgeState } from "../src/feed/resolve-state";

const SUPPORTED: BadgeState = { kind: "supported", rtx: true };
const NOT_SUPPORTED: BadgeState = { kind: "not-supported" };
const UNKNOWN: BadgeState = { kind: "unknown" };
const NEEDS_PERMISSION: BadgeState = { kind: "needs-permission" };

describe("createStateMemo", () => {
  it("asks about every row on the first pass", () => {
    const memo = createStateMemo();
    expect(memo.pending([570, 730, 440])).toEqual([570, 730, 440]);
  });

  it("stops asking about definitively answered rows", () => {
    // The whole point: scrolling a virtualized wishlist re-runs constantly, and
    // our own pill injection wakes the observer that schedules the next run.
    const memo = createStateMemo();
    memo.remember(570, SUPPORTED);
    memo.remember(730, NOT_SUPPORTED);

    expect(memo.pending([570, 730])).toEqual([]);
  });

  it("keeps asking about rows that only got a transient answer", () => {
    // "unknown" (offline / background asleep) and "needs-permission" mean "not
    // yet", not "no" — memoizing them would freeze a badge that could self-heal.
    const memo = createStateMemo();
    memo.remember(570, UNKNOWN);
    memo.remember(730, NEEDS_PERMISSION);

    expect(memo.pending([570, 730])).toEqual([570, 730]);
  });

  it("asks only about newly visible rows", () => {
    const memo = createStateMemo();
    memo.remember(570, SUPPORTED);

    expect(memo.pending([570, 730])).toEqual([730]);
  });

  it("renders 'couldn't check' until a real answer arrives", () => {
    const memo = createStateMemo();
    expect(memo.stateFor(570)).toEqual(UNKNOWN);

    memo.remember(570, UNKNOWN);
    expect(memo.stateFor(570)).toEqual(UNKNOWN);
  });

  it("returns the remembered answer once resolved", () => {
    const memo = createStateMemo();
    memo.remember(570, SUPPORTED);
    expect(memo.stateFor(570)).toEqual(SUPPORTED);
  });

  it("upgrades a transient state to a definitive one", () => {
    // A row painted "couldn't check" must be replaceable once the lookup
    // resolves — this is the memo half of that; wishlist-rows.ts's data-gfn-state
    // stamp is the DOM half.
    const memo = createStateMemo();
    memo.remember(570, UNKNOWN);
    expect(memo.stateFor(570)).toEqual(UNKNOWN);

    memo.remember(570, SUPPORTED);
    expect(memo.stateFor(570)).toEqual(SUPPORTED);
    expect(memo.pending([570])).toEqual([]);
  });

  it("keeps memos independent per instance", () => {
    // One memo per tab; nothing may leak between them.
    const a = createStateMemo();
    const b = createStateMemo();
    a.remember(570, SUPPORTED);

    expect(b.pending([570])).toEqual([570]);
    expect(b.stateFor(570)).toEqual(UNKNOWN);
  });
});
