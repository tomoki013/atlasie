"use client";
import { ArrowLeft, ArrowRight, Camera, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Place, Visit } from "@/lib/data";

type Photo = { src: string; visit: Visit; place: Place; number: number };
export default function PhotoAlbum({
  visits,
  places,
  partial,
  onAdd,
  onPlace,
}: {
  visits: Visit[];
  places: Place[];
  partial: boolean;
  onAdd: () => void;
  onPlace: (place: Place) => void;
}) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [country, setCountry] = useState("all");
  const [order, setOrder] = useState("newest");
  const [active, setActive] = useState<number | null>(null);
  const photos: Photo[] = visits.flatMap((visit) => {
    const place = places.find((p) => p.id === visit.placeId);
    return place
      ? visit.photos.map((src, i) => ({ src, visit, place, number: i + 1 }))
      : [];
  });
  const years = [...new Set(photos.map((p) => p.visit.date.slice(0, 4)))]
    .sort()
    .reverse();
  const countries = [
    ...new Map(photos.map((p) => [p.place.code, p.place])).values(),
  ].sort((a, b) => a.country.localeCompare(b.country, "ja"));
  const visible = photos
    .filter(
      ({ visit, place }) =>
        (year === "all" || visit.date.startsWith(year)) &&
        (country === "all" || place.code === country) &&
        `${place.name} ${place.country} ${visit.title} ${visit.memo}`
          .normalize("NFKC")
          .toLocaleLowerCase()
          .includes(query.trim().normalize("NFKC").toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        (order === "newest" ? -1 : 1) *
        a.visit.date.localeCompare(b.visit.date),
    );
  const filtered = query !== "" || year !== "all" || country !== "all";
  return (
    <section className="content-panel album-panel">
      <div className="section-heading">
        <h2>
          旅の写真 <span>{photos.length} PHOTOS</span>
        </h2>
        <button className="text-button" onClick={onAdd}>
          <Camera size={17} />
          写真を追加
        </button>
      </div>
      <p className="album-intro">
        あの日の光も、旅先の空気も。写真をひらいて、もう一度。
      </p>
      <div className="album-filters">
        <label className="album-search">
          <Search size={17} />
          <input
            aria-label="写真の思い出を検索"
            placeholder="場所・タイトル・メモで検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="写真の年"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="all">すべての年</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
        <select
          aria-label="写真の国"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          <option value="all">すべての国</option>
          {countries.map((p) => (
            <option key={p.code} value={p.code}>
              {p.flag} {p.country}
            </option>
          ))}
        </select>
        <select
          aria-label="写真の並び順"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
        >
          <option value="newest">新しい順</option>
          <option value="oldest">古い順</option>
        </select>
      </div>
      <div className="album-results">
        <span role="status">
          {visible.length}枚の写真{partial && "（読み込み済みの記録から）"}
        </span>
        {filtered && (
          <button
            className="text-button"
            onClick={() => {
              setQuery("");
              setYear("all");
              setCountry("all");
            }}
          >
            絞り込みをクリア
            <X size={13} />
          </button>
        )}
      </div>
      <div className="photo-grid album-grid">
        {visible.map((photo, i) => (
          <button
            key={`${photo.visit.id}-${photo.number}`}
            onClick={() => setActive(i)}
          >
            <img
              loading="lazy"
              src={photo.src}
              alt={`${photo.place.name}の旅の写真 ${photo.number}`}
            />
            <span>
              {photo.place.flag} {photo.place.name}
              <small>
                {photo.visit.title || "旅の思い出"} ·{" "}
                {photo.visit.date.replaceAll("-", ".")}
              </small>
            </span>
          </button>
        ))}
      </div>
      {!visible.length && (
        <div className="empty">
          <Camera size={36} strokeWidth={1} />
          <h3>
            {filtered
              ? "この条件の写真は、まだありません。"
              : "あの景色を、ここに残そう。"}
          </h3>
          <p>
            {filtered
              ? "別のことばや年・国で探してみてください。"
              : "旅先の一枚を添えると、自分だけのアルバムが育ちます。"}
          </p>
          {!filtered && (
            <button className="primary" onClick={onAdd}>
              最初の写真を追加
            </button>
          )}
        </div>
      )}
      {active !== null && visible[active] && (
        <PhotoViewer
          photos={visible}
          initial={active}
          onClose={() => setActive(null)}
          onPlace={onPlace}
        />
      )}
    </section>
  );
}
function PhotoViewer({
  photos,
  initial,
  onClose,
  onPlace,
}: {
  photos: Photo[];
  initial: number;
  onClose: () => void;
  onPlace: (place: Place) => void;
}) {
  const [position, setIndex] = useState(initial);
  const index = Math.min(position, photos.length - 1);
  const ref = useRef<HTMLDialogElement>(null);
  const photo = photos[index];
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="photo-viewer"
      aria-label="写真ビューアー"
      onCancel={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setIndex(Math.min(photos.length - 1, index + 1));
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setIndex(Math.max(0, index - 1));
        }
      }}
    >
      <header>
        <span>THE TRAVEL COLLECTION</span>
        <button aria-label="写真を閉じる" onClick={onClose}>
          <X size={23} />
        </button>
      </header>
      <div className="viewer-stage">
        <img
          src={photo.src}
          alt={`${photo.place.name}の旅の写真 ${photo.number}`}
        />
        <button
          className="viewer-prev"
          aria-label="前の写真"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
        >
          <ArrowLeft />
        </button>
        <button
          className="viewer-next"
          aria-label="次の写真"
          disabled={index === photos.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          <ArrowRight />
        </button>
      </div>
      <div className="viewer-caption">
        <div>
          <span>
            {photo.place.flag} {photo.place.name} ·{" "}
            {photo.visit.date.replaceAll("-", ".")}
          </span>
          <h2>{photo.visit.title || "旅の思い出"}</h2>
          {photo.visit.memo && <p>{photo.visit.memo}</p>}
          <button
            className="text-button"
            onClick={() => {
              onClose();
              onPlace(photo.place);
            }}
          >
            <MapPin size={15} />
            この国の思い出へ
            <ArrowRight size={15} />
          </button>
        </div>
        <output aria-live="polite">
          {index + 1} / {photos.length}
        </output>
      </div>
    </dialog>
  );
}
