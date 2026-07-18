"use client";

/**
 * アプリ共通のクライアント処理:
 *  - サービスワーカーの登録（PWA・オフライン対応）
 *  - オフライン表示（保存済みの公式基礎情報のみである旨を明示）
 */

import { useEffect, useSyncExternalStore } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true, // サーバー描画時はオンライン扱い
  );
}

export function AppChrome() {
  const online = useOnline();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${basePath}/sw.js`).catch(() => {
        // 登録失敗はアプリの動作に影響しないため無視
      });
    }
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b-2 border-slate-500 bg-slate-200 px-4 py-2 text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100"
    >
      <div className="mx-auto flex max-w-4xl items-start gap-2">
        <span aria-hidden="true">⚑</span>
        <p>
          オフラインです。表示中の公式基礎情報は保存済みのもので、最新ではない可能性があります。
          価格・空席・列車時刻はオンラインで各公式サイトを確認してください。
        </p>
      </div>
    </div>
  );
}
