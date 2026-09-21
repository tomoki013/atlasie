import { Auth0Client } from "@auth0/auth0-spa-js";
import { ApiClient, type RemoteVisit } from "../../../packages/api-client/src";
import type { Archive, Place, Visit } from "../../../packages/domain/src";

const base = process.env.NEXT_PUBLIC_API_URL ?? "";
export const cloudConfigured = Boolean(
  base &&
    process.env.NEXT_PUBLIC_AUTH0_DOMAIN &&
    process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID &&
    process.env.NEXT_PUBLIC_AUTH0_AUDIENCE &&
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
);
let authPromise: Promise<Auth0Client> | undefined;
export function auth() {
  if (!cloudConfigured) throw new Error("Cloud connection is not configured");
  authPromise ??= (async () => {
    const client = new Auth0Client({
      domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN ?? "",
      clientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID ?? "",
      cacheLocation: "memory",
      authorizationParams: {
        audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
        redirect_uri: window.location.origin,
      },
    });
    const params = new URLSearchParams(location.search);
    if (params.has("code") && params.has("state")) {
      await client.handleRedirectCallback();
      history.replaceState(null, "", location.pathname);
    } else await client.checkSession();
    return client;
  })();
  return authPromise;
}
export async function cloudClient() {
  const client = await auth();
  return new ApiClient(base, () => client.getTokenSilently());
}
export async function login(
  provider: "google-oauth2" | "apple",
  archive: Archive,
  token: string,
) {
  const response = await fetch(`${base}/v1/auth/save-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, importKey: archive.importKey }),
  });
  if (!response.ok)
    throw new Error("本人確認に失敗しました。もう一度お試しください。");
  const { grant } = await response.json();
  sessionStorage.setItem("travel-save-grant", grant);
  await (await auth()).loginWithRedirect({
    authorizationParams: { connection: provider },
  });
}
async function photoId(visitId: string, index: number) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${visitId}:${index}`),
    ),
  ).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes)
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export async function uploadPhotos(api: ApiClient, visit: Visit) {
  for (const [index, src] of visit.photos.entries()) {
    if (!src.startsWith("data:image/jpeg;base64,")) continue;
    const binary = atob(src.split(",")[1]);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const id = await photoId(visit.id, index);
    const upload = await api.request<{ url: string }>(`/photos/upload`, {
      method: "POST",
      body: JSON.stringify({
        id,
        visitId: visit.id,
        mimeType: "image/jpeg",
        byteSize: bytes.byteLength,
      }),
    });
    const response = await fetch(upload.url, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: bytes,
    });
    if (!response.ok) throw new Error("写真を保存できませんでした。");
    await api.request(`/photos/${id}/complete`, { method: "POST" });
  }
}
export async function importGuest(archive: Archive) {
  const grant = sessionStorage.getItem("travel-save-grant");
  if (!grant) return false;
  const api = await cloudClient();
  for (const place of archive.places ?? [])
    await api.request("/places", {
      method: "POST",
      body: JSON.stringify(place),
    });
  await api.request("/guest/import", {
    method: "POST",
    body: JSON.stringify({
      importKey: archive.importKey,
      trips: archive.trips ?? [],
      grant,
      visits: archive.visits.map(({ photos: _, photoIds: __, ...v }) => v),
    }),
  });
  for (const visit of archive.visits) await uploadPhotos(api, visit);
  sessionStorage.removeItem("travel-save-grant");
  return true;
}
export type VisitQuery = {
  tripId?: string;
  limit?: number;
  offset?: number;
  country?: string;
  year?: string;
  allPhotos?: boolean;
};
export async function remoteVisits(query: VisitQuery = {}): Promise<Visit[]> {
  const api = await cloudClient();
  const params = new URLSearchParams({
    limit: String(query.limit ?? 20),
    offset: String(query.offset ?? 0),
  });
  if (query.tripId) params.set("tripId", query.tripId);
  if (query.country) params.set("country", query.country);
  if (query.year && query.year !== "all") params.set("year", query.year);
  const { items } = await api.request<{ items: RemoteVisit[] }>(
    `/visits?${params}`,
  );
  return Promise.all(
    items.map(async (v) => ({
      ...v,
      photoIds: v.photos
        .filter((p) => p.status === "ready")
        .slice(0, query.allPhotos ? 10 : 1)
        .map((p) => p.id),
      tripId: v.tripId ?? undefined,
      photos: await Promise.all(
        v.photos
          .filter((p) => p.status === "ready")
          .slice(0, query.allPhotos ? 10 : 1)
          .map(
            async (p) =>
              (await api.request<{ url: string }>(`/photos/${p.id}/url`)).url,
          ),
      ),
    })),
  );
}
export type MapSummary = {
  code: string;
  visits: number;
  places: number;
  photos: number;
  placeId: string;
  photoId: string | null;
};
export async function remoteMap(bbox = "-180,-85,180,85") {
  const api = await cloudClient();
  const { countries } = await api.request<{ countries: MapSummary[] }>(
    `/map?bbox=${encodeURIComponent(bbox)}`,
  );
  const visits: Visit[] = [];
  // Keep signed-URL requests bounded even for a very well-travelled archive.
  for (let i = 0; i < countries.length; i += 8) {
    const chunk = await Promise.all(
      countries.slice(i, i + 8).map(async (c) => ({
        id: `map-${c.code}`,
        placeId: c.placeId,
        date: "",
        title: "",
        memo: "",
        photos: c.photoId
          ? [
              (await api.request<{ url: string }>(`/photos/${c.photoId}/url`))
                .url,
            ]
          : [],
      })),
    );
    visits.push(...chunk);
  }
  return { countries, visits };
}
export async function remotePlaces(): Promise<Place[]> {
  const api = await cloudClient();
  const places: Place[] = [];
  let offset = 0;
  while (true) {
    const { items } = await api.request<{ items: Place[] }>(
      `/places?visited=true&offset=${offset}`,
    );
    places.push(...items);
    if (items.length < 100) break;
    offset += 100;
  }
  return places;
}
