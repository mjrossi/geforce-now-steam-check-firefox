import type { BadgeState } from "../feed/resolve-state";
import { BADGE_CSS } from "./badge.css";
import { resolveBannerLinks } from "./gfn-link";

const STYLE_ID = "gfn-check-style";
const SVG_NS = "http://www.w3.org/2000/svg";

/** Records *which badge* an injected node is showing, as `stateStamp()` from
 *  resolve-state.ts. Both content scripts stamp it and compare against it to tell
 *  "already showing this" from "showing something stale" — a slot painted
 *  "couldn't check" while its lookup was pending, or a definitive answer a new
 *  catalog has since changed. One attribute name, one contract: it lives here
 *  because this module owns everything we inject into the page. */
export const STATE_ATTR = "data-gfn-state";

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

// Both failure states mean "the catalog fetch didn't work". They differ only in
// whether the feed grant is missing, which makes granting it worth *suggesting* —
// it bypasses any CORS problem. It is not worth asserting as the cause: the fetch
// works fine ungranted (feed-origin.ts), so the usual reason for landing here is
// simply that the network was down, and the older copy ("click the toolbar icon to
// enable checks") told those users to do something that would not have helped.
function bannerLabel(state: BadgeState): string {
  if (state.kind === "supported") return "Playable on GeForce NOW";
  if (state.kind === "not-supported") return "Not on GeForce NOW";
  if (state.kind === "needs-permission")
    return "GeForce NOW: couldn't check — the toolbar icon may help";
  return "GeForce NOW: couldn't check";
}

function pillLabel(state: BadgeState): string {
  if (state.kind === "supported") return state.rtx ? "GeForce NOW · RTX" : "GeForce NOW";
  if (state.kind === "not-supported") return "Not available";
  // No room in a pill to word a suggestion honestly, and a wishlist row is not
  // where that conversation belongs — the popup has space to explain.
  return "Couldn't check";
}

/** createElement + class + optional text — the shape every piece of badge
 *  chrome takes. Built this way, never from innerHTML, so `web-ext lint` stays
 *  clean and we need no asset or host permissions. */
function span(doc: Document, className: string, text?: string): HTMLElement {
  const el = doc.createElement("span");
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** The muted "web ↗" chip: the escape hatch for a supported game when the
 *  native app route is also on offer but the app may not be installed. Its own
 *  link, a sibling of the main one — nesting anchors is invalid. */
function webChip(doc: Document, webUrl: string): HTMLAnchorElement {
  const web = doc.createElement("a");
  web.className = "gfn-check-web";
  web.href = webUrl;
  web.target = "_blank";
  web.rel = "noopener noreferrer";
  web.textContent = "web ↗";
  web.title = "Open in the browser instead of the GeForce NOW app";
  return web;
}

/** Prominent full-width banner for a store page, placed near the title.
 *
 *  Supported games link out; everything else is inert. Firefox can't stream
 *  GFN (play.geforcenow.com blocks it as an unsupported browser), so the main
 *  click target prefers the *native app* route and a small "web ↗" chip keeps
 *  the browser link as the no-app fallback — a `geforcenow://` click is a dead
 *  end when the app isn't installed and extensions can't detect that.
 *
 *  See `resolveBannerLinks` for how stale caches degrade to fewer links. The
 *  root stays a <div> in all cases (two sibling links — nesting anchors is
 *  invalid), so placeBefore/placeAfter and the id-keyed re-injection are
 *  unaffected. */
export function renderStoreBanner(doc: Document, state: BadgeState): HTMLElement {
  const { appUrl, webUrl } = resolveBannerLinks(state);
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

  const logo = span(doc, "gfn-check-banner-logo");
  logo.appendChild(logoSvg(doc));
  main.appendChild(logo);
  main.appendChild(span(doc, "gfn-check-banner-text", bannerLabel(state)));

  if (state.kind === "supported" && state.rtx) {
    main.appendChild(span(doc, "gfn-check-rtx", "RTX"));
  }
  if (mainUrl !== null) {
    main.appendChild(span(doc, "gfn-check-play", appUrl !== null ? "Play" : "Play ↗"));
  }
  if (appUrl !== null && webUrl !== null) {
    el.appendChild(webChip(doc, webUrl));
  }
  return el;
}

/** Compact pill for a wishlist row. */
export function renderWishlistPill(doc: Document, state: BadgeState): HTMLElement {
  const el = span(doc, `gfn-check-pill gfn-check-pill--${modifier(state)}`);
  el.appendChild(span(doc, "gfn-check-dot"));
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
