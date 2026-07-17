/**
 * 空港アクセス推奨の組み立て（要件17〜19・28）。
 *
 * 搭乗締切の計算 → 対象日の経路取得 → 列車選定 を1つにまとめ、
 * 「なぜこの列車なのか」を説明できる形で返す。
 */

import { airlineCategoryOf } from "@/domain/airlines";
import { findBoardingRule } from "@/domain/boardingRules";
import { AIRPORT_STATIONS, findTerminalAccess, worstCaseTransferMinutes } from "@/domain/terminals";
import { ORIGIN_STATIONS } from "@/domain/routes";
import type { AirportAccessRecommendation, FlightOffer } from "@/domain/types";
import { calculateBoardingTime } from "@/lib/boardingTime";
import { selectTrains } from "@/lib/trainSelection";
import { demoServiceWarning } from "@/providers/transit/mockTransitProvider";
import type { TransitProvider } from "@/providers/transit/TransitProvider";
import { formatMonthDay, type JstDateTime } from "@/lib/time";

export type AirportAccessInput = {
  readonly offer: FlightOffer;
  readonly hasCheckedBaggage: boolean;
  readonly usesOnlineCheckIn: boolean;
  readonly transitProvider: TransitProvider;
  readonly calculatedAt: JstDateTime;
};

export const REALTIME_UNAVAILABLE_NOTICE =
  "通常ダイヤに基づく計算です。最新の運行情報は鉄道会社公式サイトで確認してください。";

export async function buildAirportAccess(
  input: AirportAccessInput,
): Promise<AirportAccessRecommendation> {
  const { offer, hasCheckedBaggage, usesOnlineCheckIn, transitProvider, calculatedAt } = input;

  const boarding = calculateBoardingTime({
    offer,
    hasCheckedBaggage,
    usesOnlineCheckIn,
    calculatedAt,
  });

  const originStation = ORIGIN_STATIONS[offer.originAirport];

  // 航空会社のターミナルに応じて降車駅を決める。
  // 成田は第1ターミナルなら成田空港駅、第2・第3ターミナルなら空港第2ビル駅。
  const access = findTerminalAccess(offer.originAirport, offer.originTerminal);
  const destinationStationCode =
    access?.stationCode ?? defaultStationOf(offer.originAirport);
  const destinationStation = AIRPORT_STATIONS[destinationStationCode];

  const warnings: string[] = [];
  if (!access) {
    warnings.push(
      "出発ターミナルを特定できなかったため、この空港で最も移動に時間がかかるターミナルを想定して計算しています。",
    );
  }

  const searchResult = await transitProvider.searchRoutes({
    originStationCode: originStation.stationCode,
    destinationStationCode,
    date: offer.date,
    arriveBy: boarding.airportStationTargetAt,
  });

  const base = {
    flightOfferId: offer.id,
    originStationCode: originStation.stationCode,
    originStationNameJa: originStation.stationNameJa,
    destinationStationCode,
    destinationStationNameJa: destinationStation?.stationNameJa ?? "不明",
    boarding,
    timetableSource: searchResult.timetableSource,
    realtimeInfoAvailable: transitProvider.supportsRealtime,
    fetchedAt: searchResult.fetchedAt,
  } as const;

  // 対象日の時刻表が未公開なら、経路を捏造せずその旨を返す。
  if (searchResult.status === "timetable_unpublished") {
    return {
      ...base,
      status: "timetable_unpublished",
      riskLevel: "UNAVAILABLE",
      riskReasons: ["対象日の正式な時刻表がまだ公開されていません。"],
      recommendationReasons: [],
      warnings: [
        `対象日（${formatMonthDay(offer.date)}）の正式な時刻表はまだ公開されていません。`,
        `時刻表が公開されているのは ${formatMonthDay(searchResult.publishedUntil)} までです。`,
        "出発日が近づいてから、鉄道会社公式の経路検索で確認してください。",
      ],
    };
  }

  if (searchResult.status === "error") {
    return {
      ...base,
      status: "provider_error",
      riskLevel: "UNAVAILABLE",
      riskReasons: ["経路情報を取得できませんでした。"],
      recommendationReasons: [],
      warnings: [
        "現在、最新の列車情報を再確認できません。",
        "公式経路検索と航空会社公式サイトで確認してください。",
        searchResult.reason,
      ],
    };
  }

  const selection = selectTrains({
    routes: searchResult.routes,
    targetArrivalAt: boarding.airportStationTargetAt,
    context: {
      airlineCategory: airlineCategoryOf(offer.operatingAirlineCode),
      hasCheckedBaggage,
      onlineCheckInAvailable: onlineCheckInAvailableFor(offer),
      terminalTransferMinutes: boarding.terminalTransferMinutes,
      usedBoardingFallback: boarding.usedFallback,
    },
  });

  warnings.push(...selection.warnings);

  // リアルタイム運行情報を取得できない場合は、その旨を明示する。
  if (!transitProvider.supportsRealtime) {
    warnings.push(REALTIME_UNAVAILABLE_NOTICE);
  }

  const serviceWarning = demoServiceWarning(originStation.stationCode, offer.date);
  if (serviceWarning) {
    warnings.push(serviceWarning);
  }

  if (searchResult.timetableKind === "unknown") {
    warnings.push(
      "対象日の平日・土休日ダイヤを判定できなかったため、安全側に計算しています。",
    );
  }

  return {
    ...base,
    status: selection.status === "first_train_too_late" ? "first_train_too_late" : "ok",
    latestSafeRoute: selection.latestSafeRoute,
    recommendedRoute: selection.recommendedRoute,
    riskLevel: selection.riskLevel,
    riskReasons: selection.riskReasons,
    recommendationReasons: selection.recommendationReasons,
    warnings,
  };
}

function defaultStationOf(airportCode: FlightOffer["originAirport"]): string {
  // ターミナル不明時は、その空港で最も時間がかかる想定に合う駅を選ぶ。
  if (airportCode === "NRT") {
    // 第3ターミナル（最も時間がかかる）の最寄駅
    return "NRT-T2BLDG";
  }
  return "KIX-AIRPORT";
}

function onlineCheckInAvailableFor(offer: FlightOffer): boolean {
  const rule =
    findBoardingRule(offer.operatingAirlineCode, offer.originAirport, offer.originTerminal) ??
    findBoardingRule(offer.marketingAirlineCode, offer.originAirport, offer.originTerminal);
  return rule?.onlineCheckInAvailable ?? false;
}

/** ターミナル不明時に使う移動時間（表示用）。 */
export function fallbackTransferMinutes(airportCode: FlightOffer["originAirport"]): number {
  return worstCaseTransferMinutes(airportCode);
}
