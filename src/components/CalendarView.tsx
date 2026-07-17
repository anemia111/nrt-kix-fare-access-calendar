"use client";

/**
 * 最安値カレンダー本体（要件4・5・6・8）。
 *
 * 路線・時間帯を切り替えてもページ全体は再読み込みせず、カレンダーのデータだけを
 * 更新する。選択状態は URL のクエリパラメータにも保存する。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CALENDAR_DAYS, ROUTES, parseRouteParam } from "@/domain/routes";
import {
  parsePeriodsParam,
  serializePeriods,
  type SelectableTimePeriod,
} from "@/domain/timePeriods";
import type { DailyLowestFare, RouteId } from "@/domain/types";
import { CACHE_TTL_MINUTES, TtlCache } from "@/lib/cache";
import { addDays, formatYearMonth, todayInJst } from "@/lib/time";
import { MockFlightProvider } from "@/providers/flight/mockFlightProvider";
import { MockTransitProvider } from "@/providers/transit/mockTransitProvider";
import { DayCard, DayCardSkeleton } from "./DayCard";
import { DayDetailDrawer } from "./DayDetailDrawer";
import { PeriodChips } from "./PeriodChips";
import { RouteTabs } from "./RouteTabs";
import { PRICE_BAND_LABELS, PRICE_BAND_SYMBOLS } from "@/lib/priceBand";

/** 同一条件の短時間検索ではキャッシュを使う（要件39）。 */
const calendarCache = new TtlCache<DailyLowestFare[]>(CACHE_TTL_MINUTES.flightPrice);

export function CalendarView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const routeId = parseRouteParam(searchParams.get("route"));
  const periods = useMemo(
    () => parsePeriodsParam(searchParams.get("periods")),
    [searchParams],
  );

  const [fares, setFares] = useState<DailyLowestFare[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const today = useMemo(() => todayInJst(), []);

  // 手動更新のたびに新しい取得時刻でプロバイダーを作り直す。
  const flightProvider = useMemo(() => new MockFlightProvider(), []);
  const transitProvider = useMemo(() => new MockTransitProvider(today), [today]);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `${routeId}:${serializePeriods(periods)}:${today}`;

    async function load() {
      setLoadError(null);

      const cached = reloadToken === 0 ? calendarCache.get(cacheKey) : undefined;
      if (cached) {
        setFares(cached);
        return;
      }

      setFares(null);
      try {
        const result = await flightProvider.getLowestFareByDate({
          routeId,
          startDate: today,
          days: CALENDAR_DAYS,
          periods,
          adults: 1,
        });
        if (cancelled) return;
        calendarCache.set(cacheKey, result);
        setFares(result);
      } catch (error) {
        if (cancelled) return;
        // エラーに内部情報を含めない（要件42）
        setLoadError("価格情報を取得できませんでした。時間をおいて再度お試しください。");
        console.error(error);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [routeId, periods, today, flightProvider, reloadToken]);

  const updateQuery = useCallback(
    (next: { route?: RouteId; periods?: readonly SelectableTimePeriod[] }) => {
      const params = new URLSearchParams();
      params.set("route", next.route ?? routeId);
      params.set("periods", serializePeriods(next.periods ?? periods));
      // ページ全体を再読み込みせず、クエリだけを差し替える
      router.replace(`/calendar/?${params.toString()}`, { scroll: false });
    },
    [router, routeId, periods],
  );

  const months = useMemo(() => (fares ? groupByMonth(fares) : []), [fares]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5">
      <div className="flex flex-col gap-4">
        <RouteTabs routeId={routeId} onChange={(next) => updateQuery({ route: next })} />
        <PeriodChips
          periods={periods}
          onChange={(next) => updateQuery({ periods: next })}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">
          {ROUTES[routeId].fullLabelJa}
          <span className="ml-2 text-sm font-normal text-[var(--foreground-muted)]">
            本日から{CALENDAR_DAYS}日先まで・大人1名・片道
          </span>
        </h2>
        <button
          type="button"
          onClick={() => setReloadToken((token) => token + 1)}
          className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-bold transition-colors hover:bg-[var(--surface-muted)]"
        >
          価格を再取得
        </button>
      </div>

      <PriceBandLegend />

      {loadError ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border-2 border-red-500 bg-red-50 p-4 text-sm dark:bg-red-950/40"
        >
          <p className="font-bold">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            className="mt-3 min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-bold"
          >
            再試行
          </button>
        </div>
      ) : null}

      {!fares && !loadError ? (
        <div className="mt-4" aria-live="polite">
          <p className="mb-3 text-sm text-[var(--foreground-muted)]">
            最安値を読み込んでいます…
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }, (_, index) => (
              <DayCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : null}

      {fares && fares.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--foreground-muted)]">
          表示できる日付がありません。
        </p>
      ) : null}

      {months.map((month) => (
        <section key={month.key} className="mt-6">
          <h3 className="mb-2 text-lg font-bold">{month.label}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {month.fares.map((fare) => (
              <DayCard key={fare.date} fare={fare} onSelect={setSelectedDate} />
            ))}
          </div>
        </section>
      ))}

      {selectedDate ? (
        <DayDetailDrawer
          date={selectedDate}
          routeId={routeId}
          periods={periods}
          flightProvider={flightProvider}
          transitProvider={transitProvider}
          onClose={() => setSelectedDate(null)}
        />
      ) : null}
    </div>
  );
}

function PriceBandLegend() {
  const bands = ["cheapest", "cheap", "average", "expensive"] as const;
  return (
    <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--foreground-muted)]">
      <span className="font-bold">価格帯:</span>
      {bands.map((band) => (
        <span key={band}>
          {PRICE_BAND_SYMBOLS[band]} {PRICE_BAND_LABELS[band]}
        </span>
      ))}
      <span>
        （表示中の期間の価格を基準に判定。データが少ない場合や差が小さい場合は判定しません）
      </span>
    </p>
  );
}

type MonthGroup = {
  key: string;
  label: string;
  fares: DailyLowestFare[];
};

/** 月単位に区切る（要件6）。 */
function groupByMonth(fares: readonly DailyLowestFare[]): MonthGroup[] {
  const groups = new Map<string, DailyLowestFare[]>();
  for (const fare of fares) {
    const key = fare.date.slice(0, 7);
    const existing = groups.get(key);
    if (existing) {
      existing.push(fare);
    } else {
      groups.set(key, [fare]);
    }
  }
  return [...groups.entries()].map(([key, monthFares]) => ({
    key,
    label: formatYearMonth(`${key}-01`),
    fares: monthFares,
  }));
}

export { addDays };
