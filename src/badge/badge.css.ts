/** Namespaced stylesheet for all injected badges. Every selector is prefixed
 *  `gfn-check-` so we never touch markup owned by Steam or other extensions. */
export const BADGE_CSS = `
.gfn-check-banner { display:flex; align-items:center; gap:10px; width:100%;
  box-sizing:border-box; margin:10px 0; padding:11px 14px; border-radius:6px;
  border-left:5px solid; font-size:15px; line-height:1.2;
  font-family:"Motiva Sans",Arial,Helvetica,sans-serif; }
.gfn-check-banner--ok { background:linear-gradient(90deg,#1c3409,#0c1a05);
  border-color:#76b900; color:#cdee87; }
.gfn-check-banner--no { background:#23272c; border-color:#707b85; color:#c6cdd4; }
.gfn-check-banner--unknown { background:#2a2410; border-color:#b8860b; color:#e6cd84; }
.gfn-check-banner-logo { width:24px; height:24px; flex:0 0 auto; }
.gfn-check-banner-logo svg { width:100%; height:100%; display:block; }
.gfn-check-banner-text { flex:1 1 auto; font-weight:bold; }
.gfn-check-banner--ok .gfn-check-banner-text { color:#8fd11a; }
.gfn-check-banner .gfn-check-rtx { flex:0 0 auto; background:#76b900; color:#000;
  font-size:11px; font-weight:bold; padding:2px 8px; border-radius:9px;
  letter-spacing:.5px; }

.gfn-check-pill { display:inline-flex; align-items:center; gap:5px; font-size:12px;
  padding:3px 9px; border-radius:10px; white-space:nowrap; font-weight:bold;
  font-family:Arial,Helvetica,sans-serif; }
.gfn-check-pill--ok { background:#0c1a05; border:1px solid #76b900; color:#8fd11a; }
.gfn-check-pill--no { background:#23272c; border:1px solid #707b85; color:#c6cdd4; }
.gfn-check-pill--unknown { background:#2a2410; border:1px solid #b8860b; color:#e6cd84; }
.gfn-check-dot { width:7px; height:7px; border-radius:50%; flex:0 0 auto; }
.gfn-check-pill--ok .gfn-check-dot { background:#76b900; }
.gfn-check-pill--no .gfn-check-dot { background:#9aa5af; }
.gfn-check-pill--unknown .gfn-check-dot { background:#b8860b; }

/* Wishlist: overlay the pill in the bottom-right corner of the capsule. The
   pill is non-interactive so the capsule stays fully clickable underneath. */
.gfn-check-anchor { position:relative; }
.gfn-check-pill-slot--overlay { position:absolute; right:8px; bottom:8px; z-index:3;
  pointer-events:none; }
.gfn-check-pill-slot--overlay .gfn-check-pill { box-shadow:0 1px 4px rgba(0,0,0,.55); }
`;
