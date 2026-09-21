"use client";
import { useEffect, useState } from "react";
import { auth, cloudClient, remoteVisits } from "@/lib/cloud";
import type { Visit } from "@/lib/data";
export default function CloudSettings({
  name,
  onName,
  visits,
  onVisits,
}: {
  name: string;
  onName: (name: string) => void;
  visits: Visit[];
  onVisits: (v: Visit[]) => void;
}) {
  const [displayName, setDisplayName] = useState(name);
  const [share, setShare] = useState<{ enabled: boolean; slug: string } | null>(
    null,
  );
  const [trips, setTrips] = useState<{ id: string; title: string }[]>([]);
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void (async () => {
      try {
        const api = await cloudClient();
        setShare(await api.request("/share"));
        setTrips(
          (
            await api.request<{ items: { id: string; title: string }[] }>(
              "/trips",
            )
          ).items,
        );
      } catch {
        setNotice("設定を読み込めませんでした。");
      }
    })();
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch {
      setNotice("変更できませんでした。再度お試しください。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="cloud-settings">
      <form
        className="setting-row"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const api = await cloudClient();
            await api.request("/me", {
              method: "PATCH",
              body: JSON.stringify({ displayName }),
            });
            onName(displayName);
            setNotice("名前を更新しました。");
          });
        }}
      >
        <label className="form-label">
          表示名
          <input
            required
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <button className="secondary" disabled={busy}>
          名前を保存
        </button>
      </form>
      <div className="setting-row">
        <div>
          <h3>公開プロフィール</h3>
          <p>
            公開するのは表示名・訪問国・集計だけです。日付、メモ、写真、正確な場所は公開されません。
          </p>
          {share?.enabled && (
            <a
              className="text-button"
              href={`/p/${share.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              公開ページを見る →
            </a>
          )}
        </div>
        <button
          className="secondary"
          disabled={!share || busy}
          onClick={() =>
            void run(async () => {
              if (!share) return;
              if (
                !share.enabled &&
                !window.confirm(
                  "表示名・訪問国・集計を、リンクを知っている人に公開しますか？",
                )
              )
                return;
              const api = await cloudClient();
              setShare(
                await api.request("/share", {
                  method: "PUT",
                  body: JSON.stringify({ enabled: !share.enabled }),
                }),
              );
            })
          }
        >
          {share?.enabled ? "公開を停止" : "公開する"}
        </button>
      </div>
      <form
        className="setting-row"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const api = await cloudClient();
            const trip = await api.request<{ id: string; title: string }>(
              "/trips",
              { method: "POST", body: JSON.stringify({ title }) },
            );
            setTrips((p) => [trip, ...p]);
            setTitle("");
          });
        }}
      >
        <label className="form-label">
          旅をまとめる
          <input
            required
            maxLength={100}
            placeholder="例：秋のヨーロッパ旅行"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <button className="secondary" disabled={busy}>
          旅を作成
        </button>
      </form>
      {trips.length > 0 && (
        <div className="trip-assignments">
          {visits.map((v) => (
            <label className="setting-row" key={v.id}>
              <span>{v.title || v.date}</span>
              <select
                aria-label={`${v.title || v.date}の旅`}
                value={v.tripId ?? ""}
                disabled={busy}
                onChange={(e) =>
                  void run(async () => {
                    const api = await cloudClient();
                    await api.request(`/visits/${v.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ tripId: e.target.value || null }),
                    });
                    onVisits(await remoteVisits());
                  })
                }
              >
                <option value="">旅にまとめない</option>
                {trips.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      <div className="setting-row">
        <button
          className="secondary"
          onClick={() =>
            void (async () => {
              await (await auth()).logout({
                logoutParams: { returnTo: location.origin },
              });
            })()
          }
        >
          ログアウト
        </button>
        <button
          className="danger"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (
                !window.confirm(
                  "アカウントとすべての記録・写真を完全に削除しますか？元に戻せません。",
                )
              )
                return;
              await (await cloudClient()).request("/me", { method: "DELETE" });
              await (await auth()).logout({
                logoutParams: { returnTo: location.origin },
              });
            })
          }
        >
          アカウントを完全に削除
        </button>
      </div>
      {notice && (
        <p className="form-error" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
