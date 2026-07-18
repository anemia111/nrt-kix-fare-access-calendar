/**
 * Google Routes の DTO を、既存の推奨列車ロジック（`selectTrains`）が扱える
 * ドメイン型へ変換する。
 *
 * 推奨列車の選定ロジックは既存のものをそのまま使う（乗換回数・乗換時間・
 * ラッシュ・LCC厳格性・預け荷物・ターミナル移動などで安全余裕を積み上げる）。
 * ここは「入力の形をそろえる」だけで、判断ロジックは変えない。
 *
 * 制約: Google Routes は「その列車が始発かどうか」を返さないため
 * `isFirstTrain` は false 固定になる。始発近接による加算は効かないが、
 * 架空の情報を作るよりは安全側の情報を1つ使わない方を選んでいる。
 */

import type { TransitRoute as GoogleTransitRoute } from "@shared/dto";
import type { TransitLeg, TransitRoute } from "@/domain/types";

/** 連続する乗車区間の間隔（＝乗換に使える時間）を分で求める。 */
function transferMarginMinutes(previousArrivalAt: string, nextDepartureAt: string): number {
  const gap = Date.parse(nextDepartureAt) - Date.parse(previousArrivalAt);
  if (!Number.isFinite(gap)) return 0;
  return Math.max(0, Math.round(gap / 60000));
}

/**
 * shared の TransitRoute（Google Routes 由来）を domain の TransitRoute へ。
 * 徒歩区間は乗車区間ではないため legs には含めず、乗換時間の算出に使う。
 */
export function toDomainTransitRoute(route: GoogleTransitRoute): TransitRoute {
  const legs: TransitLeg[] = [];
  let previousArrivalAt: string | null = null;

  for (const leg of route.legs) {
    if (leg.mode !== "TRAIN" && leg.mode !== "BUS") continue;

    const margin =
      previousArrivalAt === null
        ? undefined
        : transferMarginMinutes(previousArrivalAt, leg.departureAt);

    legs.push({
      lineNameJa: leg.lineName ?? (leg.mode === "BUS" ? "バス" : "鉄道"),
      fromStationNameJa: leg.departureStop,
      toStationNameJa: leg.arrivalStop,
      departureAt: leg.departureAt,
      arrivalAt: leg.arrivalAt,
      transferMarginMinutes: margin,
    });
    previousArrivalAt = leg.arrivalAt;
  }

  return {
    id: route.id,
    legs,
    departureAt: route.departureAt,
    arrivalAt: route.arrivalAt,
    transferCount: route.transfers,
    durationMinutes: route.durationMinutes,
    fareYen: route.fare?.amount ?? null,
    // Google Routes は始発かどうかを返さないため false 固定
    isFirstTrain: false,
    source: {
      providerId: "google-routes",
      providerNameJa: "Google Routes",
      isDemo: false,
      fetchedAt: route.fetchedAt,
    },
  };
}

export function toDomainTransitRoutes(
  routes: readonly GoogleTransitRoute[],
): TransitRoute[] {
  return routes.map(toDomainTransitRoute);
}
