import type { LookupRequest, LookupResponse } from "./messages";
import { isLookupResponse } from "./messages";
import { sendToBackground } from "./send";
import { log } from "./log";

/** The response we synthesize when the background can't be reached at all.
 *  `resolveState` maps this to "unknown" → the "couldn't check" badge, which is
 *  exactly right: we genuinely don't know, and must never claim "not supported". */
const UNREACHABLE: LookupResponse = { ok: false, found: {}, reason: "network" };

/** Ask the background which of `appIds` are on GeForce NOW.
 *
 *  Never rejects — see `sendToBackground`, which owns that rule for every context.
 *  An unusable reply degrades to "couldn't check" rather than to a false negative. */
export async function lookup(appIds: number[]): Promise<LookupResponse> {
  const req: LookupRequest = { type: "gfn-lookup", appIds };
  const response = await sendToBackground(req);
  if (!isLookupResponse(response)) {
    log.warn("lookup: unusable reply from background", response);
    return UNREACHABLE;
  }
  return response;
}
