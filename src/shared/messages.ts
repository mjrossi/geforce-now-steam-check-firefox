/** Content script → background: look up these Steam app ids. */
export interface LookupRequest {
  type: "gfn-lookup";
  appIds: number[];
}

/** Background → content script. `ok:false` means the feed could not be loaded
 *  (render "unknown", never a false "not supported"). `found` carries only
 *  supported app ids, keyed by app-id string. */
export interface LookupResponse {
  ok: boolean;
  found: Record<string, { rtx: boolean }>;
}
