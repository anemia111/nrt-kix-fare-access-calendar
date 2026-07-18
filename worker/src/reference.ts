/**
 * 参照系エンドポイントが返す公式データ。
 * フロントエンドと同じ `shared/officialReference.ts` を参照するため、
 * 値が食い違うことはない。
 */

import {
  AIRLINE_BOARDING_RULES,
  AIRLINE_TERMINALS,
  AIRPORT_STATIONS,
  BOARDING_FALLBACKS,
  TERMINAL_ACCESS,
} from "../../shared/officialReference";
import { OFFICIAL_BOOKING_PAGES, OFFICIAL_DOMAINS } from "../../shared/airlineDomains";
import { STATIONS } from "../../shared/stations";

export const BOARDING_RULES_REFERENCE = {
  note: "各航空会社の公式サイトを一次情報として調査した実データです。officialSourceUrls と checkedAt を確認してください。公式に確認できなかった項目は値を持ちません（推測していません）。",
  boardingRules: AIRLINE_BOARDING_RULES,
  fallbacks: {
    note: "航空会社固有の公式ルールを取得できなかった場合にのみ使う安全側の目安です。公式値ではありません。",
    byCategory: BOARDING_FALLBACKS,
  },
  officialDomains: OFFICIAL_DOMAINS,
  officialBookingPages: OFFICIAL_BOOKING_PAGES,
};

export const TERMINALS_REFERENCE = {
  note: "移動時間の components は official:true が公式サイトに明示された数値、official:false がアプリ側で安全側に置いた仮定です。",
  terminalAccess: TERMINAL_ACCESS,
  airlineTerminals: AIRLINE_TERMINALS,
  airportStations: AIRPORT_STATIONS,
  routeStations: STATIONS,
};
