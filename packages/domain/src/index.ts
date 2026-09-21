export type Place = {
  id: string;
  kind?: "country" | "city" | "place";
  name: string;
  country: string;
  code: string;
  flag: string;
  coordinates: [number, number];
  image: string;
  description: string;
};
export type Visit = {
  id: string;
  placeId: string;
  date: string;
  title: string;
  memo: string;
  photos: string[];
  photoIds?: string[];
  tripId?: string;
};
export type Trip = { id: string; title: string };
export type Archive = {
  trips?: Trip[];
  version: 1;
  importKey: string;
  visits: Visit[];
  places?: Place[];
};
export function summarize(visits: Visit[], places: Place[]) {
  const ids = new Set(visits.map((v) => v.placeId));
  return {
    countries: new Set(places.filter((p) => ids.has(p.id)).map((p) => p.code))
      .size,
    places: ids.size,
    cities: places.filter((p) => ids.has(p.id) && p.kind !== "country").length,
    visits: visits.length,
    photos: visits.reduce((n, v) => n + v.photos.length, 0),
    memories: visits.filter((v) => v.title || v.memo).length,
    trips: new Set(visits.map((v) => v.tripId).filter(Boolean)).size,
  };
}
export interface PlaceProvider {
  search(query: string): Promise<Place[]>;
  get(id: string): Promise<Place | null>;
}
