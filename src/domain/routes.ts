/**
 * 対応路線と出発駅の定義。
 *
 * 初期リリースでは対象空港を NRT と KIX、出発駅を鎌取駅と和歌山駅に限定する
 * （要件38）。出発空港がどちらかによって、案内する出発駅が決まる。
 */

import type { AirportCode, RouteId } from "./types";

export type Airport = {
  readonly code: AirportCode;
  readonly nameJa: string;
  readonly shortNameJa: string;
};

export const AIRPORTS: Readonly<Record<AirportCode, Airport>> = {
  NRT: { code: "NRT", nameJa: "成田国際空港", shortNameJa: "成田" },
  KIX: { code: "KIX", nameJa: "関西国際空港", shortNameJa: "関空" },
};

export type OriginStation = {
  readonly stationCode: string;
  readonly stationNameJa: string;
  /** この駅から向かう空港。 */
  readonly airportCode: AirportCode;
};

export const ORIGIN_STATIONS: Readonly<Record<AirportCode, OriginStation>> = {
  NRT: {
    stationCode: "KAMATORI",
    stationNameJa: "鎌取駅",
    airportCode: "NRT",
  },
  KIX: {
    stationCode: "WAKAYAMA",
    stationNameJa: "和歌山駅",
    airportCode: "KIX",
  },
};

export type RouteDefinition = {
  readonly id: RouteId;
  readonly origin: AirportCode;
  readonly destination: AirportCode;
  /** タブに表示する短い名前。 */
  readonly labelJa: string;
  readonly fullLabelJa: string;
};

export const ROUTES: Readonly<Record<RouteId, RouteDefinition>> = {
  "NRT-KIX": {
    id: "NRT-KIX",
    origin: "NRT",
    destination: "KIX",
    labelJa: "成田 → 関空",
    fullLabelJa: "成田国際空港（NRT） → 関西国際空港（KIX）",
  },
  "KIX-NRT": {
    id: "KIX-NRT",
    origin: "KIX",
    destination: "NRT",
    labelJa: "関空 → 成田",
    fullLabelJa: "関西国際空港（KIX） → 成田国際空港（NRT）",
  },
};

export const DEFAULT_ROUTE_ID: RouteId = "NRT-KIX";

export function isRouteId(value: unknown): value is RouteId {
  return value === "NRT-KIX" || value === "KIX-NRT";
}

/** URL クエリの route を解釈する。不正値は既定の路線にフォールバックする。 */
export function parseRouteParam(raw: string | null | undefined): RouteId {
  const normalized = raw?.trim().toUpperCase();
  return isRouteId(normalized) ? normalized : DEFAULT_ROUTE_ID;
}

/** 出発地と到着地を入れ替えた路線を返す。 */
export function swapRoute(routeId: RouteId): RouteId {
  return routeId === "NRT-KIX" ? "KIX-NRT" : "NRT-KIX";
}

/** その路線の出発空港へ向かう出発駅。 */
export function originStationOfRoute(routeId: RouteId): OriginStation {
  return ORIGIN_STATIONS[ROUTES[routeId].origin];
}

/** 検索対象の日数（現在日から何日先まで）。 */
export const CALENDAR_DAYS = 90;

/** 検索条件の既定値（要件3）。 */
export const DEFAULT_SEARCH_CONDITIONS = {
  adults: 1,
  tripType: "one_way",
  cabinClass: "economy",
  seatSelection: false,
  checkedBaggage: false,
  currency: "JPY",
  preferDirect: true,
} as const;
