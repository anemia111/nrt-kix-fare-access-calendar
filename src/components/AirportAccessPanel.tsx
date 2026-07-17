"use client";

/**
 * 空港アクセスの表示（要件18・19・27・28・30・31）。
 *
 * 「推奨列車」と「遅くとも乗るべき列車」を必ず区別して表示し、
 * 推奨理由と計算根拠を開示する。搭乗を保証する表現は使わない。
 */

import { AIRLINE_CATEGORY_LABELS, airlineCategoryOf } from "@/domain/airlines";
import { FALLBACK_NOTICE } from "@/domain/boardingRules";
import type { AirportAccessRecommendation, FlightOffer, TransitRoute } from "@/domain/types";
import { validateExternalUrl } from "@/lib/externalUrl";
import { clockOfJstDateTime, formatDuration, formatFetchedAt } from "@/lib/time";
import { LATEST_SAFE_TRAIN_DISCLAIMER } from "@/lib/trainSelection";
import { ExternalLinkButton } from "./ExternalLinkButton";
import { RiskBadge } from "./Badges";

/** 経路確認に案内する鉄道会社公式サイト。許可済みドメインのみ。 */
const RAIL_OPERATORS = {
  KAMATORI: {
    nameJa: "JR東日本",
    url: "https://www.jreast.co.jp/",
    domains: ["jreast.co.jp"],
  },
  WAKAYAMA: {
    nameJa: "JR西日本",
    url: "https://www.westjr.co.jp/",
    domains: ["westjr.co.jp"],
  },
} as const;

type Props = {
  offer: FlightOffer;
  access: AirportAccessRecommendation;
};

export function AirportAccessPanel({ offer, access }: Props) {
  const category = airlineCategoryOf(offer.operatingAirlineCode);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-bold">空港アクセス</h4>
        <RiskBadge level={access.riskLevel} />
      </div>

      <p className="mt-1 text-sm text-[var(--foreground-muted)]">
        {access.originStationNameJa} → {access.destinationStationNameJa}
        {offer.originTerminal ? `（${offer.originTerminal}）` : "（ターミナル不明）"}
      </p>

      {/* 警告は最初に見せる */}
      {access.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1.5 rounded-lg bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          {access.warnings.map((warning) => (
            <li key={warning} className="flex gap-2">
              <span aria-hidden="true">⚠</span>
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {access.status === "ok" || access.status === "first_train_too_late" ? (
        <>
          {access.recommendedRoute ? (
            <RouteBlock
              title="推奨列車"
              emphasis
              route={access.recommendedRoute}
              note="鉄道の遅延や乗換の失敗に備え、遅くとも乗るべき列車より早い列車を選んでいます。"
            />
          ) : null}

          {access.latestSafeRoute ? (
            <RouteBlock
              title="遅くとも乗るべき列車"
              route={access.latestSafeRoute}
              note={LATEST_SAFE_TRAIN_DISCLAIMER}
            />
          ) : null}

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-[var(--foreground-muted)]">空港到着目標</dt>
            <dd className="font-bold tabular-nums">
              {clockOfJstDateTime(access.boarding.airportStationTargetAt)} までに
              {access.destinationStationNameJa}
            </dd>
            <dt className="text-[var(--foreground-muted)]">ターミナル到着目標</dt>
            <dd className="tabular-nums">
              {clockOfJstDateTime(access.boarding.terminalArrivalTargetAt)} までに
              {offer.originTerminal ?? "出発ターミナル"}
            </dd>
            <dt className="text-[var(--foreground-muted)]">航空会社区分</dt>
            <dd>{AIRLINE_CATEGORY_LABELS[category]}</dd>
          </dl>

          {access.recommendationReasons.length > 0 ? (
            <div className="mt-4">
              <h5 className="text-sm font-bold">推奨理由</h5>
              <ul className="mt-1.5 space-y-1 text-sm text-[var(--foreground-muted)]">
                {access.recommendationReasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <span aria-hidden="true">・</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {access.boarding.usedFallback ? (
        <p className="mt-4 rounded-lg bg-orange-100 p-3 text-sm text-orange-950 dark:bg-orange-950 dark:text-orange-100">
          {FALLBACK_NOTICE}
        </p>
      ) : null}

      {/* 詳細な計算根拠はアコーディオンで開閉できるようにする（要件40） */}
      <details className="mt-4 rounded-lg border border-[var(--border)] p-3">
        <summary className="cursor-pointer text-sm font-bold">
          搭乗締切の内訳と計算根拠
        </summary>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <DeadlineRow label="飛行機の出発時刻" at={access.boarding.flightDepartureAt} />
          <DeadlineRow label="チェックイン締切" at={access.boarding.checkInDeadlineAt} />
          <DeadlineRow label="手荷物預け締切" at={access.boarding.baggageDropDeadlineAt} />
          <DeadlineRow label="保安検査通過目標" at={access.boarding.securityTargetAt} />
          <DeadlineRow label="搭乗口到着目標" at={access.boarding.gateTargetAt} />
          <dt className="text-[var(--foreground-muted)]">ターミナル移動</dt>
          <dd className="tabular-nums">{access.boarding.terminalTransferMinutes}分</dd>
          <dt className="text-[var(--foreground-muted)]">安全余裕</dt>
          <dd className="tabular-nums">{access.boarding.safetyBufferMinutes}分</dd>
        </dl>

        <h6 className="mt-3 text-sm font-bold">計算根拠</h6>
        <ul className="mt-1.5 space-y-1 text-sm text-[var(--foreground-muted)]">
          {access.boarding.calculationReasons.map((reason) => (
            <li key={reason} className="flex gap-2">
              <span aria-hidden="true">・</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>

        {access.riskReasons.length > 0 ? (
          <>
            <h6 className="mt-3 text-sm font-bold">リスク要因</h6>
            <ul className="mt-1.5 space-y-1 text-sm text-[var(--foreground-muted)]">
              {access.riskReasons.map((reason) => (
                <li key={reason} className="flex gap-2">
                  <span aria-hidden="true">・</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <h6 className="mt-3 text-sm font-bold">情報源</h6>
        <ul className="mt-1.5 space-y-1 text-sm">
          {access.boarding.officialSources.map((url) => (
            <li key={url} className="break-all">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline underline-offset-2 dark:text-blue-400"
              >
                {url}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--foreground-muted)]">
          鉄道時刻の情報源: {access.timetableSource}
          <br />
          最終確認日時: {formatFetchedAt(access.fetchedAt)}
        </p>
      </details>

      <div className="mt-4">
        <RouteCheckLink originStationCode={access.originStationCode} />
      </div>
    </section>
  );
}

function DeadlineRow({ label, at }: { label: string; at?: string }) {
  return (
    <>
      <dt className="text-[var(--foreground-muted)]">{label}</dt>
      <dd className="tabular-nums">
        {at ? (
          clockOfJstDateTime(at)
        ) : (
          // 公式に確認できなかった項目は推測しない
          <span className="text-[var(--foreground-muted)]">公式サイトで確認</span>
        )}
      </dd>
    </>
  );
}

function RouteBlock({
  title,
  route,
  note,
  emphasis = false,
}: {
  title: string;
  route: TransitRoute;
  note: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`mt-3 rounded-lg border p-3 ${
        emphasis
          ? "border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
          : "border-[var(--border)]"
      }`}
    >
      <h5 className="text-sm font-bold">{title}</h5>
      <p className="mt-1 text-lg font-bold tabular-nums">
        {clockOfJstDateTime(route.departureAt)}発 → {clockOfJstDateTime(route.arrivalAt)}着
      </p>
      <p className="text-sm text-[var(--foreground-muted)]">
        乗換{route.transferCount}回・{formatDuration(route.durationMinutes)}
        {route.fareYen !== null ? `・${route.fareYen.toLocaleString("ja-JP")}円` : "・運賃不明"}
        {route.isFirstTrain ? "・始発" : ""}
      </p>

      <ul className="mt-2 space-y-1 text-xs text-[var(--foreground-muted)]">
        {route.legs.map((leg) => (
          <li key={`${leg.lineNameJa}-${leg.departureAt}`} className="tabular-nums">
            {leg.lineNameJa}: {leg.fromStationNameJa} {clockOfJstDateTime(leg.departureAt)}発 →{" "}
            {leg.toStationNameJa} {clockOfJstDateTime(leg.arrivalAt)}着
            {leg.transferMarginMinutes !== undefined
              ? `（乗換時間${leg.transferMarginMinutes}分）`
              : ""}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-[var(--foreground-muted)]">{note}</p>
    </div>
  );
}

/** 経路確認リンク（要件31）。公式ドメインのみ許可する。 */
function RouteCheckLink({ originStationCode }: { originStationCode: string }) {
  const operator =
    RAIL_OPERATORS[originStationCode as keyof typeof RAIL_OPERATORS] ?? null;
  if (!operator) return null;

  const validation = validateExternalUrl(operator.url, operator.domains);
  if (!validation.ok) return null;

  return (
    <>
      <ExternalLinkButton href={validation.url} variant="secondary">
        列車経路を確認（{operator.nameJa}公式サイト）
      </ExternalLinkButton>
      <p className="mt-2 text-xs text-[var(--foreground-muted)]">
        公式のディープリンク仕様を確認できていないため、出発駅・到着駅・日付は
        引き継がれません。公式サイトで条件を入力して確認してください。
      </p>
    </>
  );
}
