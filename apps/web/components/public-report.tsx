"use client";
import { useState } from "react";
import Turnstile from "./turnstile";
export default function PublicReport({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("privacy");
  const [token, setToken] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="public-report">
      {!open ? (
        <button className="text-button" onClick={() => setOpen(true)}>
          この公開ページについて報告する
        </button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/v1/reports`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ slug, reason, token }),
                },
              );
              if (!r.ok) throw new Error();
              setNotice("報告を受け付けました。");
              setOpen(false);
            } catch {
              setNotice("報告できませんでした。時間をおいてお試しください。");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            報告する理由{" "}
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="privacy">プライバシーの問題</option>
              <option value="spam">スパム・不正利用</option>
              <option value="other">その他の問題</option>
            </select>
          </label>
          <Turnstile
            action="report"
            onToken={setToken}
            onError={() => setNotice("本人確認を読み込めませんでした。")}
          />
          <button className="secondary" disabled={!token || busy}>
            報告を送信
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => setOpen(false)}
          >
            キャンセル
          </button>
        </form>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
