import type { BadgeState } from "../feed/resolve-state";
import { BADGE_CSS } from "./badge.css";

const STYLE_ID = "gfn-check-style";

/** Inject the shared badge stylesheet once per document. */
export function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = BADGE_CSS;
  (doc.head ?? doc.documentElement).appendChild(style);
}

function modifier(state: BadgeState): "ok" | "no" | "unknown" {
  if (state.kind === "supported") return "ok";
  if (state.kind === "not-supported") return "no";
  return "unknown";
}

function sidebarLabel(state: BadgeState): string {
  if (state.kind === "supported") return "On GeForce NOW";
  if (state.kind === "not-supported") return "Not on GeForce NOW";
  return "GeForce NOW: couldn't check";
}

function pillLabel(state: BadgeState): string {
  if (state.kind === "supported") return state.rtx ? "GeForce NOW · RTX" : "GeForce NOW";
  if (state.kind === "not-supported") return "Not available";
  return "Couldn't check";
}

function dot(doc: Document): HTMLElement {
  const d = doc.createElement("span");
  d.className = "gfn-check-dot";
  return d;
}

/** Full-size sidebar badge for a store page. */
export function renderSidebarBadge(doc: Document, state: BadgeState): HTMLElement {
  const el = doc.createElement("div");
  el.className = `gfn-check-badge gfn-check-badge--${modifier(state)}`;
  el.appendChild(dot(doc));
  const label = doc.createElement("span");
  label.className = "gfn-check-label";
  label.textContent = sidebarLabel(state);
  el.appendChild(label);
  if (state.kind === "supported" && state.rtx) {
    const rtx = doc.createElement("span");
    rtx.className = "gfn-check-rtx";
    rtx.textContent = "RTX";
    el.appendChild(rtx);
  }
  return el;
}

/** Compact pill for a wishlist row. */
export function renderWishlistPill(doc: Document, state: BadgeState): HTMLElement {
  const el = doc.createElement("span");
  el.className = `gfn-check-pill gfn-check-pill--${modifier(state)}`;
  el.appendChild(dot(doc));
  const label = doc.createElement("span");
  label.textContent = pillLabel(state);
  el.appendChild(label);
  return el;
}

/** Insert `badge` immediately before the first element matching `anchorSelector`,
 *  removing any prior element that shares badge.id (idempotent re-injection).
 *  Returns true if anchored, false if it fell back to <body>. We only ever touch
 *  our own node. */
export function placeBefore(doc: Document, anchorSelector: string, badge: HTMLElement): boolean {
  if (badge.id) doc.getElementById(badge.id)?.remove();
  const anchor = doc.querySelector(anchorSelector);
  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(badge, anchor);
    return true;
  }
  (doc.body ?? doc.documentElement).appendChild(badge);
  return false;
}
