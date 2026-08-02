// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import { APP_ID_ATTR, PILL_SLOT, findRows, paint, rowContainer } from "../src/content/wishlist-rows";
import { STATE_ATTR } from "../src/badge/badge";

beforeEach(() => {
  document.body.innerHTML = "";
});

const cap = (id: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/capsule.jpg`;
const link = (id: number) => `/app/${id}/Some_Game/`;

describe("findRows — legacy layout", () => {
  test("one row per .wishlist_row, keyed by its app id", () => {
    document.body.innerHTML = `
      <div id="wishlist_ctn">
        <div class="wishlist_row"><a href="${link(10)}">A</a></div>
        <div class="wishlist_row"><a href="${link(20)}">B</a></div>
      </div>`;
    const rows = findRows(document.body);
    expect([...rows.keys()].sort((a, b) => a - b)).toEqual([10, 20]);
    expect(rows.get(10)!.classList.contains("wishlist_row")).toBe(true);
  });
});

describe("findRows — modern (virtualized) layout", () => {
  test("derives one container per game; sibling cards are not merged", () => {
    document.body.innerHTML = `
      <div id="list">
        <div class="card"><a href="${link(10)}"><img src="${cap(10)}"></a><span>A</span></div>
        <div class="card"><a href="${link(20)}"><img src="${cap(20)}"></a><span>B</span></div>
      </div>`;
    const rows = findRows(document.body);
    expect([...rows.keys()].sort((a, b) => a - b)).toEqual([10, 20]);
    // Each row is its own card (the climb stops before the shared #list parent).
    const a = rows.get(10)!;
    const b = rows.get(20)!;
    expect(a).not.toBe(b);
    expect(a.classList.contains("card")).toBe(true);
    expect(a.contains(b)).toBe(false);
  });

  test("seeds from a capsule image when there is no app anchor", () => {
    document.body.innerHTML = `<div class="card"><img src="${cap(620)}"></div>`;
    const rows = findRows(document.body);
    expect([...rows.keys()]).toEqual([620]);
  });

  test("dedupes multiple references to the same game", () => {
    document.body.innerHTML = `
      <div class="card"><a href="${link(10)}">art</a><a href="${link(10)}">title</a></div>`;
    const rows = findRows(document.body);
    expect([...rows.keys()]).toEqual([10]);
  });

  test("a second app link (e.g. DLC) stops the climb at the single-game block", () => {
    // The card references two games; neither seed should climb up to the card.
    document.body.innerHTML = `
      <div class="card">
        <div class="main"><a href="${link(10)}">Game</a></div>
        <div class="dlc"><a href="${link(99)}">DLC for another game</a></div>
      </div>`;
    const rows = findRows(document.body);
    expect(rows.get(10)!.classList.contains("main")).toBe(true);
    expect(rows.get(10)!.classList.contains("card")).toBe(false);
  });

  test("ignores app links inside Steam chrome (global header / footer)", () => {
    document.body.innerHTML = `
      <div id="global_header"><a href="${link(111)}">store nav</a></div>
      <div class="footerv2"><a href="${link(222)}">footer</a></div>
      <div class="card"><a href="${link(10)}"><img src="${cap(10)}"></a></div>`;
    const rows = findRows(document.body);
    expect([...rows.keys()]).toEqual([10]);
  });
});

// An element holds one pill slot, so two ids mapped to the same element both
// claim it: paint() reads the other's slot as stale and swaps in its own, leaving
// the row showing the wrong game and re-swapping on every pass — which wakes the
// observer that schedules the next one. findRows drops the later claim instead.
describe("findRows — one element badges at most one game", () => {
  test("a legacy row naming a second game keeps only its own", () => {
    document.body.innerHTML = `
      <div id="wishlist_ctn">
        <div class="wishlist_row">
          <a href="${link(10)}"><img src="${cap(10)}"></a>
          <a href="${link(99)}">also in this bundle</a>
        </div>
      </div>`;
    const rows = findRows(document.body);
    expect([...rows.keys()]).toEqual([10]);
  });

  test("an anchor whose nested capsule names a different game keeps the href's", () => {
    // The link seeds 10 and stops climbing at the anchor (its parent holds two
    // ids); the image seeds 99 and climbs *into* that same anchor. The href is
    // the authoritative id, which is why links are seeded first.
    document.body.innerHTML = `
      <div id="list">
        <div class="card"><a href="${link(10)}"><img src="${cap(99)}"></a></div>
      </div>`;
    const rows = findRows(document.body);
    expect([...rows.keys()]).toEqual([10]);
  });

  test("the resulting rows repaint without churning the DOM", () => {
    document.body.innerHTML = `
      <div id="wishlist_ctn">
        <div class="wishlist_row">
          <a href="${link(10)}"><img src="${cap(10)}"></a>
          <a href="${link(99)}">also in this bundle</a>
        </div>
      </div>`;
    const rows = findRows(document.body);
    const pill = (id: number) => {
      const el = document.createElement("b");
      el.textContent = `pill-${String(id)}`;
      return el;
    };
    const settled = () => "supported";

    paint(document, rows, pill, settled);
    const slots = document.querySelectorAll(`.${PILL_SLOT}`);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.getAttribute(APP_ID_ATTR)).toBe("10");

    // A settled row must not mutate again, or the MutationObserver driving run()
    // is re-armed by our own paint and the page never comes to rest.
    const observer = new MutationObserver(() => undefined);
    observer.observe(document.body, { childList: true, subtree: true });
    paint(document, rows, pill, settled);
    const touched = observer
      .takeRecords()
      .reduce((n, r) => n + r.addedNodes.length + r.removedNodes.length, 0);
    observer.disconnect();
    expect(touched).toBe(0);
  });
});

describe("rowContainer", () => {
  test("does not climb past the provided root", () => {
    document.body.innerHTML = `<div id="root"><div class="block"><a href="${link(10)}">x</a></div></div>`;
    const root = document.getElementById("root")!;
    const seed = root.querySelector<HTMLElement>("a")!;
    const container = rowContainer(seed, 10, root);
    // Climbs to .block (single-game) but never to #root itself.
    expect(container.classList.contains("block")).toBe(true);
  });
});

describe("paint — idempotency & recycled rows", () => {
  const pill = (id: number) => {
    const el = document.createElement("b");
    el.textContent = `pill-${id}`;
    return el;
  };
  // These cases vary the app id, not the badge, so every row is stamped the same.
  const settled = () => "supported";

  test("overlays the pill on the capsule when the row has one", () => {
    document.body.innerHTML = `<div class="card"><a href="${link(10)}"><img src="${cap(10)}"></a></div>`;
    const row = document.querySelector<HTMLElement>(".card")!;
    paint(document, new Map([[10, row]]), pill, settled);
    const slot = row.querySelector<HTMLElement>(`.${PILL_SLOT}`)!;
    expect(slot.classList.contains(`${PILL_SLOT}--overlay`)).toBe(true);
    // the capsule's container becomes the positioning context and holds the slot
    const host = row.querySelector("img")!.parentElement!;
    expect(host.classList.contains("gfn-check-anchor")).toBe(true);
    expect(host.contains(slot)).toBe(true);
  });

  test("falls back to appending to the row when there is no capsule", () => {
    document.body.innerHTML = `<div class="card"><a href="${link(10)}">A</a></div>`;
    const row = document.querySelector<HTMLElement>(".card")!;
    paint(document, new Map([[10, row]]), pill, settled);
    const slot = row.querySelector<HTMLElement>(`.${PILL_SLOT}`)!;
    expect(slot.classList.contains(`${PILL_SLOT}--overlay`)).toBe(false);
    expect(slot.parentElement).toBe(row);
  });

  test("badges a row once and is idempotent across re-runs", () => {
    document.body.innerHTML = `<div class="card"><a href="${link(10)}">A</a></div>`;
    const row = document.querySelector<HTMLElement>(".card")!;
    const rows = new Map([[10, row]]);
    paint(document, rows, pill, settled);
    paint(document, rows, pill, settled);
    expect(row.querySelectorAll(`.${PILL_SLOT}`)).toHaveLength(1);
    expect(row.querySelector(`.${PILL_SLOT}`)!.getAttribute(APP_ID_ATTR)).toBe("10");
  });

  test("re-badges a recycled container when the app id changes", () => {
    document.body.innerHTML = `<div class="card"><a href="${link(10)}">A</a></div>`;
    const row = document.querySelector<HTMLElement>(".card")!;
    paint(document, new Map([[10, row]]), pill, settled);
    // Same container, now showing a different game (virtualized recycle).
    paint(document, new Map([[20, row]]), pill, settled);
    const slots = row.querySelectorAll(`.${PILL_SLOT}`);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.getAttribute(APP_ID_ATTR)).toBe("20");
    expect(slots[0]!.textContent).toBe("pill-20");
  });

  // The wishlist paints rows as "couldn't check" while their lookup is still
  // pending. Without the state stamp the app id would match on the next run and
  // the placeholder would never be replaced.
  test("replaces the badge when the same app id resolves to a new state", () => {
    document.body.innerHTML = `<div class="card"><a href="${link(10)}">A</a></div>`;
    const row = document.querySelector<HTMLElement>(".card")!;
    const rows = new Map([[10, row]]);
    const labelled = (state: string) => (id: number) => {
      const el = document.createElement("b");
      el.textContent = `${state}-${String(id)}`;
      return el;
    };

    paint(document, rows, labelled("unknown"), () => "unknown");
    expect(row.querySelector(`.${PILL_SLOT}`)!.textContent).toBe("unknown-10");

    paint(document, rows, labelled("supported"), () => "supported");
    const slots = row.querySelectorAll(`.${PILL_SLOT}`);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.textContent).toBe("supported-10");
    expect(slots[0]!.getAttribute(STATE_ATTR)).toBe("supported");
  });

  test("leaves a slot alone when both the app id and the state are unchanged", () => {
    document.body.innerHTML = `<div class="card"><a href="${link(10)}">A</a></div>`;
    const row = document.querySelector<HTMLElement>(".card")!;
    const rows = new Map([[10, row]]);
    paint(document, rows, pill, () => "supported");
    const first = row.querySelector(`.${PILL_SLOT}`);
    paint(document, rows, pill, () => "supported");
    expect(row.querySelector(`.${PILL_SLOT}`)).toBe(first); // same node, not re-created
  });
});
