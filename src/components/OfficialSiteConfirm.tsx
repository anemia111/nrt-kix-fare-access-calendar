"use client";

/**
 * 公式サイトへ進む前の確認画面（要件）。
 *
 * ボタンを押してもすぐに外部サイトへ移動せず、まず検索条件を確認できるようにする。
 * 正式なディープリンク仕様が無いため、日付・便が選択済みであるかのようには見せない。
 * 「公式サイトで条件を再入力してください」と明記する。
 */

import { useEffect, useRef, useState } from "react";
import { EXTERNAL_LINK_ATTRIBUTES } from "@/lib/externalUrl";
import { OFFICIAL_LINK_LEVEL_LABELS, type OfficialLink } from "@/lib/officialLink";
import { copyToClipboard } from "@/lib/clipboard";
import { useToast } from "./Toast";
import { ExternalIcon } from "./ExternalLinkButton";

export type ConfirmConditions = {
  readonly airlineNameJa: string;
  readonly dateLabel: string;
  /** ISO日付（コピー用）。 */
  readonly dateIso: string;
  readonly routeLabel: string;
  readonly originAirportName: string;
  readonly destinationAirportName: string;
  readonly adults: number;
  readonly checkedBaggage: boolean;
  /** 実データの便名がある場合のみ。デモの便名はここに渡さない。 */
  readonly realFlightNumber?: string;
};

type Props = {
  link: Extract<OfficialLink, { ok: true }>;
  conditions: ConfirmConditions;
  onClose: () => void;
};

const DEEPLINK_UNAVAILABLE_NOTICE =
  "航空会社が便指定ディープリンクを公開していないため、公式サイトで条件を再入力してください";

export function OfficialSiteConfirm({ link, conditions, onClose }: Props) {
  const { showToast } = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const summary = buildSummary(conditions);

  async function copy(label: string, text: string) {
    const ok = await copyToClipboard(text);
    setCopied(ok ? label : null);
    showToast(ok ? `${label}をコピーしました` : "コピーできませんでした");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl bg-[var(--surface)] p-5 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="confirm-title" className="text-lg font-bold">
            公式サイトで価格・空席を確認
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-lg"
          >
            ✕
          </button>
        </div>

        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          以下の条件を控えてから、{conditions.airlineNameJa}の公式サイトへ進んでください。
        </p>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-[var(--border)] p-4 text-sm">
          <dt className="text-[var(--foreground-muted)]">航空会社</dt>
          <dd className="font-bold">{conditions.airlineNameJa}</dd>
          <dt className="text-[var(--foreground-muted)]">搭乗日</dt>
          <dd>{conditions.dateLabel}</dd>
          <dt className="text-[var(--foreground-muted)]">出発空港</dt>
          <dd>{conditions.originAirportName}</dd>
          <dt className="text-[var(--foreground-muted)]">到着空港</dt>
          <dd>{conditions.destinationAirportName}</dd>
          <dt className="text-[var(--foreground-muted)]">人数</dt>
          <dd>大人{conditions.adults}名</dd>
          <dt className="text-[var(--foreground-muted)]">旅程</dt>
          <dd>片道・エコノミークラス</dd>
          <dt className="text-[var(--foreground-muted)]">預け荷物</dt>
          <dd>{conditions.checkedBaggage ? "あり" : "なし"}</dd>
          {conditions.realFlightNumber ? (
            <>
              <dt className="text-[var(--foreground-muted)]">便名</dt>
              <dd>{conditions.realFlightNumber}</dd>
            </>
          ) : null}
        </dl>

        {/* ディープリンク非対応の明示（偽らない） */}
        <p className="mt-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          {DEEPLINK_UNAVAILABLE_NOTICE}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => copy("検索条件", summary)}
            className="min-h-11 rounded-xl border border-[var(--border)] px-3 text-sm font-bold hover:bg-[var(--surface-muted)]"
          >
            検索条件をコピー
          </button>
          <button
            type="button"
            onClick={() => copy("日付", conditions.dateIso)}
            className="min-h-11 rounded-xl border border-[var(--border)] px-3 text-sm font-bold hover:bg-[var(--surface-muted)]"
          >
            日付をコピー
          </button>
          {/* 便名コピーは実データの便名があるときだけ（偽らない） */}
          {conditions.realFlightNumber ? (
            <button
              type="button"
              onClick={() => copy("便名", conditions.realFlightNumber!)}
              className="min-h-11 rounded-xl border border-[var(--border)] px-3 text-sm font-bold hover:bg-[var(--surface-muted)]"
            >
              便名をコピー
            </button>
          ) : null}
        </div>

        <a
          href={link.url}
          target={EXTERNAL_LINK_ATTRIBUTES.target}
          rel={EXTERNAL_LINK_ATTRIBUTES.rel}
          onClick={() => showToast("公式サイトを新しいタブで開きました")}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-base font-bold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          公式サイトを開く
          <ExternalIcon />
        </a>
        <p className="mt-2 text-xs text-[var(--foreground-muted)]">
          リンク先: {link.host}（{OFFICIAL_LINK_LEVEL_LABELS[link.level]}）
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 min-h-11 w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-bold"
        >
          閉じる
        </button>

        <span className="sr-only" aria-live="polite">
          {copied ? `${copied}をコピーしました` : ""}
        </span>
      </div>
    </div>
  );
}

function buildSummary(conditions: ConfirmConditions): string {
  const lines = [
    `航空会社: ${conditions.airlineNameJa}`,
    `搭乗日: ${conditions.dateLabel}`,
    `区間: ${conditions.originAirportName} → ${conditions.destinationAirportName}`,
    `人数: 大人${conditions.adults}名`,
    "旅程: 片道・エコノミークラス",
    `預け荷物: ${conditions.checkedBaggage ? "あり" : "なし"}`,
  ];
  if (conditions.realFlightNumber) lines.push(`便名: ${conditions.realFlightNumber}`);
  return lines.join("\n");
}
