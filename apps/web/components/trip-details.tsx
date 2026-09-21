"use client";
import { BookOpen, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { cloudClient, remoteVisits } from "@/lib/cloud";
import type { Place, Visit } from "@/lib/data";
import type { Trip } from "../../../packages/domain/src";
export default function TripDetails({
  cloud,
  trips: localTrips,
  visits,
  places,
  onPlace,
}: {
  cloud: boolean;
  trips: Trip[];
  visits: Visit[];
  places: Place[];
  onPlace: (p: Place) => void;
}) {
  const [trips, setTrips] = useState<Trip[]>(localTrips);
  const [open, setOpen] = useState<string | null>(null);
  const [rows, setRows] = useState<Visit[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cloud) {
      setTrips(localTrips);
      return;
    }
    void cloudClient()
      .then((api) => api.request<{ items: Trip[] }>("/trips"))
      .then((r) => setTrips(r.items))
      .catch(() => setError("旅を読み込めませんでした。"));
  }, [cloud, localTrips]);
  async function select(id: string, append = false) {
    setOpen(id);
    setBusy(true);
    try {
      const next = cloud
        ? await remoteVisits({
            tripId: id,
            offset: append ? rows.length : 0,
            limit: 20,
          })
        : visits.filter((v) => v.tripId === id);
      setRows(append ? [...rows, ...next] : next);
      setMore(cloud && next.length === 20);
    } catch {
      setError("記録を読み込めませんでした。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-panel">
      <div className="section-heading">
        <h2>
          <BookOpen size={17} />
          旅ごとの思い出
        </h2>
      </div>
      {!trips.length && (
        <div className="empty">
          <h3>旅の記録を、ひとつの物語に。</h3>
          <p>
            設定の「旅をまとめる」から旅行を作成し、訪問記録をまとめられます。
          </p>
        </div>
      )}
      {trips.map((t) => (
        <article className="trip-group" key={t.id}>
          <button
            className="trip-group-title"
            onClick={() => void select(t.id)}
          >
            <span>{t.title}</span>
            <ChevronDown size={17} />
          </button>
          {open === t.id && (
            <div>
              {rows.map((v) => {
                const p = places.find((p) => p.id === v.placeId);
                return p ? (
                  <button
                    key={v.id}
                    className="trip-visit"
                    onClick={() => onPlace(p)}
                  >
                    <img src={v.photos[0] || p.image} alt={p.name} />
                    <span>
                      <strong>{v.title || p.name}</strong>
                      <small>
                        {v.date} · {p.flag} {p.name}
                      </small>
                    </span>
                  </button>
                ) : null;
              })}
              {!rows.length && !busy && (
                <p className="search-hint">
                  設定から訪問記録をこの旅にまとめてみましょう。
                </p>
              )}
              {more && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void select(t.id, true)}
                >
                  続きを見る
                </button>
              )}
            </div>
          )}
        </article>
      ))}
      {busy && <p className="search-hint">読み込み中…</p>}
      {error && (
        <p className="form-error" role="status">
          {error}
        </p>
      )}
    </section>
  );
}
