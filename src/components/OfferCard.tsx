"use client";

/**
 * 便の詳細カード（要件10・11・16）。
 *
 * 取得できない項目は推測せず「不明」または「公式サイトで確認」と表示する。
 * 予約確定と誤解させる表現は使わない。
 */

import { useState } from "react";
import { AIRLINE_CATEGORY_LABELS, airlineCategoryOf, airlineDisplayName } from "@/domain/airlines";
import { TIME_PERIOD_DEFINITIONS } from "@/domain/timePeriods";
import { ROUTES } from "@/domain/routes";
import type { AirportAccessRecommendation, FlightOffer } from "@/domain/types";
import { formatYen, UNKNOWN_LABEL, CHECK_OFFICIAL_LABEL } from "@/lib/format";
import {
  OFFICIAL_SITE_REMINDER,
  resolveOfficialLink,
  OFFICIAL_LINK_LEVEL_LABELS,
} from "@/lib/officialLink";
import { clockOfJstDateTime, formatDuration, formatFetchedAt, formatMonthDay } from "@/lib/time";
import type { FlightOfferRefreshResult } from "@/providers/flight/FlightProvider";
import { AirportAccessPanel } from "./AirportAccessPanel";
import { AvailabilityBadge, InfoChip } from "./Badges";
import { ExternalLinkButton } from "./ExternalLinkButton";
import { describeAvailability } from "@/lib/format";

type Props = {
  offer: FlightOffer;
  access: AirportAccessRecommendation | null;
  onRefresh: (offerId: string) => Promise<FlightOfferRefreshResult>;
};

export function OfferCard({ offer, access, onRefresh }: Props) {
  const [refreshState, setRefreshState] = useState<
    { phase: "idle" } | { phase: "checking" } | { phase: "done"; result: FlightOfferRefreshResult }
  >({ phase: "idle" });

  const link = resolveOfficialLink(offer);
  const availability = describeAvailability(offer.availability);
  const category = airlineCategoryOf(offer.operatingAirlineCode);

  async function handleCheckPrice() {
    setRefreshState({ phase: "checking" });
    const result = await onRefresh(offer.id);
    setRefreshState({ phase: "done", result });
  }

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      {/* 要件40: 価格 → 出発時刻 → 航空会社 → 空席状況 の順に目立たせる */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-2xl font-bold tabular-nums">{formatYen(offer.totalPriceYen)}</p>
        <p className="text-lg font-bold tabular-nums">
          {clockOfJstDateTime(offer.departureAt)} → {clockOfJstDateTime(offer.arrivalAt)}
        </p>
      </div>

      {offer.totalPriceYen === null ? (
        <p className="mt-1 text-sm text-red-700 dark:text-red-400">
          {offer.priceErrorReason ?? "価格を取得できませんでした"}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-base font-bold">
          {airlineDisplayName(offer.marketingAirlineCode)}
        </span>
        <span className="text-sm text-[var(--foreground-muted)]">{offer.flightNumber}</span>
        <InfoChip>{AIRLINE_CATEGORY_LABELS[category]}</InfoChip>
        <InfoChip>{TIME_PERIOD_DEFINITIONS[offer.period].labelJa}</InfoChip>
        {offer.isDirect ? <InfoChip>直行便</InfoChip> : <InfoChip>直行便ではありません</InfoChip>}
      </div>

      {/* 要件14: 販売と運航を区別する */}
      {offer.isCodeshare ? (
        <p className="mt-2 rounded-lg bg-[var(--surface-muted)] p-2 text-sm">
          販売：{airlineDisplayName(offer.marketingAirlineCode)}
          <br />
          運航：{airlineDisplayName(offer.operatingAirlineCode)}
        </p>
      ) : null}

      <div className="mt-3">
        <AvailabilityBadge availability={offer.availability} />
        <p className="mt-1 text-xs text-[var(--foreground-muted)]">{availability.description}</p>
      </div>

      {/* 詳細情報 */}
      <details className="mt-3 rounded-lg border border-[var(--border)] p-3">
        <summary className="cursor-pointer text-sm font-bold">便の詳細</summary>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-[var(--foreground-muted)]">路線</dt>
          <dd>{ROUTES[offer.routeId].fullLabelJa}</dd>
          <dt className="text-[var(--foreground-muted)]">搭乗日</dt>
          <dd>{formatMonthDay(offer.date)}</dd>
          <dt className="text-[var(--foreground-muted)]">出発空港</dt>
          <dd>{offer.originAirport}</dd>
          <dt className="text-[var(--foreground-muted)]">出発ターミナル</dt>
          <dd>{offer.originTerminal ?? UNKNOWN_LABEL}</dd>
          <dt className="text-[var(--foreground-muted)]">到着空港</dt>
          <dd>{offer.destinationAirport}</dd>
          <dt className="text-[var(--foreground-muted)]">到着ターミナル</dt>
          <dd>{offer.destinationTerminal ?? UNKNOWN_LABEL}</dd>
          <dt className="text-[var(--foreground-muted)]">所要時間</dt>
          <dd>{formatDuration(offer.durationMinutes)}</dd>
          <dt className="text-[var(--foreground-muted)]">機内持込手荷物</dt>
          <dd>{offer.carryOnBaggage.known ? offer.carryOnBaggage.description : CHECK_OFFICIAL_LABEL}</dd>
          <dt className="text-[var(--foreground-muted)]">預け荷物</dt>
          <dd>
            {offer.checkedBaggage.known
              ? offer.checkedBaggage.description
              : `${CHECK_OFFICIAL_LABEL}（この検索では預け荷物なしの条件です）`}
          </dd>
          <dt className="text-[var(--foreground-muted)]">価格取得時刻</dt>
          <dd>{formatFetchedAt(offer.source.fetchedAt)}</dd>
          <dt className="text-[var(--foreground-muted)]">データ提供元</dt>
          <dd>{offer.source.providerNameJa}</dd>
        </dl>
      </details>

      {/* 料金内訳 */}
      <details className="mt-2 rounded-lg border border-[var(--border)] p-3">
        <summary className="cursor-pointer text-sm font-bold">料金内訳</summary>
        {offer.fareBreakdown.known ? (
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            <dt className="text-[var(--foreground-muted)]">基本運賃</dt>
            <dd className="tabular-nums">{formatYen(offer.fareBreakdown.baseFareYen)}</dd>
            <dt className="text-[var(--foreground-muted)]">税金</dt>
            <dd className="tabular-nums">{formatYen(offer.fareBreakdown.taxYen)}</dd>
            <dt className="text-[var(--foreground-muted)]">空港施設使用料</dt>
            <dd className="tabular-nums">{formatYen(offer.fareBreakdown.airportFacilityFeeYen)}</dd>
            <dt className="text-[var(--foreground-muted)]">必須予約手数料</dt>
            <dd className="tabular-nums">{formatYen(offer.fareBreakdown.mandatoryBookingFeeYen)}</dd>
            <dt className="text-[var(--foreground-muted)]">決済手数料</dt>
            <dd className="tabular-nums">{formatYen(offer.fareBreakdown.paymentFeeYen)}</dd>
            <dt className="font-bold">合計</dt>
            <dd className="font-bold tabular-nums">{formatYen(offer.totalPriceYen)}</dd>
            <dt className="text-[var(--foreground-muted)]">預け荷物料金</dt>
            <dd>{CHECK_OFFICIAL_LABEL}</dd>
            <dt className="text-[var(--foreground-muted)]">座席指定料金</dt>
            <dd>{CHECK_OFFICIAL_LABEL}</dd>
          </dl>
        ) : (
          <div className="mt-3 space-y-1 text-sm text-[var(--foreground-muted)]">
            {/* 内訳を取得できない場合、金額を推測してはいけない（要件7） */}
            {offer.fareBreakdown.notes.map((note) => (
              <p key={note}>・{note}</p>
            ))}
          </div>
        )}
        {offer.fareBreakdown.known ? (
          <p className="mt-2 text-xs text-[var(--foreground-muted)]">
            {offer.fareBreakdown.paymentMethodNote}
            {offer.fareBreakdown.notes.map((note) => (
              <span key={note}>
                <br />
                {note}
              </span>
            ))}
          </p>
        ) : null}
      </details>

      {/* 空港アクセス */}
      {access ? (
        <div className="mt-3">
          <AirportAccessPanel offer={offer} access={access} />
        </div>
      ) : null}

      {/* 公式サイトへの導線 */}
      <div className="mt-4">
        {link.ok ? (
          <>
            {refreshState.phase === "idle" ? (
              <button
                type="button"
                onClick={handleCheckPrice}
                className="flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-base font-bold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                最新価格を確認して公式サイトへ進む
              </button>
            ) : null}

            {refreshState.phase === "checking" ? (
              <div className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] px-5 py-3 text-sm">
                最新価格を確認しています…
              </div>
            ) : null}

            {refreshState.phase === "done" ? (
              <RefreshResultView
                result={refreshState.result}
                originalPriceYen={offer.totalPriceYen}
                linkUrl={link.url}
                linkLabel={link.label}
                onCancel={() => setRefreshState({ phase: "idle" })}
              />
            ) : null}

            <p className="mt-2 text-xs text-[var(--foreground-muted)]">
              {OFFICIAL_SITE_REMINDER}
            </p>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">
              リンク先: {link.host}（{OFFICIAL_LINK_LEVEL_LABELS[link.level]}）
              {!link.carriesSearchConditions
                ? "。搭乗日・路線などの条件は引き継がれません。"
                : ""}
            </p>
          </>
        ) : (
          // 誤ったリンクを表示しない（要件13）
          <p className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm">{link.reason}</p>
        )}
      </div>
    </article>
  );
}

function RefreshResultView({
  result,
  originalPriceYen,
  linkUrl,
  linkLabel,
  onCancel,
}: {
  result: FlightOfferRefreshResult;
  originalPriceYen: number | null;
  linkUrl: string;
  linkLabel: string;
  onCancel: () => void;
}) {
  if (result.status === "unavailable") {
    return (
      <div className="rounded-lg border-2 border-red-500 bg-red-50 p-3 dark:bg-red-950/40">
        <p className="text-sm font-bold text-red-900 dark:text-red-200">
          この便は現在予約できない可能性があります。
          <br />
          航空会社公式サイトで最新状況を確認してください。
        </p>
        <div className="mt-3">
          <ExternalLinkButton href={linkUrl} variant="secondary">
            空席状況を確認
          </ExternalLinkButton>
        </div>
      </div>
    );
  }

  if (result.status === "price_changed") {
    return (
      <div className="rounded-lg border-2 border-amber-500 bg-amber-50 p-3 dark:bg-amber-950/40">
        <p className="text-sm font-bold">価格が更新されました</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[var(--foreground-muted)]">取得時</dt>
          <dd className="tabular-nums line-through">{formatYen(result.previousPriceYen)}</dd>
          <dt className="text-[var(--foreground-muted)]">現在</dt>
          <dd className="text-base font-bold tabular-nums">{formatYen(result.currentPriceYen)}</dd>
        </dl>
        <div className="mt-3 space-y-2">
          <ExternalLinkButton href={linkUrl}>
            更新後の価格を確認して公式サイトへ進む
          </ExternalLinkButton>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-bold"
          >
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  if (result.status === "unchanged") {
    return (
      <div>
        <p className="mb-2 text-sm text-[var(--foreground-muted)]">
          価格は変わっていません（{formatYen(originalPriceYen)}）。
        </p>
        <ExternalLinkButton href={linkUrl}>{linkLabel}</ExternalLinkButton>
      </div>
    );
  }

  // unsupported / not_found
  return (
    <div>
      <p className="mb-2 text-sm text-[var(--foreground-muted)]">
        最新価格を再確認できませんでした。公式サイトで最終価格を確認してください。
      </p>
      <ExternalLinkButton href={linkUrl}>{linkLabel}</ExternalLinkButton>
    </div>
  );
}
