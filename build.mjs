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
  },
  outdir,
  bundle: true,
  format: "iife",          // content/background scripts run as classic scripts
  target: "firefox115",
  logLevel: "info",
});

await cp("src/manifest.json", `${outdir}/manifest.json`);
await cp("icons", `${outdir}/icons`, { recursive: true });
console.log("built ->", outdir);
