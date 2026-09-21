import type { Place, PlaceProvider } from "../../domain/src";
/** Replaceable geocoder adapter. No provider identifier is used as our primary key. */
export class PhotonPlaceProvider implements PlaceProvider {
  constructor(private readonly endpoint = "https://photon.komoot.io") {}
  async search(query: string): Promise<Place[]> {
    if (query.trim().length < 2) return [];
    const url = new URL("/api/", this.endpoint);
    url.searchParams.set("q", query.trim());
    url.searchParams.set("limit", "8");
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) throw new Error("場所の検索サービスに接続できません。");
    const data: unknown = await response.json();
    if (
      !data ||
      typeof data !== "object" ||
      !("features" in data) ||
      !Array.isArray(data.features)
    )
      throw new Error("検索結果を読み込めません。");
    const names = new Intl.DisplayNames(["ja"], { type: "region" });
    return data.features.flatMap((feature): Place[] => {
      if (!feature || typeof feature !== "object") return [];
      const p = feature.properties;
      const c = feature.geometry?.coordinates;
      if (
        !p ||
        typeof p.name !== "string" ||
        typeof p.countrycode !== "string" ||
        !Array.isArray(c) ||
        c.length !== 2 ||
        !c.every((v: unknown) => typeof v === "number" && Number.isFinite(v))
      )
        return [];
      const code = p.countrycode.toUpperCase();
      if (!/^[A-Z]{2}$/.test(code)) return [];
      return [
        {
          id: crypto.randomUUID(),
          name: p.name.slice(0, 120),
          country: names.of(code) ?? p.country ?? code,
          code,
          flag: String.fromCodePoint(
            ...[...code].map((x) => 127397 + x.charCodeAt(0)),
          ),
          coordinates: [c[0], c[1]],
          image: "/place-placeholder.svg",
          description: [p.city, p.state, p.country]
            .filter((s: unknown) => typeof s === "string")
            .join(" · ")
            .slice(0, 250),
        },
      ];
    });
  }
  async get(_id: string): Promise<Place | null> {
    return null;
  }
}
