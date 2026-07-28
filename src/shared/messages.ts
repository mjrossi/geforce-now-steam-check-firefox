import type { GfnIndexEntry } from "../feed/types";

/** Content script → background: look up these Steam app ids. */
export interface LookupRequest {
  type: "gfn-lookup";
  appIds: number[];
}

/** Popup → background: report on the cached catalog without fetching anything. */
export interface StatusRequest {
  type: "gfn-status";
}

/** Popup → background: refetch the catalog now, bypassing the TTL. */
export interface RefreshRequest {
  type: "gfn-refresh";
}

/** Everything the background's message listener accepts. Discriminated on
 *  `type` so the listener can switch exhaustively. */
export type BackgroundRequest = LookupRequest | StatusRequest | RefreshRequest;

/** Background → content script. `ok:false` means the feed could not be loaded
 *  (render "unknown"/"needs-permission", never a false "not supported"). `found`
 *  carries only supported app ids, keyed by app-id string. */
export interface LookupResponse {
  ok: boolean;
  found: Record<string, GfnIndexEntry>;
  /** Why the feed was unavailable (only meaningful when `ok` is false).
   *  "permission" → the host permission for the feed origin has not been granted
   *  yet (the user must enable it via the popup/onboarding); "network" → the
   *  fetch failed transiently. Absent on success. */
  reason?: "permission" | "network";
}

/** What the popup reports about the cached catalog. `null` means nothing has
 *  been cached yet (fresh install, or every fetch so far has failed). */
export interface CatalogStatus {
  /** Number of Steam games in the index. */
  count: number;
  /** Epoch ms of the fetch that produced the cache. */
  fetchedAt: number;
}

export type StatusResponse = CatalogStatus | null;

/** Result of a manual refresh. On `ok:false` any previous cache is left in
 *  place, so `status` may still describe a (stale) catalog. */
export interface RefreshResponse {
  ok: boolean;
  status: StatusResponse;
}

/** Guards for replies read by the popup.
 *
 *  `runtime.sendMessage` *resolves* with `undefined` when a listener declines a
 *  message — which is what an older background does mid-update for a message
 *  type it has never heard of — so replies are validated, never cast. Casting
 *  put `undefined.count` one property access away from stranding the popup on
 *  its placeholder text. */
export function isCatalogStatus(value: unknown): value is CatalogStatus {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<CatalogStatus>;
  return typeof s.count === "number" && typeof s.fetchedAt === "number";
}

/** `null` — the background says there is no cache yet; `undefined` — we couldn't
 *  ask, or got a reply we can't read. The two are different bug reports, so the
 *  distinction survives into the UI. */
export function asStatus(reply: unknown): StatusResponse | undefined {
  if (reply === null) return null;
  return isCatalogStatus(reply) ? reply : undefined;
}

export function isRefreshResponse(value: unknown): value is RefreshResponse {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Partial<RefreshResponse>;
  if (typeof r.ok !== "boolean") return false;
  return r.status === null || isCatalogStatus(r.status);
}
