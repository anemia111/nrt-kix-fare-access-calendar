"use client";

/**
 * Google Routes で取得した公共交通経路の表示。
 * 「推奨経路」と「遅くとも乗るべき経路」を区別して示す（既存ロジックの結果）。
 */

import type { TrainSelectionResult } from "@/lib/trainSelection";
import type { TransitRoute } from "@/domain/types";
import { STATIONS, type StationCode } from "@shared/stations";
import { clockOfJstDateTime, formatDuration } from "@/lib/time";
import { RiskBadge } from "@/components/Badges";

type Props = {
  selection: TrainSelectionResult;
  originStationCode: string;
  destinationStationCode: string;
};

function stationName(code: string): string {
  return STATIONS[code as StationCode]?.nameJa ?? code;
}

export function TransitRouteView({ selection, originStationCode, destinationStationCode }: Props) {
  return (
    <section className="rounded-lg border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold">
          推奨アクセス（{stationName(originStationCode)} → {stationName(destinationStationCode)}）
        </h4>
        <RiskBadge level={selection.riskLevel} />
      </div>

      {selection.status === "first_train_too_late" ? (
        <p className="mt-2 rounded-lg bg-orange-100 p-3 text-sm text-orange-950 dark:bg-orange-950 dark:text-orange-100">
          この便に間に合う公共交通経路が見つかりませんでした。前日の移動や、空港バス・
          タクシーなどの検討が必要です。
        </p>
      ) : null}

      {selection.recommendedRoute ? (
        <RouteBlock title="推奨経路" route={selection.recommendedRoute} emphasis />
      ) : null}

      {selection.latestSafeRoute &&
      selection.latestSafeRoute.id !== selection.recommendedRoute?.id ? (
        <RouteBlock title="遅くとも乗るべき経路" route={selection.latestSafeRoute} />
      ) : null}

      {selection.recommendedRoute ? (
        <p className="mt-2 text-xs text-[var(--foreground-muted)]">
          安全余裕: {selection.requiredSlackMinutes}分 ／ 出典: Google Routes
        </p>
      ) : null}

      {selection.warnings.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-[var(--foreground-muted)]">
          {selection.warnings.map((warning) => (
            <li key={warning} className="flex gap-1">
              <span aria-hidden="true">⚠</span>
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {selection.recommendationReasons.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-bold">推奨理由</summary>
          <ul className="mt-1 space-y-1 text-xs text-[var(--foreground-muted)]">
            {selection.recommendationReasons.map((reason) => (
              <li key={reason}>・{reason}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function RouteBlock({
  title,
  route,
  emphasis = false,
}: {
  title: string;
  route: TransitRoute;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`mt-2 rounded-lg border p-3 ${
        emphasis
          ? "border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
          : "border-[var(--border)]"
      }`}
    >
      <p className="text-xs font-bold">{title}</p>
      <p className="text-lg font-bold tabular-nums">
        {clockOfJstDateTime(route.departureAt)}発 → {clockOfJstDateTime(route.arrivalAt)}着
      </p>
      <p className="text-sm text-[var(--foreground-muted)]">
        乗換{route.transferCount}回・{formatDuration(route.durationMinutes)}
        {route.fareYen !== null ? `・${route.fareYen.toLocaleString("ja-JP")}円` : "・運賃不明"}
      </p>
      <ul className="mt-1 space-y-0.5 text-xs tabular-nums text-[var(--foreground-muted)]">
        {route.legs.map((leg) => (
          <li key={`${leg.lineNameJa}-${leg.departureAt}`}>
            {leg.lineNameJa}: {leg.fromStationNameJa} {clockOfJstDateTime(leg.departureAt)}発 →{" "}
            {leg.toStationNameJa} {clockOfJstDateTime(leg.arrivalAt)}着
            {leg.transferMarginMinutes !== undefined
              ? `（乗換${leg.transferMarginMinutes}分）`
              : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
