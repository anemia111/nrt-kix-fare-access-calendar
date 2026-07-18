/**
 * 実データ検索の組み立て。
 *
 * 1. SerpApi の便ごとに、公式の搭乗締切から「空港駅到着目標」を算出する
 *    （既存の boardingTime ロジックをそのまま使う）
 * 2. その目標時刻を使って Google Routes へ到着時刻指定で問い合わせる
 * 3. 既存の trainSelection ロジックで「遅くとも乗るべき経路」と「推奨経路」を選ぶ
 *
 * Google Routes の無料枠を無駄に使わないため、到着目標時刻が近い便
 * （15分バケット）は1回の検索結果を共有する。
 */

import type { FlightSearchResult, TransitRoute as GoogleTransitRoute } from "@shared/dto";
import { airportStationForTerminal, ORIGIN_STATION_FOR_AIRPORT } from "@shared/stations";
import { terminalOfAirline } from "@shared/officialReference";
import { airlineCategoryOf } from "@/domain/airlines";
import { findBoardingRule } from "@/domain/boardingRules";
import type { BoardingTimeCalculation } from "@/domain/types";
import { calculateBoardingTimeFromParams } from "@/lib/boardingTime";
import { selectTrains, type TrainSelectionResult } from "@/lib/trainSelection";
import { toDomainTransitRoutes } from "@/lib/transitAdapter";
import { clockOfJstDateTime, dateOfJstDateTime } from "@/lib/time";

/** Google Routes 呼び出しをまとめるバケット幅（分）。Worker 側のキャッシュ粒度と揃える。 */
export const TRANSIT_BUCKET_MINUTES = 15;

export type FlightPlan = {
  readonly flight: FlightSearchResult;
  /** 公式データで補ったターミナル（SerpApi は返さない）。 */
  readonly terminal: string | undefined;
  readonly boarding: BoardingTimeCalculation;
  readonly originStationCode: string;
  readonly destinationStationCode: string;
  /** 空港駅到着目標（Routes への arriveBy）。 */
  readonly targetArrivalAt: string;
  /** 同じ経路検索を共有するためのキー。 */
  readonly transitKey: string;
};

export type BuildPlanOptions = {
  readonly hasCheckedBaggage: boolean;
  readonly usesOnlineCheckIn: boolean;
  readonly calculatedAt: string;
};

function minutesOfClock(clock: string): number {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}

/** ISO時刻を指定分バケットへ切り下げる（キャッシュ共有のため）。 */
export function bucketKey(iso: string, bucketMinutes = TRANSIT_BUCKET_MINUTES): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso;
  const bucketMs = bucketMinutes * 60 * 1000;
  return new Date(Math.floor(time / bucketMs) * bucketMs).toISOString();
}

/** 1便ぶんの搭乗締切計算と、必要な経路検索条件を組み立てる。 */
export function buildFlightPlan(
  flight: FlightSearchResult,
  options: BuildPlanOptions,
): FlightPlan {
  const airport = flight.departure.airport;
  // SerpApi はターミナルを返さないため、公式データ（AIRLINE_TERMINALS）で補う
  const terminal = flight.departure.terminal ?? terminalOfAirline(flight.airlineCode, airport);

  const date = dateOfJstDateTime(flight.departure.scheduledAt);
  const departureMinutes = minutesOfClock(clockOfJstDateTime(flight.departure.scheduledAt));

  const boarding = calculateBoardingTimeFromParams({
    originAirport: airport,
    originTerminal: terminal,
    operatingAirlineCode: flight.airlineCode,
    marketingAirlineCode: flight.airlineCode,
    isCodeshare: false,
    date,
    departureMinutes,
    departureAt: flight.departure.scheduledAt,
    hasCheckedBaggage: options.hasCheckedBaggage,
    usesOnlineCheckIn: options.usesOnlineCheckIn,
    calculatedAt: options.calculatedAt,
  });

  const originStationCode = ORIGIN_STATION_FOR_AIRPORT[airport];
  const destinationStationCode = airportStationForTerminal(airport, terminal);
  const targetArrivalAt = boarding.airportStationTargetAt;

  return {
    flight,
    terminal,
    boarding,
    originStationCode,
    destinationStationCode,
    targetArrivalAt,
    transitKey: `${originStationCode}|${destinationStationCode}|${bucketKey(targetArrivalAt)}`,
  };
}

export function buildFlightPlans(
  flights: readonly FlightSearchResult[],
  options: BuildPlanOptions,
): FlightPlan[] {
  return flights.map((flight) => buildFlightPlan(flight, options));
}

export type TransitRequest = {
  readonly key: string;
  readonly originStationCode: string;
  readonly destinationStationCode: string;
  readonly arriveBy: string;
};

/**
 * 便ごとの経路検索を、到着目標時刻のバケットでまとめる。
 * これにより「1便ごとに無制限にAPIを叩く」ことを避ける。
 */
export function groupTransitRequests(plans: readonly FlightPlan[]): TransitRequest[] {
  const grouped = new Map<string, TransitRequest>();
  for (const plan of plans) {
    if (grouped.has(plan.transitKey)) continue;
    grouped.set(plan.transitKey, {
      key: plan.transitKey,
      originStationCode: plan.originStationCode,
      destinationStationCode: plan.destinationStationCode,
      // バケット内では最も早い目標時刻を使う（安全側）
      arriveBy: plan.targetArrivalAt,
    });
  }

  // 同一バケットに複数便がある場合、最も早い目標時刻を採用する
  for (const plan of plans) {
    const existing = grouped.get(plan.transitKey);
    if (existing && plan.targetArrivalAt < existing.arriveBy) {
      grouped.set(plan.transitKey, { ...existing, arriveBy: plan.targetArrivalAt });
    }
  }

  return [...grouped.values()];
}

/**
 * 既存の推奨列車ロジックで、その便に対する経路を選ぶ。
 * ロジック自体は変更していない（入力の形だけ合わせている）。
 */
export function selectRoutesForFlight(
  plan: FlightPlan,
  routes: readonly GoogleTransitRoute[],
  options: { hasCheckedBaggage: boolean },
): TrainSelectionResult {
  const rule = findBoardingRule(plan.flight.airlineCode, plan.flight.departure.airport, plan.terminal);

  return selectTrains({
    routes: toDomainTransitRoutes(routes),
    targetArrivalAt: plan.targetArrivalAt,
    context: {
      airlineCategory: airlineCategoryOf(plan.flight.airlineCode),
      hasCheckedBaggage: options.hasCheckedBaggage,
      onlineCheckInAvailable: rule?.onlineCheckInAvailable ?? false,
      terminalTransferMinutes: plan.boarding.terminalTransferMinutes,
      usedBoardingFallback: plan.boarding.usedFallback,
    },
  });
}
