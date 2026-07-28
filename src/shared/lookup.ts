import type { LookupRequest, LookupResponse } from "./messages";
import { log } from "./log";

/** The response we synthesize when the background can't be reached at all.
 *  `resolveState` maps this to "unknown" → the "couldn't check" badge, which is
 *  exactly right: we genuinely don't know, and must never claim "not supported". */
const UNREACHABLE: LookupResponse = { ok: false, found: {}, reason: "network" };

function isLookupResponse(value: unknown): value is LookupResponse {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Partial<LookupResponse>;
  return typeof r.ok === "boolean" && typeof r.found === "object" && r.found !== null;
}

/** Ask the background which of `appIds` are on GeForce NOW.
 *
 *  Never rejects. `browser.runtime.sendMessage` throws when there is no live
 *  receiver — the MV3 background is an event page, so a content script that
 *  messages during browser startup, or across an extension update/reload, can
 *  land in that window. Left unhandled it produced *no badge at all* plus an
 *  unhandled rejection; degrading to "couldn't check" is both honest and the
 *  state the UI already renders. */
export async function lookup(appIds: number[]): Promise<LookupResponse> {
  const req: LookupRequest = { type: "gfn-lookup", appIds };
  try {
    const response: unknown = await browser.runtime.sendMessage(req);
    if (!isLookupResponse(response)) {
      log.warn("lookup: unusable reply from background", response);
      return UNREACHABLE;
    }
    return response;
  } catch (err) {
    log.warn("lookup: background unreachable —", err);
    return UNREACHABLE;
  }
}
