"use client";

/**
 * 実用モードの、航空会社1社ぶんの公式情報カード。
 * 架空の価格・空席・便時刻は表示しない。表示するのは公式に確認できる情報のみ。
 */

import { useState } from "react";
import type { CarrierPlan } from "@/services/planInfo";
import { AIRPORTS } from "@/domain/routes";
import { FALLBACK_NOTICE } from "@/domain/boardingRules";
import type { AirportCode } from "@/domain/types";
import { clockOfJstDateTime, formatMonthDay } from "@/lib/time";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { PROVENANCE_LABELS, PROVENANCE_SYMBOLS } from "@/domain/provenance";
import { OfficialSiteConfirm } from "@/components/OfficialSiteConfirm";
import { InfoChip } from "@/components/Badges";
import { useToast } from "@/components/Toast";

type Props = {
  plan: CarrierPlan;
  originAirport: AirportCode;
  destinationAirport: AirportCode;
  date: string;
  adults: number;
  checkedBaggage: boolean;
  routeLabel: string;
};

export function CarrierPlanCard({
  plan,
  originAirport,
  destinationAirport,
  date,
  adults,
  checkedBaggage,
  routeLabel,
}: Props) {
  const { showToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const provenanceKind = plan.provenance.kind;

  function saveIcs() {
    if (!plan.boarding) return;
    const ics = buildIcs({
      title: `${plan.airlineNameJa} ${originAirport}→${destinationAirport} 空港到着目標`,
      description:
        `${routeLabel}\n` +
        `${plan.terminal ?? "ターミナル不明"}へ ${clockOfJstDateTime(plan.boarding.terminalArrivalTargetAt)} までに到着\n` +
        "※列車時刻・搭乗締切は公式サイトで再確認してください。",
      startAt: plan.boarding.airportStationTargetAt,
      location: `${AIRPORTS[originAirport].nameJa} ${plan.terminal ?? ""}`.trim(),
    });
    downloadIcs(`${originAirport}-${date}-${plan.airlineCode}-airport-target.ics`, ics);
    showToast("空港到着目標をカレンダー(.ics)に保存しました");
  }

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">{plan.airlineNameJa}</h3>
        <InfoChip>{plan.categoryLabel}</InfoChip>
      </div>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-[var(--foreground-muted)]">出発ターミナル</dt>
        <dd className="font-bold">{plan.terminal ?? "不明"}</dd>
        <dt className="text-[var(--foreground-muted)]">最寄り空港駅</dt>
        <dd>{plan.terminalAccess?.stationNameJa ?? "不明"}</dd>
        <dt className="text-[var(--foreground-muted)]">駅からターミナル</dt>
        <dd>
          {plan.terminalTransferMinutes !== null
            ? `約${plan.terminalTransferMinutes}分`
            : "不明"}
        </dd>
      </dl>

      {/* 公式の搭乗締切 */}
      <div className="mt-3 rounded-lg border border-[var(--border)] p-3">
        <h4 className="text-sm font-bold">公式の搭乗締切（出発時刻から逆算）</h4>
        {plan.boardingRule ? (
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            <BoardingRow label="チェックイン締切" minutes={plan.boardingRule.checkInDeadlineMinutes} />
            {checkedBaggage ? (
              <BoardingRow
                label="手荷物預け締切"
                minutes={plan.boardingRule.baggageDropDeadlineMinutes}
              />
            ) : null}
            <BoardingRow
              label="保安検査通過目標"
              minutes={plan.boardingRule.securityRecommendedMinutes}
            />
            <BoardingRow label="搭乗口到着締切" minutes={plan.boardingRule.gateDeadlineMinutes} />
          </dl>
        ) : (
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">
            {plan.boardingRuleNote}
          </p>
        )}
        {plan.boardingRule && plan.boardingRule.securityRecommendedMinutes === undefined ? (
          <p className="mt-2 text-xs text-orange-800 dark:text-orange-300">{FALLBACK_NOTICE}</p>
        ) : null}
      </div>

      {/* 出発時刻が入力された場合のみ、具体的な空港到着目標を出す */}
      {plan.boarding ? (
        <div className="mt-3 rounded-lg border border-blue-600 bg-blue-50 p-3 dark:border-blue-500 dark:bg-blue-950/40">
          <h4 className="text-sm font-bold">空港到着目標</h4>
          <p className="mt-1 text-lg font-bold tabular-nums">
            {clockOfJstDateTime(plan.boarding.airportStationTargetAt)} までに
            {plan.terminalAccess?.stationNameJa ?? "空港駅"}
          </p>
          <p className="text-sm text-[var(--foreground-muted)]">
            {plan.terminal ?? "ターミナル"}のカウンターには{" "}
            {clockOfJstDateTime(plan.boarding.terminalArrivalTargetAt)} までに（移動{" "}
            {plan.boarding.terminalTransferMinutes}分・安全余裕{plan.boarding.safetyBufferMinutes}分を含む）
          </p>

          {plan.overnight ? (
            <p
              className={`mt-2 rounded-lg p-2 text-sm ${
                plan.overnight.recommend
                  ? "bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-100"
                  : "bg-[var(--surface-muted)] text-[var(--foreground-muted)]"
              }`}
            >
              <span className="font-bold">
                {plan.overnight.recommend ? "⚠ 前泊・早朝手段の検討をおすすめします" : "前泊の必要性"}
              </span>
              <br />
              {plan.overnight.reason}
              <br />
              {plan.overnight.note}
            </p>
          ) : null}

          <button
            type="button"
            onClick={saveIcs}
            className="mt-3 min-h-11 w-full rounded-xl border border-[var(--border)] px-4 text-sm font-bold hover:bg-[var(--surface-muted)]"
          >
            空港到着目標をカレンダーに保存（.ics）
          </button>
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--foreground-muted)]">
          公式サイトで確認した出発時刻を上のフォームに入力すると、この便の空港到着目標を計算します。
          このアプリは便の時刻を生成しません。
        </p>
      )}

      {/* 公式サイトへの導線（確認画面を経由） */}
      <div className="mt-4">
        {plan.officialLink.ok ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="min-h-12 w-full rounded-xl bg-blue-700 px-5 py-3 text-base font-bold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            公式サイトで価格・空席を確認
          </button>
        ) : (
          <p className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm">
            {plan.officialLink.reason}
          </p>
        )}
      </div>

      {/* 出所と最終確認日 */}
      <p className="mt-3 flex flex-wrap items-center gap-1 text-xs text-[var(--foreground-muted)]">
        <span aria-hidden="true">{PROVENANCE_SYMBOLS[provenanceKind]}</span>
        <span>{PROVENANCE_LABELS[provenanceKind]}</span>
        {plan.provenance.kind === "official" || plan.provenance.kind === "manualVerified" ? (
          <>
            <span>・最終確認日 {plan.provenance.checkedAt}</span>
            <a
              href={plan.provenance.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-blue-700 underline underline-offset-2 dark:text-blue-400"
            >
              情報源
            </a>
          </>
        ) : null}
      </p>

      {confirmOpen && plan.officialLink.ok ? (
        <OfficialSiteConfirm
          link={plan.officialLink}
          conditions={{
            airlineNameJa: plan.airlineNameJa,
            dateLabel: formatMonthDay(date),
            dateIso: date,
            routeLabel,
            originAirportName: AIRPORTS[originAirport].nameJa,
            destinationAirportName: AIRPORTS[destinationAirport].nameJa,
            adults,
            checkedBaggage,
            // 実用モードでは実データの便名が無いため渡さない
          }}
          onClose={() => setConfirmOpen(false)}
        />
      ) : null}
    </article>
  );
}

function BoardingRow({ label, minutes }: { label: string; minutes: number | undefined }) {
  return (
    <>
      <dt className="text-[var(--foreground-muted)]">{label}</dt>
      <dd className="tabular-nums">
        {minutes !== undefined ? `出発${minutes}分前` : "公式サイトで確認"}
      </dd>
    </>
  );
}
