/**
 * 実用モードの検索条件。
 *
 * 実用モードでは架空の便を扱わないため、この条件は「どの路線の・いつの・
 * どんな条件で公式情報を見たいか」を表す。任意で、利用者が公式サイトで確認した
 * 出発時刻を入力でき、その場合だけ空港到着目標を具体的な時刻で計算する
 * （こちらで便時刻を生成することはしない）。
 */

import { ORIGIN_STATIONS, parseRouteParam, ROUTES } from "./routes";
import {
  parsePeriodsParam,
  serializePeriods,
  type SelectableTimePeriod,
} from "./timePeriods";
import { todayInJst, type JstDate } from "@/lib/time";
import type { RouteId } from "./types";

export type PlanSearchConditions = {
  readonly routeId: RouteId;
  readonly date: JstDate;
  readonly adults: number;
  readonly checkedBaggage: boolean;
  readonly periods: readonly SelectableTimePeriod[];
  readonly originStationCode: string;
  /** 利用者が公式サイトで確認した出発時刻（任意）。"HH:mm" または null。 */
  readonly departureTime: string | null;
};

export const MAX_ADULTS = 9;

export function defaultPlanConditions(today: JstDate = todayInJst()): PlanSearchConditions {
  const routeId: RouteId = "NRT-KIX";
  return {
    routeId,
    date: today,
    adults: 1,
    checkedBaggage: false,
    periods: ["morning", "daytime", "evening"],
    originStationCode: ORIGIN_STATIONS[ROUTES[routeId].origin].stationCode,
    departureTime: null,
  };
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDepartureTime(value: string | null | undefined): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

/** 路線から出発駅を導く（現状は路線ごとに1駅）。 */
export function originStationOf(routeId: RouteId): string {
  return ORIGIN_STATIONS[ROUTES[routeId].origin].stationCode;
}

/** URLクエリ（またはLocalStorage）から検索条件を復元する。不正値は既定へ。 */
export function parsePlanConditions(
  params: URLSearchParams,
  today: JstDate = todayInJst(),
): PlanSearchConditions {
  const base = defaultPlanConditions(today);
  const routeId = parseRouteParam(params.get("route"));
  const dateRaw = params.get("date");
  const date = dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : base.date;

  const adultsRaw = Number(params.get("adults"));
  const adults =
    Number.isInteger(adultsRaw) && adultsRaw >= 1 && adultsRaw <= MAX_ADULTS
      ? adultsRaw
      : base.adults;

  const departureTimeRaw = params.get("dep");
  const departureTime = isValidDepartureTime(departureTimeRaw) ? departureTimeRaw : null;

  return {
    routeId,
    date,
    adults,
    checkedBaggage: params.get("bag") === "1",
    periods: parsePeriodsParam(params.get("periods")),
    // 出発駅は路線から決まる。将来の複数駅対応に備えクエリも見るが、路線に整合しなければ既定。
    originStationCode: originStationOf(routeId),
    departureTime,
  };
}

/** 検索条件をURLクエリ文字列にする（共有・復元用）。 */
export function serializePlanConditions(conditions: PlanSearchConditions): string {
  const params = new URLSearchParams();
  params.set("route", conditions.routeId);
  params.set("date", conditions.date);
  params.set("adults", String(conditions.adults));
  params.set("bag", conditions.checkedBaggage ? "1" : "0");
  params.set("periods", serializePeriods(conditions.periods));
  if (conditions.departureTime) params.set("dep", conditions.departureTime);
  return params.toString();
}
