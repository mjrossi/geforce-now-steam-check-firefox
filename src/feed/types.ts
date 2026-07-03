/** Shapes from NVIDIA's GeForce NOW catalog GraphQL API
 *  (POST https://games.geforce.com/graphql, the source the GFN web app uses).
 *  We only model the fields we consume. */

/** A per-game capability flag, e.g. `{ key: "RTX_ENABLED", value: "true" }`.
 *  Returned as a `GfnSubscriptionFeatureValue`; other feature kinds in the union
 *  serialize without key/value, hence both are optional. */
export interface GfnFeature {
  key?: string;
  value?: string;
}

/** One storefront listing of a game (Steam, Epic, Xbox, …). `storeUrl` embeds
 *  the store's app id; for Steam it is a `…/app/<id>` URL. */
export interface GfnVariant {
  appStore: string;
  storeUrl: string | null;
  gfn: { features: GfnFeature[] | null } | null;
}

/** One GFN-supported game, with a listing per storefront it's playable from. */
export interface GfnApp {
  id: string;
  title: string;
  variants: GfnVariant[] | null;
}

/** One indexed game. `gfnId` is the catalog app UUID, used to build the
 *  play.geforcenow.com deep link; optional because a stale pre-v2 cache served
 *  after a failed refetch lacks it (the banner then degrades to non-clickable). */
export interface GfnIndexEntry {
  rtx: boolean;
  gfnId?: string;
}

/** Lookup index keyed by Steam app id (string). Only GFN-supported Steam games
 *  appear. Record form serializes cleanly into browser.storage.local. */
export type GfnIndex = Record<string, GfnIndexEntry>;
