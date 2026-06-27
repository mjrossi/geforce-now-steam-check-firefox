// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import {
  APP_ID_ATTR,
  PILL_SLOT,
  findRows,
  paint,
  rowContainer,
} from "../src/content/wishlist-rows";

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

  test("overlays the pill on the capsule when the row has one", () => {
    document.body.innerHTML = `<div class="card"><a href="${link(10)}"><img src="${cap(10)}"></a></div>`;
    const row = document.querySelector<HTMLElement>(".card")!;
    paint(document, new Map([[10, row]]), pill);
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
    paint(document, new Map([[10, row]]), pill);
    const slot = row.querySelector<HTMLElement>(`.${PILL_SLOT}`)!;
    expect(slot.classList.contains(`${PILL_SLOT}--overlay`)).toBe(false);
    expect(slot.parentElement).toBe(row);
  });

  test("badges a row once and is idempotent across re-runs", () => {
    document.body.innerHTML = `<div class="card"><a href="${link(10)}">A</a></div>`;
    const row = document.querySelector<HTMLElement>(".card")!;
    const rows = new Map([[10, row]]);
    paint(document, rows, pill);
    paint(document, rows, pill);
    expect(row.querySelectorAll(`.${PILL_SLOT}`)).toHaveLength(1);
    expect(row.querySelector(`.${PILL_SLOT}`)!.getAttribute(APP_ID_ATTR)).toBe("10");
  });

  test("re-badges a recycled container when the app id changes", () => {
    document.body.innerHTML = `<div class="card"><a href="${link(10)}">A</a></div>`;
    const row = document.querySelector<HTMLElement>(".card")!;
    paint(document, new Map([[10, row]]), pill);
    // Same container, now showing a different game (virtualized recycle).
    paint(document, new Map([[20, row]]), pill);
    const slots = row.querySelectorAll(`.${PILL_SLOT}`);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.getAttribute(APP_ID_ATTR)).toBe("20");
    expect(slots[0]!.textContent).toBe("pill-20");
  });
});
