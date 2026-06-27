import type { LookupResponse } from "../shared/messages";

export type BadgeState =
  | { kind: "supported"; rtx: boolean }
  | { kind: "not-supported" }
  | { kind: "unknown" };

/** Map a background lookup response for a single app id into a badge state.
 *  Feed unavailable → "unknown" (never a false negative); present → "supported"
 *  (+rtx); absent with a good feed → "not-supported". */
export function resolveState(appId: number, response: LookupResponse): BadgeState {
  if (!response.ok) return { kind: "unknown" };
  const hit = response.found[String(appId)];
  if (hit) return { kind: "supported", rtx: hit.rtx };
  return { kind: "not-supported" };
}
