"use client";

/**
 * 日付詳細のドロワー（要件10）。
 *
 * 選択中の時間帯に該当する便を、手数料込み価格が安い順に最大5件表示する。
 */

import { useEffect, useRef, useState } from "react";
import type { SelectableTimePeriod } from "@/domain/timePeriods";
import type { AirportAccessRecommendation, FlightOffer, RouteId } from "@/domain/types";
import { ROUTES, originStationOfRoute } from "@/domain/routes";
import { buildAirportAccess } from "@/services/airportAccess";
import { compareOffers } from "@/providers/flight/mockFlightProvider";
import type { FlightProvider, FlightOfferRefreshResult } from "@/providers/flight/FlightProvider";
import type { TransitProvider } from "@/providers/transit/TransitProvider";
import { formatMonthDay, weekdayLabel } from "@/lib/time";
import { holidayNameOf } from "@/domain/holidays";
import { OfferCard } from "./OfferCard";

/** 詳細に表示する最大件数（要件10）。 */
const MAX_OFFERS = 5;

type Props = {
  date: string;
  routeId: RouteId;
  periods: readonly SelectableTimePeriod[];
  flightProvider: FlightProvider;
  transitProvider: TransitProvider;
  onClose: () => void;
};

type LoadState =
  | { phase: "loading" }
  | { phase: "empty" }
  | {
      phase: "ready";
      offers: FlightOffer[];
      accesses: Map<string, AirportAccessRecommendation>;
    };

export function DayDetailDrawer({
  date,
  routeId,
  periods,
  flightProvider,
  transitProvider,
  onClose,
}: Props) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ phase: "loading" });
      const found = await flightProvider.searchFlights({
        routeId,
        date,
        periods,
        adults: 1,
      });
      const offers = [...found].sort(compareOffers).slice(0, MAX_OFFERS);

      if (offers.length === 0) {
        if (!cancelled) setState({ phase: "empty" });
        return;
      }

      const calculatedAt = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16);
      const accesses = new Map<string, AirportAccessRecommendation>();
      await Promise.all(
        offers.map(async (offer) => {
          const access = await buildAirportAccess({
            offer,
            hasCheckedBaggage: false,
            usesOnlineCheckIn: true,
            transitProvider,
            calculatedAt: `${calculatedAt}:00+09:00`,
          });
          accesses.set(offer.id, access);
        }),
      );

      if (!cancelled) setState({ phase: "ready", offers, accesses });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [date, routeId, periods, flightProvider, transitProvider]);

  // Escape で閉じる。開いたらフォーカスを移す。
  useEffect(() => {
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const holiday = holidayNameOf(date);
  const originStation = originStationOfRoute(routeId);

  async function handleRefresh(offerId: string): Promise<FlightOfferRefreshResult> {
    return flightProvider.refreshOffer(offerId);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-[var(--background)] sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-4">
          <div>
            <h2 id="drawer-title" className="text-lg font-bold">
              {formatMonthDay(date)}（{weekdayLabel(date)}
              {holiday ? `・${holiday}` : ""}）
            </h2>
            <p className="text-sm text-[var(--foreground-muted)]">
              {ROUTES[routeId].fullLabelJa}
            </p>
            <p className="text-xs text-[var(--foreground-muted)]">
              空港アクセスは{originStation.stationNameJa}からの経路を表示しています
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-xl"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {state.phase === "loading" ? (
            <div className="space-y-3" aria-live="polite">
              <p className="text-sm text-[var(--foreground-muted)]">便の情報を読み込んでいます…</p>
              {[0, 1, 2].map((index) => (
                <div key={index} className="skeleton h-40 rounded-xl" />
              ))}
            </div>
          ) : null}

          {state.phase === "empty" ? (
            <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--foreground-muted)]">
              選択中の時間帯に該当する便がありません。
              <br />
              時間帯の選択を変更すると、対象の便が見つかる場合があります。
            </p>
          ) : null}

          {state.phase === "ready" ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--foreground-muted)]">
                選択中の時間帯に該当する便を、手数料込みの価格が安い順に最大{MAX_OFFERS}
                件表示しています。
              </p>
              {state.offers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  access={state.accesses.get(offer.id) ?? null}
                  onRefresh={handleRefresh}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
