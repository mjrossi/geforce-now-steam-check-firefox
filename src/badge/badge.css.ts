/** Namespaced stylesheet for all injected badges. Every selector is prefixed
 *  `gfn-check-` so we never touch markup owned by Steam or other extensions. */
export const BADGE_CSS = `
.gfn-check-badge { display:inline-flex; align-items:center; gap:7px; padding:6px 10px;
  border-radius:4px; font-size:12px; font-family:Arial,Helvetica,sans-serif;
  box-sizing:border-box; }
.gfn-check-badge--ok { background:#0c1a05; border:1px solid #76b900; color:#fff; }
.gfn-check-badge--no, .gfn-check-badge--unknown { background:#171a1d;
  border:1px solid #3a444d; color:#8f98a0; }
.gfn-check-dot { width:8px; height:8px; border-radius:50%; flex:0 0 auto; }
.gfn-check-badge--ok .gfn-check-dot { background:#76b900; }
.gfn-check-badge--no .gfn-check-dot, .gfn-check-badge--unknown .gfn-check-dot { background:#5a6b7c; }
.gfn-check-label { font-weight:bold; }
.gfn-check-badge--ok .gfn-check-label { color:#76b900; }
.gfn-check-rtx { margin-left:auto; background:#76b900; color:#000; font-size:9px;
  font-weight:bold; padding:1px 6px; border-radius:8px; letter-spacing:.5px; }
.gfn-check-pill { display:inline-flex; align-items:center; gap:5px; font-size:11px;
  padding:3px 8px; border-radius:10px; white-space:nowrap;
  font-family:Arial,Helvetica,sans-serif; }
.gfn-check-pill--ok { background:#0c1a05; border:1px solid #76b900; color:#76b900; }
.gfn-check-pill--no, .gfn-check-pill--unknown { background:#171a1d;
  border:1px solid #3a444d; color:#8f98a0; }
.gfn-check-pill .gfn-check-dot { width:6px; height:6px; }
.gfn-check-pill--ok .gfn-check-dot { background:#76b900; }
`;
