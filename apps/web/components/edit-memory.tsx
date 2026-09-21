"use client";
import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Visit } from "@/lib/data";
export default function EditMemory({
  visit,
  onClose,
  onSave,
}: {
  visit: Visit;
  onClose: () => void;
  onSave: (v: Visit) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(visit.title);
  const [memo, setMemo] = useState(visit.memo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label="思い出を編集"
      onCancel={onClose}
    >
      <div className="dialog-header">
        <h2>思い出を編集</h2>
        <button aria-label="閉じる" className="icon-button" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave({ ...visit, title: title.trim(), memo: memo.trim() });
            onClose();
          } catch {
            setError("保存できませんでした。もう一度お試しください。");
            setBusy(false);
          }
        }}
      >
        <label className="form-label">
          タイトル
          <input
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="form-label">
          メモ
          <textarea
            maxLength={500}
            rows={6}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <span className="character-count">{memo.length}/500</span>
        </label>
        <div className="dialog-actions">
          <button className="primary full" disabled={busy}>
            {busy ? "保存しています…" : "変更を保存"}
            <Check size={15} />
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </dialog>
  );
}
