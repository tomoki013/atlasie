import { ArrowRight, Camera, Globe2, MapPin, Plus } from "lucide-react";
import type { Place, Visit } from "@/lib/data";
export default function ArchiveHighlights({
  visits,
  places,
  stats,
  demo,
  onAdd,
  onPlace,
}: {
  visits: Visit[];
  places: Place[];
  stats: { countries: number; places: number; photos: number };
  demo: boolean;
  onAdd: () => void;
  onPlace: (place: Place) => void;
}) {
  const candidates = [...visits]
    .filter((v) => v.photos.length)
    .sort((a, b) => a.date.localeCompare(b.date));
  const memory = candidates[0];
  const place = places.find((p) => p.id === memory?.placeId);
  return (
    <section className="archive-highlights" aria-label="旅のハイライト">
      <div className="travel-passport">
        <div className="passport-label">
          <span>MY TRAVEL PASSPORT</span>
          <span>{demo ? "SAMPLE" : "PRIVATE"}</span>
        </div>
        <h2>
          {visits.length
            ? "思い出の数だけ、世界が広がる。"
            : "最初の一歩は、忘れられない場所から。"}
        </h2>
        <div className="passport-stats">
          {[
            { icon: Globe2, value: stats.countries, label: "訪れた国・地域" },
            { icon: MapPin, value: stats.places, label: "思い出の場所" },
            { icon: Camera, value: stats.photos, label: "旅の写真" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label}>
              <Icon size={16} />
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
      {memory && place ? (
        <button className="memory-spotlight" onClick={() => onPlace(place)}>
          <img src={memory.photos[0]} alt="" />
          <div>
            <span>あの日に、もう一度</span>
            <h3>{memory.title || place.name}</h3>
            <p>
              {place.flag} {place.name} · {memory.date.replaceAll("-", ".")}
            </p>
            <span className="spotlight-link">
              思い出をひらく <ArrowRight size={15} />
            </span>
          </div>
        </button>
      ) : (
        <button className="memory-start" onClick={onAdd}>
          <Plus size={25} />
          <h3>あなたの旅を、ひとつ。</h3>
          <p>
            場所と日付だけでも大丈夫。
            <br />
            ことばは、あとから編集できます。
          </p>
          <span>
            思い出を追加 <ArrowRight size={15} />
          </span>
        </button>
      )}
    </section>
  );
}
