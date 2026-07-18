/**
 * 各路線を実際に運航している航空会社（実データ）。
 *
 * 成田⇄関空の直行便を運航しているのは Peach とジェットスター・ジャパンのみ。
 * これは各社の時刻表・予約ページで確認した事実であり、架空データではない。
 * ANA・JAL はこの路線の国内線を運航していないため、実用モードには含めない。
 *
 * 最終確認日: 2026-07-17
 */

import { manualVerified, type ProductionProvenance } from "./provenance";
import type { RouteId } from "./types";

export type RouteCarrier = {
  readonly airlineCode: string;
  readonly provenance: ProductionProvenance;
};

const CHECKED_AT = "2026-07-17";

const CARRIER_MM: RouteCarrier = {
  airlineCode: "MM",
  provenance: manualVerified("https://www.flypeach.com/jp/ja", CHECKED_AT),
};
const CARRIER_GK: RouteCarrier = {
  airlineCode: "GK",
  provenance: manualVerified("https://www.jetstar.com/jp/ja/home", CHECKED_AT),
};

export const ROUTE_CARRIERS: Readonly<Record<RouteId, readonly RouteCarrier[]>> = {
  "NRT-KIX": [CARRIER_MM, CARRIER_GK],
  "KIX-NRT": [CARRIER_MM, CARRIER_GK],
};

export function carriersOfRoute(routeId: RouteId): readonly RouteCarrier[] {
  return ROUTE_CARRIERS[routeId];
}
