"use client";

/**
 * 実データ検索（SerpApi + Google Routes）の画面。
 *
 * 段階表示:
 *   1. 「航空券を検索しています…」→ 便を表示
 *   2. 「空港アクセスを計算しています…」→ 経路を後から差し込む
 *
 * 片方のAPIが失敗しても全画面エラーにしない。
 * 本番モードではデモデータへ自動フォールバックしない。
 */

import { useCallback, useState } from "react";
import type { FlightSearchInput, TransitAvailability } from "@shared/dto";
import type { PlanSearchConditions } from "@/domain/planSearch";
import { ROUTES } from "@/domain/routes";
import {
  buildFlightPlans,
  groupTransitRequests,
  selectRoutesForFlight,
  type FlightPlan,
} from "@/services/liveSearch";
import {
  describeFailure,
  isLiveSearchConfigured,
  PROVIDER_NOT_CONFIGURED_MESSAGE,
  searchFlights,
  searchTransit,
} from "@/lib/apiClient";
import { FlightResultCard, type TransitState } from "./FlightResultCard";

type Phase =
  | { kind: "idle" }
  | { kind: "searchingFlights" }
  | { kind: "flightsFailed"; message: string }
  | {
      kind: "ready";
      plans: FlightPlan[];
      search: FlightSearchInput;
      isCached: boolean;
      cacheAgeSeconds: number;
      fetchedAt: string;
      filteredOutCount: number;
    };

type Props = {
  conditions: PlanSearchConditions;
};

export function LiveSearchView({ conditions }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [transitByKey, setTransitByKey] = useState<Record<string, TransitState>>({});
  const [transitLoading, setTransitLoading] = useState(false);

  const configured = isLiveSearchConfigured();

  const runSearch = useCallback(async () => {
    if (!configured) return;

    const route = ROUTES[conditions.routeId];
    const search: FlightSearchInput = {
      origin: route.origin,
      destination: route.destination,
      date: conditions.date,
      adults: conditions.adults,
    };

    setPhase({ kind: "searchingFlights" });
    setTransitByKey({});

    // --- 1. 航空券 ---
    const flightResult = await searchFlights(search);
    if (!flightResult.ok) {
      setPhase({ kind: "flightsFailed", message: describeFailure(flightResult.failure, "flight") });
      return;
    }

    const calculatedAt = new Date().toISOString();
    const plans = buildFlightPlans(flightResult.value.flights, {
      hasCheckedBaggage: conditions.checkedBaggage,
      usesOnlineCheckIn: true,
      calculatedAt,
    });

    // 便を先に表示する（経路は後から差し込む）
    setPhase({
      kind: "ready",
      plans,
      search,
      isCached: flightResult.value.cache.isCached,
      cacheAgeSeconds: flightResult.value.cache.cacheAgeSeconds,
      fetchedAt: flightResult.value.cache.fetchedAt,
      filteredOutCount: flightResult.value.filteredOutCount,
    });

    if (plans.length === 0) return;

    // --- 2. 公共交通（到着目標が近い便はまとめて1回だけ問い合わせる） ---
    const requests = groupTransitRequests(plans);
    setTransitLoading(true);
    // 状態は便ID単位で持つ（同じバケットの便は1回の検索結果を共有する）
    setTransitByKey(
      Object.fromEntries(plans.map((plan) => [plan.flight.id, { kind: "loading" } as TransitState])),
    );

    /** そのバケットに属する便すべてへ同じ状態を反映する。 */
    const applyToGroup = (requestKey: string, make: (plan: FlightPlan) => TransitState) => {
      setTransitByKey((current) => {
        const next = { ...current };
        for (const plan of plans) {
          if (plan.transitKey === requestKey) next[plan.flight.id] = make(plan);
        }
        return next;
      });
    };

    await Promise.all(
      requests.map(async (request) => {
        const result = await searchTransit({
          originStationCode: request.originStationCode,
          destinationAirport: route.origin,
          destinationStationCode: request.destinationStationCode,
          arriveBy: request.arriveBy,
        });

        if (!result.ok) {
          // 鉄道側の失敗は航空券結果を消さない
          const message = describeFailure(result.failure, "transit");
          applyToGroup(request.key, () => ({ kind: "error", message }));
          return;
        }

        const availability: TransitAvailability = result.value.availability;
        if (availability.kind !== "available") {
          applyToGroup(request.key, () =>
            availability.kind === "scheduleUnavailable"
              ? { kind: "scheduleUnavailable", reason: availability.reason }
              : { kind: "error", message: availability.reason },
          );
          return;
        }

        // 同じバケットの便それぞれについて、既存ロジックで経路を選ぶ
        applyToGroup(request.key, (plan) => ({
          kind: "ready",
          selection: selectRoutesForFlight(plan, availability.routes, {
            hasCheckedBaggage: conditions.checkedBaggage,
          }),
        }));
      }),
    );

    setTransitLoading(false);
  }, [conditions, configured]);

  if (!configured) {
    return (
      <section className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/40">
        <h3 className="text-base font-bold">{PROVIDER_NOT_CONFIGURED_MESSAGE}</h3>
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          実際の便・価格を検索するには、Cloudflare Worker のURLを
          <code className="mx-1 rounded bg-[var(--surface-muted)] px-1">NEXT_PUBLIC_API_BASE_URL</code>
          に設定し、Worker 側に SerpApi と Google Maps のキーを登録してください。
          設定方法は README を参照してください。
        </p>
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          未設定でもデモデータへは切り替えません（架空の価格を本番情報として表示しないため）。
          下の公式情報（搭乗締切・ターミナル・空港到着目標）はそのまま利用できます。
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">実際の便を検索</h3>
        <span className="rounded-md bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white dark:bg-emerald-600">
          <span aria-hidden="true">✔</span> 実データ検索
        </span>
      </div>

      <button
        type="button"
        onClick={runSearch}
        disabled={phase.kind === "searchingFlights"}
        className="mt-3 min-h-12 w-full rounded-xl bg-blue-700 px-5 py-3 text-base font-bold text-white hover:bg-blue-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
      >
        {phase.kind === "searchingFlights" ? "検索中…" : "この条件で航空券を検索"}
      </button>

      <div aria-live="polite" className="mt-3">
        {phase.kind === "searchingFlights" ? (
          <div className="space-y-2">
            <p className="text-sm text-[var(--foreground-muted)]">航空券を検索しています…</p>
            {[0, 1, 2].map((index) => (
              <div key={index} className="skeleton h-32 rounded-xl" />
            ))}
          </div>
        ) : null}

        {phase.kind === "flightsFailed" ? (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
            <span aria-hidden="true">⚠</span> {phase.message}
          </p>
        ) : null}

        {phase.kind === "ready" ? (
          <>
            <p className="text-sm text-[var(--foreground-muted)]">
              {phase.plans.length}件の便が見つかりました（対象航空会社のみ）。
              {phase.filteredOutCount > 0
                ? ` 対象外・乗継便 ${phase.filteredOutCount}件は除外しています。`
                : ""}
              <br />
              出典: SerpApi / Google Flights ／ 取得: {phase.fetchedAt.slice(11, 16)}
              {phase.isCached
                ? `（キャッシュ ${Math.round(phase.cacheAgeSeconds / 60)}分前）`
                : "（ライブ取得）"}
            </p>

            {transitLoading ? (
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                空港アクセスを計算しています…
              </p>
            ) : null}

            {phase.plans.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--foreground-muted)]">
                この条件では対象航空会社の直行便が見つかりませんでした。
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-4">
                {phase.plans.map((plan) => (
                  <FlightResultCard
                    key={plan.flight.id}
                    plan={plan}
                    search={phase.search}
                    hasCheckedBaggage={conditions.checkedBaggage}
                    transit={transitByKey[plan.flight.id] ?? { kind: "loading" }}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
