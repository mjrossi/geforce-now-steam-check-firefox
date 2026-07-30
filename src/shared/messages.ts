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
   *
   *  Both values mean the same thing — the fetch failed — and differ only in
   *  whether the optional feed grant happens to be missing. "permission" is not a
   *  diagnosis: the catalog fetch clears plain CORS ungranted (feed-origin.ts), so
   *  the usual cause is the network either way. It exists so the badge can *offer*
   *  the grant as the one thing that might help if NVIDIA tightens CORS. Absent on
   *  success. */
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

/** Guards for every shape that crosses the message boundary, kept next to the
 *  types they validate.
 *
 *  `runtime.sendMessage` *resolves* with `undefined` when a listener declines a
 *  message — which is what an older background does mid-update for a message
 *  type it has never heard of — so replies are validated, never cast. Casting
 *  put `undefined.count` one property access away from stranding the popup on
 *  its placeholder text.
 *
 *  The same rule applies in the inbound direction, and for a stronger reason:
 *  `runtime.onMessage` hears from every content script and from other extensions,
 *  so the background's listener has less claim on its input than the popup has on
 *  a reply. Only `gfn-lookup` carries a payload, so it is the only request with a
 *  guard; the other two are their `type` and nothing else. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Validate an inbound lookup, *including* its elements: `appIds` reaches the
 *  index as `String(appId)`, and a non-number there would silently look up a key
 *  that cannot exist and read back as a confident "not supported". */
export function isLookupRequest(value: unknown): value is LookupRequest {
  if (!isObject(value)) return false;
  const r = value as Partial<LookupRequest>;
  return (
    r.type === "gfn-lookup" &&
    Array.isArray(r.appIds) &&
    r.appIds.every((id) => typeof id === "number")
  );
}

export function isLookupResponse(value: unknown): value is LookupResponse {
  if (!isObject(value)) return false;
  const r = value as Partial<LookupResponse>;
  return typeof r.ok === "boolean" && typeof r.found === "object" && r.found !== null;
}

export function isCatalogStatus(value: unknown): value is CatalogStatus {
  if (!isObject(value)) return false;
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
  if (!isObject(value)) return false;
  const r = value as Partial<RefreshResponse>;
  if (typeof r.ok !== "boolean") return false;
  return r.status === null || isCatalogStatus(r.status);
}
