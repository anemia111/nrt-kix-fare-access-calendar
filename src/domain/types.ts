/**
 * アプリ全体で使うドメイン型。
 *
 * 設計方針: 「取得できなかった」ことを型で表現する。価格・空席・料金内訳・
 * 手荷物条件はいずれも「不明」を表せるようにし、推測値が混入できないようにする
 * （要件7・9・48）。数値が入っている＝提供元から取得できた、という不変条件を守る。
 */

import type { JstDate, JstDateTime } from "@/lib/time";
import type { TimePeriod } from "./timePeriods";

export type AirportCode = "NRT" | "KIX";

export const ROUTE_IDS = ["NRT-KIX", "KIX-NRT"] as const;
export type RouteId = (typeof ROUTE_IDS)[number];

export type AirlineCategory = "LCC" | "FSC" | "HYBRID" | "UNKNOWN";

/** データの出所。デモか実データかを必ず持ち回り、画面に表示する。 */
export type DataSource = {
  readonly providerId: string;
  readonly providerNameJa: string;
  readonly isDemo: boolean;
  readonly fetchedAt: JstDateTime;
};

/**
 * 料金内訳。`known: false` のときは金額を一切持たない。
 * API が総額しか返さない場合に内訳を推測してはいけない（要件7）。
 */
export type FareBreakdown =
  | {
      readonly known: true;
      readonly baseFareYen: number;
      readonly taxYen: number;
      readonly airportFacilityFeeYen: number;
      readonly mandatoryBookingFeeYen: number;
      readonly paymentFeeYen: number;
      /** どの支払方法を基準にしたか（要件7）。 */
      readonly paymentMethodNote: string;
      readonly notes: readonly string[];
    }
  | {
      readonly known: false;
      readonly notes: readonly string[];
    };

export type AvailabilityStatus =
  /** 正確な残席数を取得できた場合のみ */
  | "exact"
  | "available"
  | "few"
  | "undisclosed"
  | "unknown"
  | "recheck"
  | "sold_out"
  | "unavailable"
  /** API が返すのが実残席数ではなく「一度に予約可能な最大人数」の場合 */
  | "max_pax";

export type Availability =
  | { readonly status: "exact"; readonly seatsRemaining: number }
  | { readonly status: "max_pax"; readonly maxSearchablePax: number }
  | {
      readonly status: Exclude<AvailabilityStatus, "exact" | "max_pax">;
    };

/** 手荷物・座席指定など、金額や条件が不明になりうる項目。 */
export type OptionalCondition =
  | { readonly known: true; readonly description: string; readonly feeYen?: number }
  | { readonly known: false };

export type FlightOffer = {
  readonly id: string;
  readonly routeId: RouteId;
  readonly date: JstDate;
  readonly period: TimePeriod;
  /** 販売航空会社（IATA）。公式リンクは原則こちらを優先する。 */
  readonly marketingAirlineCode: string;
  /** 実際の運航航空会社（IATA）。 */
  readonly operatingAirlineCode: string;
  readonly flightNumber: string;
  readonly isCodeshare: boolean;
  readonly originAirport: AirportCode;
  readonly destinationAirport: AirportCode;
  /** 不明な場合は undefined。画面では「不明」と表示する。 */
  readonly originTerminal?: string;
  readonly destinationTerminal?: string;
  readonly departureAt: JstDateTime;
  readonly arrivalAt: JstDateTime;
  /** 出発時刻の 00:00 からの経過分。時間帯判定に使う。 */
  readonly departureMinutes: number;
  readonly durationMinutes: number;
  readonly isDirect: boolean;
  /**
   * 手数料込みの総額（円）。null は「価格を取得できなかった」を意味する。
   * 0 円や推測値で埋めてはいけない。
   */
  readonly totalPriceYen: number | null;
  readonly priceErrorReason?: string;
  readonly fareBreakdown: FareBreakdown;
  readonly carryOnBaggage: OptionalCondition;
  readonly checkedBaggage: OptionalCondition;
  readonly seatSelection: OptionalCondition;
  readonly availability: Availability;
  /** 航空券API が公式の予約ディープリンクを返した場合のみ設定する。 */
  readonly officialDeepLinkUrl?: string;
  readonly source: DataSource;
};

export type PriceBand = "cheapest" | "cheap" | "average" | "expensive" | "unknown";

/** その日にオファーを表示できない理由。状況を区別する（要件6）。 */
export type DailyFareStatus =
  | "ok"
  /** 選択中の時間帯に該当する便が無い */
  | "no_matching_period"
  /** その日の運航便自体が無い */
  | "no_flights"
  /** 該当便はあるが全て満席 */
  | "sold_out"
  | "no_data"
  | "price_error"
  | "timetable_unpublished";

export type DailyLowestFare = {
  readonly date: JstDate;
  readonly status: DailyFareStatus;
  readonly offer?: FlightOffer;
  readonly band: PriceBand;
  readonly fetchedAt: JstDateTime;
};

// ---------------------------------------------------------------------------
// 空港アクセス
// ---------------------------------------------------------------------------

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "UNAVAILABLE";

export const RISK_LABELS: Readonly<Record<RiskLevel, string>> = {
  LOW: "余裕あり",
  MEDIUM: "通常",
  HIGH: "余裕が少ない",
  UNAVAILABLE: "当日移動では間に合わない",
};

/**
 * 目標空港到着時刻の算出結果。「なぜこの時刻なのか」を説明できるよう、
 * 各締切と根拠・情報源を保持する（要件22）。
 */
export type BoardingTimeCalculation = {
  readonly flightDepartureAt: JstDateTime;
  readonly checkInDeadlineAt?: JstDateTime;
  readonly baggageDropDeadlineAt?: JstDateTime;
  readonly securityTargetAt?: JstDateTime;
  readonly gateTargetAt?: JstDateTime;
  /** 空港の最寄駅に到着していなければならない時刻。 */
  readonly airportStationTargetAt: JstDateTime;
  /** ターミナルの入口（カウンター）に到着していなければならない時刻。 */
  readonly terminalArrivalTargetAt: JstDateTime;
  readonly terminalTransferMinutes: number;
  readonly safetyBufferMinutes: number;
  readonly calculationReasons: readonly string[];
  readonly officialSources: readonly string[];
  /** 航空会社固有の公式ルールを取得できず、区分別の目安を使った場合 true。 */
  readonly usedFallback: boolean;
  readonly calculatedAt: JstDateTime;
};

export type TransitLeg = {
  readonly lineNameJa: string;
  readonly fromStationNameJa: string;
  readonly toStationNameJa: string;
  readonly departureAt: JstDateTime;
  readonly arrivalAt: JstDateTime;
  /** 乗換に使える時間（分）。前の列車の到着から次の列車の発車まで。 */
  readonly transferMarginMinutes?: number;
};

export type TransitRoute = {
  readonly id: string;
  readonly legs: readonly TransitLeg[];
  readonly departureAt: JstDateTime;
  readonly arrivalAt: JstDateTime;
  readonly transferCount: number;
  readonly durationMinutes: number;
  /** 運賃を取得できない場合は null。推測しない（要件43）。 */
  readonly fareYen: number | null;
  /** 始発列車かどうか。 */
  readonly isFirstTrain: boolean;
  readonly source: DataSource;
};

export type AirportAccessStatus =
  | "ok"
  /** 始発でも目標時刻に間に合わない */
  | "first_train_too_late"
  /** 対象日の時刻表が未公開 */
  | "timetable_unpublished"
  /** 経路APIのエラー・タイムアウト */
  | "provider_error";

export type AirportAccessRecommendation = {
  readonly flightOfferId: string;
  readonly status: AirportAccessStatus;
  readonly originStationCode: string;
  readonly originStationNameJa: string;
  readonly destinationStationCode: string;
  readonly destinationStationNameJa: string;
  readonly boarding: BoardingTimeCalculation;
  /** 目標時刻に間に合う最も遅い列車。搭乗を保証するものではない。 */
  readonly latestSafeRoute?: TransitRoute;
  /** 安全余裕を考慮して推奨する列車。原則 latestSafeRoute より早い。 */
  readonly recommendedRoute?: TransitRoute;
  readonly riskLevel: RiskLevel;
  readonly riskReasons: readonly string[];
  /** 推奨列車を選んだ理由（要件18）。 */
  readonly recommendationReasons: readonly string[];
  readonly warnings: readonly string[];
  readonly timetableSource: string;
  readonly realtimeInfoAvailable: boolean;
  readonly fetchedAt: JstDateTime;
};
