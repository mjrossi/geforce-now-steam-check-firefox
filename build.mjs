import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const outdir = "dist";
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await esbuild.build({
  entryPoints: {
    background: "src/background/feed-service.ts",
    store: "src/content/store.ts",
    wishlist: "src/content/wishlist.ts",
    popup: "src/popup/popup.ts",
    onboarding: "src/onboarding/onboarding.ts",
  },
  outdir,
  bundle: true,
  format: "iife",          // content/background scripts run as classic scripts
  target: "firefox120",
  logLevel: "info",
});

await cp("src/manifest.json", `${outdir}/manifest.json`);
await cp("icons", `${outdir}/icons`, { recursive: true });
// Extension pages are plain HTML that load their bundled <script src> sibling.
await cp("src/popup/popup.html", `${outdir}/popup.html`);
await cp("src/onboarding/onboarding.html", `${outdir}/onboarding.html`);
console.log("built ->", outdir);
