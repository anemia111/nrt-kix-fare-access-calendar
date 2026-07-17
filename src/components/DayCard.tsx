"use client";

/**
 * カレンダーの日付マス（要件6）。
 *
 * 最低限、日付・時間帯・最安価格・航空会社名・出発時刻・空席状況・
 * 最終更新時刻・価格帯を表示する。対象便が無い場合は理由を区別して表示する。
 */

import { airlineDisplayName } from "@/domain/airlines";
import { TIME_PERIOD_DEFINITIONS } from "@/domain/timePeriods";
import type { DailyFareStatus, DailyLowestFare } from "@/domain/types";
import { holidayNameOf } from "@/domain/holidays";
import { clockOfJstDateTime, formatFetchedAt, formatMonthDay, weekdayLabel } from "@/lib/time";
import { formatYen } from "@/lib/format";
import { AvailabilityBadge, PriceBandBadge } from "./Badges";

/** 対象便を表示できない理由。状況ごとに文言を分ける（要件6）。 */
const STATUS_LABELS: Readonly<Record<Exclude<DailyFareStatus, "ok">, string>> = {
  no_matching_period: "対象便なし",
  no_flights: "運航便なし",
  sold_out: "満席",
  no_data: "データなし",
  price_error: "価格取得エラー",
  timetable_unpublished: "時刻表未公開",
};

const STATUS_DESCRIPTIONS: Readonly<Record<Exclude<DailyFareStatus, "ok">, string>> = {
  no_matching_period: "選択中の時間帯に該当する便がありません",
  no_flights: "この日はこの路線の運航便がありません",
  sold_out: "該当する便はすべて満席です",
  no_data: "データを取得できませんでした",
  price_error: "価格を取得できませんでした",
  timetable_unpublished: "この日の時刻表はまだ公開されていません",
};

type Props = {
  fare: DailyLowestFare;
  onSelect: (date: string) => void;
};

export function DayCard({ fare, onSelect }: Props) {
  const holiday = holidayNameOf(fare.date);
  const weekday = weekdayLabel(fare.date);
  const isWeekend = weekday === "土" || weekday === "日" || holiday !== null;

  const dateHeader = (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-base font-bold">{formatMonthDay(fare.date)}</span>
      <span
        className={`text-xs font-bold ${
          holiday || weekday === "日"
            ? "text-red-700 dark:text-red-400"
            : weekday === "土"
              ? "text-blue-700 dark:text-blue-400"
              : "text-[var(--foreground-muted)]"
        }`}
      >
        {weekday}
        {holiday ? `・${holiday}` : ""}
      </span>
    </div>
  );

  if (fare.status !== "ok" || !fare.offer) {
    const status = fare.status === "ok" ? "no_data" : fare.status;
    return (
      <div
        className={`flex min-h-32 flex-col gap-1 rounded-xl border border-dashed border-[var(--border)] p-3 ${
          isWeekend ? "bg-[var(--surface-muted)]" : "bg-[var(--surface)]"
        }`}
      >
        {dateHeader}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="text-sm font-bold text-[var(--foreground-muted)]">
            {STATUS_LABELS[status]}
          </span>
          <span className="mt-1 text-xs leading-snug text-[var(--foreground-muted)]">
            {STATUS_DESCRIPTIONS[status]}
          </span>
        </div>
      </div>
    );
  }

  const offer = fare.offer;
  const periodLabel = TIME_PERIOD_DEFINITIONS[offer.period].labelJa;

  return (
    <button
      type="button"
      onClick={() => onSelect(fare.date)}
      aria-label={`${formatMonthDay(fare.date)}の便の詳細を表示`}
      className={`flex min-h-32 flex-col gap-1 rounded-xl border border-[var(--border)] p-3 text-left transition-colors hover:border-blue-600 hover:bg-[var(--surface-muted)] ${
        isWeekend ? "bg-[var(--surface-muted)]" : "bg-[var(--surface)]"
      }`}
    >
      {dateHeader}

      <div className="flex flex-wrap items-center gap-1">
        <span className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-xs font-bold">
          {periodLabel}
        </span>
        <PriceBandBadge band={fare.band} />
      </div>

      {/* 要件40: 価格が最も目立つ。文字を小さくしすぎない。 */}
      <p className="text-xl font-bold leading-tight tabular-nums">
        {formatYen(offer.totalPriceYen)}
      </p>

      <p className="truncate text-sm text-[var(--foreground-muted)]">
        {airlineDisplayName(offer.marketingAirlineCode)}
      </p>
      <p className="text-sm tabular-nums text-[var(--foreground-muted)]">
        {clockOfJstDateTime(offer.departureAt)}発・{offer.flightNumber}
      </p>

      <div className="mt-auto flex flex-col gap-1 pt-1">
        <AvailabilityBadge availability={offer.availability} />
        <span className="text-[10px] text-[var(--foreground-muted)]">
          {formatFetchedAt(fare.fetchedAt)}
        </span>
      </div>
    </button>
  );
}

export function DayCardSkeleton() {
  return <div className="skeleton min-h-32 rounded-xl" aria-hidden="true" />;
}
