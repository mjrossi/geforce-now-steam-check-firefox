import type { LookupResponse } from "../shared/messages";

export type BadgeState =
  | { kind: "supported"; rtx: boolean }
  | { kind: "not-supported" }
  | { kind: "unknown" }
  | { kind: "needs-permission" };

/** Map a background lookup response for a single app id into a badge state.
 *  Feed unavailable → "needs-permission" when the host permission is missing,
 *  else "unknown" (never a false negative); present → "supported" (+rtx); absent
 *  with a good feed → "not-supported". */
export function resolveState(appId: number, response: LookupResponse): BadgeState {
  if (!response.ok) {
    return response.reason === "permission"
      ? { kind: "needs-permission" }
      : { kind: "unknown" };
  }
  const hit = response.found[String(appId)];
  if (hit) return { kind: "supported", rtx: hit.rtx };
  return { kind: "not-supported" };
}
