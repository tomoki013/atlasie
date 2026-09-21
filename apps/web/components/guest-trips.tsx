"use client";
import { useState } from "react";
import type { Archive } from "../../../packages/domain/src";
export default function GuestTrips({
  archive,
  onSave,
}: {
  archive: Archive;
  onSave: (next: Archive) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(next: Archive) {
    setBusy(true);
    try {
      await onSave(next);
      setTitle("");
      setError("");
    } catch {
      setError("旅を保存できませんでした。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="guest-trips">
      <form
        className="setting-row"
        onSubmit={(e) => {
          e.preventDefault();
          void save({
            ...archive,
            trips: [
              ...(archive.trips ?? []),
              { id: crypto.randomUUID(), title: title.trim() },
            ],
          });
        }}
      >
        <label className="form-label">
          旅をまとめる
          <input
            required
            maxLength={100}
            value={title}
            placeholder="例：秋のヨーロッパ旅行"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <button className="secondary" disabled={busy}>
          旅を作成
        </button>
      </form>
      {(archive.trips ?? []).length > 0 &&
        archive.visits.map((v) => (
          <label className="setting-row" key={v.id}>
            <span>{v.title || v.date}</span>
            <select
              disabled={busy}
              aria-label={`${v.title || v.date}の旅`}
              value={v.tripId ?? ""}
              onChange={(e) =>
                void save({
                  ...archive,
                  visits: archive.visits.map((x) =>
                    x.id === v.id
                      ? { ...x, tripId: e.target.value || undefined }
                      : x,
                  ),
                })
              }
            >
              <option value="">旅にまとめない</option>
              {archive.trips?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
        ))}
      {archive.trips?.map((t) => (
        <div className="setting-row" key={t.id}>
          <div>
            <h3>{t.title}</h3>
            <p>
              {archive.visits.filter((v) => v.tripId === t.id).length}件の記録
            </p>
          </div>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "この旅のまとまりを削除しますか？訪問記録と写真は残ります。",
                )
              )
                void save({
                  ...archive,
                  trips: archive.trips?.filter((x) => x.id !== t.id),
                  visits: archive.visits.map((v) =>
                    v.tripId === t.id ? { ...v, tripId: undefined } : v,
                  ),
                });
            }}
          >
            まとまりを削除
          </button>
        </div>
      ))}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
