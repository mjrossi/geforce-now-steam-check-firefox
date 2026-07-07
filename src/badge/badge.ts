import type { BadgeState } from "../feed/resolve-state";
import { BADGE_CSS } from "./badge.css";
import { gfnAppUrl, gfnPlayUrl } from "./gfn-link";

const STYLE_ID = "gfn-check-style";
const SVG_NS = "http://www.w3.org/2000/svg";

/** GFN mark, mirrors icons/icon.svg. Built via DOM (not innerHTML) so it needs
 *  no asset/host perms and stays clear of unsafe-assignment lint. */
function logoSvg(doc: Document): SVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 96 96");
  svg.setAttribute("aria-hidden", "true");
  const rect = doc.createElementNS(SVG_NS, "rect");
  rect.setAttribute("width", "96");
  rect.setAttribute("height", "96");
  rect.setAttribute("rx", "18");
  rect.setAttribute("fill", "#0c1a05");
  const circle = doc.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", "48");
  circle.setAttribute("cy", "48");
  circle.setAttribute("r", "20");
  circle.setAttribute("fill", "#76b900");
  svg.append(rect, circle);
  return svg;
}

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

function bannerLabel(state: BadgeState): string {
  if (state.kind === "supported") return "Playable on GeForce NOW";
  if (state.kind === "not-supported") return "Not on GeForce NOW";
  if (state.kind === "needs-permission")
    return "GeForce NOW: click the toolbar icon to enable checks";
  return "GeForce NOW: couldn't check";
}

function pillLabel(state: BadgeState): string {
  if (state.kind === "supported") return state.rtx ? "GeForce NOW · RTX" : "GeForce NOW";
  if (state.kind === "not-supported") return "Not available";
  if (state.kind === "needs-permission") return "Enable in toolbar";
  return "Couldn't check";
}

function dot(doc: Document): HTMLElement {
  const d = doc.createElement("span");
  d.className = "gfn-check-dot";
  return d;
}

/** Prominent full-width banner for a store page, placed near the title.
 *
 *  Supported games link out; everything else is inert. Firefox can't stream
 *  GFN (play.geforcenow.com blocks it as an unsupported browser), so the main
 *  click target prefers the *native app* route and a small "web ↗" chip keeps
 *  the browser link as the no-app fallback — a `geforcenow://` click is a dead
 *  end when the app isn't installed and extensions can't detect that.
 *
 *  Degradation on stale caches served after a failed refetch: v2 entry (gfnId
 *  only) → single web link; pre-v2 entry (no ids) → plain non-clickable div.
 *  The root stays a <div> in all cases (two sibling links — nesting anchors is
 *  invalid), so placeBefore/placeAfter and the id-keyed re-injection are
 *  unaffected. */
export function renderStoreBanner(doc: Document, state: BadgeState): HTMLElement {
  const appUrl =
    state.kind === "supported" && state.gfnId !== undefined && state.cmsId !== undefined
      ? gfnAppUrl(state.cmsId, state.gfnId)
      : null;
  const webUrl =
    state.kind === "supported" && state.gfnId !== undefined ? gfnPlayUrl(state.gfnId) : null;
  const mainUrl = appUrl ?? webUrl;

  const el = doc.createElement("div");
  el.className = `gfn-check-banner gfn-check-banner--${modifier(state)}${
    mainUrl !== null ? " gfn-check-banner--link" : ""
  }`;

  // Everything except the web chip goes inside `main`: the whole banner face
  // is the primary click target when linked.
  let main: HTMLElement = el;
  if (mainUrl !== null) {
    const a = doc.createElement("a");
    a.className = "gfn-check-banner-main";
    a.href = mainUrl;
    if (appUrl === null) {
      // Web link: open the GFN web app in its own tab. The app route instead
      // stays targetless — Firefox hands the custom scheme to the OS without
      // leaving the page.
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    el.appendChild(a);
    main = a;
  }

  const logo = doc.createElement("span");
  logo.className = "gfn-check-banner-logo";
  logo.appendChild(logoSvg(doc));
  main.appendChild(logo);

  const text = doc.createElement("span");
  text.className = "gfn-check-banner-text";
  text.textContent = bannerLabel(state);
  main.appendChild(text);

  if (state.kind === "supported" && state.rtx) {
    const rtx = doc.createElement("span");
    rtx.className = "gfn-check-rtx";
    rtx.textContent = "RTX";
    main.appendChild(rtx);
  }

  if (mainUrl !== null) {
    const play = doc.createElement("span");
    play.className = "gfn-check-play";
    play.textContent = appUrl !== null ? "Play" : "Play ↗";
    main.appendChild(play);
  }

  if (appUrl !== null && webUrl !== null) {
    const web = doc.createElement("a");
    web.className = "gfn-check-web";
    web.href = webUrl;
    web.target = "_blank";
    web.rel = "noopener noreferrer";
    web.textContent = "web ↗";
    web.title = "Open in the browser instead of the GeForce NOW app";
    el.appendChild(web);
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

/** Insert `badge` immediately after the first element matching `anchorSelector`
 *  (idempotent on badge.id). Returns true if anchored, false if no match. */
export function placeAfter(doc: Document, anchorSelector: string, badge: HTMLElement): boolean {
  if (badge.id) doc.getElementById(badge.id)?.remove();
  const anchor = doc.querySelector(anchorSelector);
  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(badge, anchor.nextSibling);
    return true;
  }
  return false;
}
