import { describe, expect, test } from "vitest";
import manifest from "../src/manifest.json";
import { FEED_ORIGINS, STEAM_ORIGINS } from "../src/shared/feed-origin";

// feed-origin.ts carries the origin lists the whole extension reasons about, and
// the manifest carries the ones Firefox acts on. They were kept in agreement by a
// "keep in sync" comment, which nothing enforced — and drift here is silent and
// expensive: narrow a content script match and hasStandingSteamAccess() starts
// answering a question about a different set of pages than the scripts run on,
// showing a green light (or clearing the `!` badge) on a browser where no badge
// can appear. That exact class of mistake cost a release once already.
describe("origin constants match the manifest", () => {
  test("FEED_ORIGINS is the declared host_permissions", () => {
    expect([...FEED_ORIGINS].sort()).toEqual([...manifest.host_permissions].sort());
  });

  test("STEAM_ORIGINS is what the content scripts are declared against", () => {
    const matches = manifest.content_scripts.flatMap((cs) => cs.matches);
    expect([...STEAM_ORIGINS].sort()).toEqual([...new Set(matches)].sort());
  });

  // requestSteamAccess() is only legal for origins the manifest marks requestable;
  // a content_scripts match alone does not count. If these fall out of step the
  // popup's one-click exit from click-to-run silently stops working.
  test("STEAM_ORIGINS is requestable via optional_host_permissions", () => {
    expect([...STEAM_ORIGINS].sort()).toEqual([...manifest.optional_host_permissions].sort());
  });
});
