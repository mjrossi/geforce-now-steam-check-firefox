import type { LookupResponse } from "../shared/messages";

export type BadgeState =
  | { kind: "supported"; rtx: boolean; gfnId?: string; cmsId?: number }
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
  if (hit) return { kind: "supported", rtx: hit.rtx, gfnId: hit.gfnId, cmsId: hit.cmsId };
  return { kind: "not-supported" };
}

/** Is this a real answer, or just "not yet"?
 *
 *  "unknown" (background asleep, or offline) and "needs-permission" (feed origin
 *  not granted) are transient: they must never be memoized or frozen into a page,
 *  or a badge that could self-heal stays wrong for the life of the tab. Both
 *  content scripts key their retry behaviour off this. */
export function isDefinitive(state: BadgeState): boolean {
  return state.kind === "supported" || state.kind === "not-supported";
}
