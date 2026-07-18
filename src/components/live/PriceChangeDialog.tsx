"use client";

/**
 * 価格変更の確認ダイアログ。
 * 値上がり・値下がりのどちらでも表示し、即座に外部サイトへ移動しない。
 */

import { useEffect, useRef } from "react";

type Props = {
  previousAmount: number;
  currentAmount: number;
  checkedAt: string;
  onContinue: () => void;
  onBack: () => void;
};

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${Math.abs(delta).toLocaleString("ja-JP")}円`;
}

function formatTime(iso: string): string {
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match ? match[1] : iso;
}

export function PriceChangeDialog({
  previousAmount,
  currentAmount,
  checkedAt,
  onContinue,
  onBack,
}: Props) {
  const delta = currentAmount - previousAmount;
  const increased = delta > 0;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onBack();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onBack]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-change-title"
        className="w-full max-w-md rounded-t-2xl bg-[var(--surface)] p-5 sm:rounded-2xl"
      >
        <h2 id="price-change-title" className="text-lg font-bold">
          価格が変更されました
        </h2>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-[var(--border)] p-4 text-sm">
          <dt className="text-[var(--foreground-muted)]">検索時</dt>
          <dd className="tabular-nums line-through">{formatYen(previousAmount)}</dd>
          <dt className="text-[var(--foreground-muted)]">現在</dt>
          <dd className="text-lg font-bold tabular-nums">{formatYen(currentAmount)}</dd>
          <dt className="text-[var(--foreground-muted)]">差額</dt>
          <dd
            className={`font-bold tabular-nums ${
              increased
                ? "text-orange-800 dark:text-orange-300"
                : "text-emerald-800 dark:text-emerald-300"
            }`}
          >
            {/* 色だけに頼らず、記号と文字でも伝える */}
            <span aria-hidden="true">{increased ? "▲" : "▼"}</span> {formatDelta(delta)}
            {increased ? "（値上がり）" : "（値下がり）"}
          </dd>
          <dt className="text-[var(--foreground-muted)]">再確認時刻</dt>
          <dd className="tabular-nums">{formatTime(checkedAt)}</dd>
        </dl>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={onContinue}
            className="min-h-12 w-full rounded-xl bg-blue-700 px-5 py-3 text-base font-bold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            新しい価格で続ける
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onBack}
            className="min-h-11 w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-bold"
          >
            戻る
          </button>
        </div>
      </div>
    </div>
  );
}
