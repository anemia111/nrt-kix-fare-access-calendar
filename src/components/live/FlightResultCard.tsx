"use client";

/**
 * 実データの便カード。
 *
 * 表示するデータの出典を必ず区別する:
 *  - 航空券: SerpApi / Google Flights
 *  - 鉄道経路: Google Routes
 *  - 搭乗締切: 航空会社公式
 *  - ターミナル: 空港／航空会社公式
 */

import { useState } from "react";
import type {
  BookingOptionsResponse,
  FlightSearchInput,
  FlightSearchResult,
} from "@shared/dto";
import type { TrainSelectionResult } from "@/lib/trainSelection";
import type { FlightPlan } from "@/services/liveSearch";
import { identityOf } from "@shared/serpapiTransform";
import {
  describeFailure,
  fetchBookingOptions,
  revalidateFlight,
} from "@/lib/apiClient";
import { clockOfJstDateTime, formatDuration } from "@/lib/time";
import { LATEST_SAFE_TRAIN_DISCLAIMER } from "@/lib/trainSelection";
import { RiskBadge, InfoChip } from "@/components/Badges";
import { PriceChangeDialog } from "./PriceChangeDialog";
import { BookingOptionsPanel } from "./BookingOptionsPanel";
import { TransitRouteView } from "./TransitRouteView";

export type TransitState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly selection: TrainSelectionResult }
  | { readonly kind: "scheduleUnavailable"; readonly reason: string }
  | { readonly kind: "error"; readonly message: string };

type Props = {
  plan: FlightPlan;
  search: FlightSearchInput;
  transit: TransitState;
  hasCheckedBaggage: boolean;
};

type RevalidateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "priceChanged"; previous: number; current: number; checkedAt: string; flight: FlightSearchResult }
  | { kind: "confirmed"; flight: FlightSearchResult; checkedAt: string }
  | { kind: "soldOut"; checkedAt: string }
  | { kind: "notMatched"; reason: string }
  | { kind: "error"; message: string };

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function FlightResultCard({ plan, search, transit }: Props) {
  const { flight } = plan;
  const [revalidate, setRevalidate] = useState<RevalidateState>({ kind: "idle" });
  const [booking, setBooking] = useState<BookingOptionsResponse | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const isBusy = revalidate.kind === "checking";

  async function onRevalidate() {
    // 二重送信を防ぐ
    if (isBusy) return;
    setRevalidate({ kind: "checking" });
    setBookingError(null);

    const result = await revalidateFlight({
      search,
      identity: identityOf(flight),
      previousPriceAmount: flight.price?.amount ?? null,
    });

    if (!result.ok) {
      setRevalidate({ kind: "error", message: describeFailure(result.failure, "flight") });
      return;
    }

    const value = result.value;
    if (value.status === "priceChanged") {
      setRevalidate({
        kind: "priceChanged",
        previous: value.previousAmount,
        current: value.currentAmount,
        checkedAt: value.checkedAt,
        flight: value.flight,
      });
      return;
    }
    if (value.status === "soldOut") {
      setRevalidate({ kind: "soldOut", checkedAt: value.checkedAt });
      return;
    }
    if (value.status === "notMatched") {
      setRevalidate({ kind: "notMatched", reason: value.reason });
      return;
    }
    setRevalidate({ kind: "confirmed", flight: value.flight, checkedAt: value.checkedAt });
    await loadBookingOptions(value.flight);
  }

  async function loadBookingOptions(target: FlightSearchResult) {
    if (!target.bookingToken) {
      setBooking({
        options: [],
        fetchedAt: new Date().toISOString(),
        unavailableReason:
          "この便の購入オプションが提供されていません。航空会社の公式サイトで確認してください",
      });
      return;
    }
    const result = await fetchBookingOptions({ bookingToken: target.bookingToken, search });
    if (!result.ok) {
      setBookingError(describeFailure(result.failure, "flight"));
      return;
    }
    setBooking(result.value);
  }

  const seat = flight.seatAvailability;

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      {/* 便の基本情報 */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-base font-bold">{flight.airlineName}</span>{" "}
          <span className="text-sm text-[var(--foreground-muted)]">
            {flight.flightNumber ?? "便名不明"}
          </span>
        </div>
        <p className="text-lg font-bold tabular-nums">
          {flight.departure.airport} {clockOfJstDateTime(flight.departure.scheduledAt)} →{" "}
          {flight.arrival.airport} {clockOfJstDateTime(flight.arrival.scheduledAt)}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {plan.terminal ? <InfoChip>{plan.terminal}</InfoChip> : <InfoChip>ターミナル不明</InfoChip>}
        {flight.durationMinutes ? (
          <InfoChip>{formatDuration(flight.durationMinutes)}</InfoChip>
        ) : null}
        <InfoChip>直行便</InfoChip>
      </div>

      {/* 価格（最も目立たせる） */}
      <div className="mt-3">
        <p className="text-sm text-[var(--foreground-muted)]">現在価格</p>
        <p className="text-2xl font-bold tabular-nums">
          {flight.price ? formatYen(flight.price.amount) : "価格を取得できません"}
        </p>
        <p className="text-xs text-[var(--foreground-muted)]">
          取得: {clockOfJstDateTime(flight.fetchedAt.replace("Z", "+00:00"))} ／ 出典: SerpApi /
          Google Flights
        </p>
      </div>

      {/* 空席: 正確な残席数が無い限り席数を出さない */}
      <p className="mt-2 text-sm">
        {seat.kind === "exact" ? (
          <>
            <span aria-hidden="true">●</span> 残り{seat.remainingSeats}席（{seat.source}）
          </>
        ) : seat.kind === "bookable" ? (
          <>
            <span aria-hidden="true">●</span> 現在予約候補あり
            <span className="block text-xs text-[var(--foreground-muted)]">
              予約可否は購入画面で最終確認してください（Google Flights は残席数を提供しません）
            </span>
          </>
        ) : seat.kind === "soldOut" ? (
          <>
            <span aria-hidden="true">×</span> 満席
          </>
        ) : (
          <>
            <span aria-hidden="true">?</span> 予約可否は購入画面で最終確認
            <span className="block text-xs text-[var(--foreground-muted)]">{seat.reason}</span>
          </>
        )}
      </p>

      {/* 空港到着目標（搭乗締切から算出・出典は航空会社公式） */}
      <div className="mt-3 rounded-lg border border-blue-600 bg-blue-50 p-3 dark:border-blue-500 dark:bg-blue-950/40">
        <p className="text-sm font-bold">搭乗締切を考慮した空港駅到着目標</p>
        <p className="text-xl font-bold tabular-nums">
          {clockOfJstDateTime(plan.boarding.airportStationTargetAt)}
        </p>
        <p className="text-xs text-[var(--foreground-muted)]">
          {plan.terminal ?? "ターミナル"}のカウンターには{" "}
          {clockOfJstDateTime(plan.boarding.terminalArrivalTargetAt)} までに（移動{" "}
          {plan.boarding.terminalTransferMinutes}分・安全余裕 {plan.boarding.safetyBufferMinutes}
          分を含む）／ 出典: 航空会社公式・空港公式
        </p>
      </div>

      {/* 公共交通経路（Google Routes・後から追加表示される） */}
      <div className="mt-3">
        {transit.kind === "loading" ? (
          <div className="rounded-lg border border-[var(--border)] p-3" aria-live="polite">
            <div className="skeleton h-4 w-40 rounded" />
            <p className="mt-2 text-sm text-[var(--foreground-muted)]">
              空港アクセスを計算しています…
            </p>
          </div>
        ) : null}

        {transit.kind === "error" ? (
          <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            <span aria-hidden="true">⚠</span> {transit.message}
          </p>
        ) : null}

        {transit.kind === "scheduleUnavailable" ? (
          <p className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--foreground-muted)]">
            {transit.reason}
          </p>
        ) : null}

        {transit.kind === "ready" ? (
          <TransitRouteView
            selection={transit.selection}
            originStationCode={plan.originStationCode}
            destinationStationCode={plan.destinationStationCode}
          />
        ) : null}
      </div>

      {/* 再確認 → 予約導線 */}
      <div className="mt-4">
        {revalidate.kind === "idle" || revalidate.kind === "error" ? (
          <button
            type="button"
            onClick={onRevalidate}
            disabled={isBusy}
            className="min-h-12 w-full rounded-xl bg-blue-700 px-5 py-3 text-base font-bold text-white hover:bg-blue-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            最新価格・予約可否を確認
          </button>
        ) : null}

        {isBusy ? (
          <div
            aria-live="polite"
            className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] px-5 py-3 text-sm"
          >
            最新価格を確認しています…
          </div>
        ) : null}

        {revalidate.kind === "error" ? (
          <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
            {revalidate.message}
          </p>
        ) : null}

        {revalidate.kind === "notMatched" ? (
          <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            {revalidate.reason}
          </p>
        ) : null}

        {revalidate.kind === "soldOut" ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
            この便は現在予約できない可能性があります。航空会社公式サイトで確認してください。
          </p>
        ) : null}

        {revalidate.kind === "confirmed" ? (
          <p className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm">
            価格に変更はありませんでした（
            {revalidate.flight.price ? formatYen(revalidate.flight.price.amount) : "価格不明"}）。
          </p>
        ) : null}

        {bookingError ? (
          <p className="mt-2 rounded-lg bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            {bookingError}
          </p>
        ) : null}

        {booking ? (
          <BookingOptionsPanel
            airlineCode={flight.airlineCode}
            airlineName={flight.airlineName}
            options={booking.options}
            unavailableReason={booking.unavailableReason}
            fetchedAt={booking.fetchedAt}
          />
        ) : null}
      </div>

      {transit.kind === "ready" && transit.selection.latestSafeRoute ? (
        <p className="mt-3 text-xs text-[var(--foreground-muted)]">
          {LATEST_SAFE_TRAIN_DISCLAIMER}
        </p>
      ) : null}

      {revalidate.kind === "priceChanged" ? (
        <PriceChangeDialog
          previousAmount={revalidate.previous}
          currentAmount={revalidate.current}
          checkedAt={revalidate.checkedAt}
          onContinue={() => {
            const confirmed = revalidate.flight;
            setRevalidate({ kind: "confirmed", flight: confirmed, checkedAt: revalidate.checkedAt });
            void loadBookingOptions(confirmed);
          }}
          onBack={() => setRevalidate({ kind: "idle" })}
        />
      ) : null}
    </article>
  );
}

export { RiskBadge };
