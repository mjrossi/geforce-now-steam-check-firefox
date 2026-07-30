import type { BackgroundRequest } from "./messages";
import { log } from "./log";

/** Send a request to the background, resolving to `undefined` when it can't be
 *  reached. **Never rejects**, and every caller depends on that.
 *
 *  `browser.runtime.sendMessage` throws when there is no live receiver — the MV3
 *  background is an event page, so browser startup and extension update/reload
 *  windows both land there. Unhandled, that produced no badge at all in a content
 *  script (plus an unhandled rejection) and stranded the popup on its placeholder
 *  text. Degrading is both honest and the state the UI already renders.
 *
 *  It also *resolves* with `undefined` when a listener declines the message, which
 *  is what an older background does mid-update for a message type it has never
 *  heard of — so callers validate the reply with the guards in messages.ts rather
 *  than casting it. `undefined` therefore covers both "couldn't ask" cases, which
 *  is the only distinction any caller needs. */
export async function sendToBackground(req: BackgroundRequest): Promise<unknown> {
  try {
    return await browser.runtime.sendMessage(req);
  } catch (err) {
    log.warn(`background unreachable (${req.type}) —`, err);
    return undefined;
  }
}
