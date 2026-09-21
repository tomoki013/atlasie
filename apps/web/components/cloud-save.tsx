"use client";
import { useState } from "react";
import { cloudConfigured, login } from "@/lib/cloud";
import type { Archive } from "../../../packages/domain/src";

import Turnstile from "./turnstile";
export default function CloudSave({ archive }: { archive: Archive | null }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function start(provider: "google-oauth2" | "apple") {
    if (!archive) return;
    setBusy(true);
    setError("");
    try {
      await login(provider, archive, token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "接続できませんでした。");
      setBusy(false);
      setToken("");
    }
  }
  return (
    <>
      <Turnstile
        action="guest-save"
        onToken={setToken}
        onError={() => setError("本人確認を読み込めませんでした。")}
      />
      {!cloudConfigured && (
        <div className="connection-notice">
          <p>
            アカウント連携の準備中です。
            <br />
            今は「自分の旅」をこのブラウザに自動保存できます。
          </p>
        </div>
      )}
      <button
        className="provider-button"
        disabled={!cloudConfigured || !token || busy}
        onClick={() => void start("google-oauth2")}
      >
        <span className="google-g">G</span>Googleで続ける
        {!cloudConfigured && <span>準備中</span>}
      </button>
      <button
        className="provider-button"
        disabled={!cloudConfigured || !token || busy}
        onClick={() => void start("apple")}
      >
        <span>●</span>Appleで続ける{!cloudConfigured && <span>準備中</span>}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
