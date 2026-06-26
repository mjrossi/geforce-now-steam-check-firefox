/** One entry of NVIDIA's public GFN supported-games feed
 *  (https://static.nvidiagrid.net/supported-public-game-list/locales/gfnpc-en-US.json). */
export interface GfnFeedEntry {
  id: number;
  title: string;
  sortName: string;
  isFullyOptimized: boolean;
  steamUrl: string;
  store: string;
  publisher: string;
  genres: string[];
  status: string;
}

/** Lookup index keyed by Steam app id (string). Only GFN-supported Steam games
 *  appear. Record form serializes cleanly into browser.storage.local. */
export type GfnIndex = Record<string, { rtx: boolean }>;
