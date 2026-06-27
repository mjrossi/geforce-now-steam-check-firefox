/** Content script → background: look up these Steam app ids. */
export interface LookupRequest {
  type: "gfn-lookup";
  appIds: number[];
}

/** Background → content script. `ok:false` means the feed could not be loaded
 *  (render "unknown"/"needs-permission", never a false "not supported"). `found`
 *  carries only supported app ids, keyed by app-id string. */
export interface LookupResponse {
  ok: boolean;
  found: Record<string, { rtx: boolean }>;
  /** Why the feed was unavailable (only meaningful when `ok` is false).
   *  "permission" → the host permission for the feed origin has not been granted
   *  yet (the user must enable it via the popup/onboarding); "network" → the
   *  fetch failed transiently. Absent on success. */
  reason?: "permission" | "network";
}
