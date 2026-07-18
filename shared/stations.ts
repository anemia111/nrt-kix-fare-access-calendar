/**
 * 経路検索で使う駅の定義（フロントと Worker で共有）。
 *
 * Google Routes API へは住所文字列で渡す（座標を推測せず、提供元の
 * ジオコーディングに委ねるため）。将来、逆方向（空港→自宅最寄り駅）にも
 * 対応できるよう、出発／到着を固定していない構造にしている。
 */

import type { AirportCode } from "./dto";

export const ORIGIN_STATION_CODES = ["KAMATORI", "WAKAYAMA"] as const;
export type OriginStationCode = (typeof ORIGIN_STATION_CODES)[number];

export const AIRPORT_STATION_CODES = ["NRT-AIRPORT", "NRT-T2BLDG", "KIX-AIRPORT"] as const;
export type AirportStationCode = (typeof AIRPORT_STATION_CODES)[number];

export type StationCode = OriginStationCode | AirportStationCode;

export type StationDefinition = {
  readonly code: StationCode;
  readonly nameJa: string;
  /** Routes API へ渡す住所文字列。 */
  readonly address: string;
};

export const STATIONS: Readonly<Record<StationCode, StationDefinition>> = {
  KAMATORI: {
    code: "KAMATORI",
    nameJa: "鎌取駅",
    address: "鎌取駅, 千葉県千葉市緑区, 日本",
  },
  WAKAYAMA: {
    code: "WAKAYAMA",
    nameJa: "和歌山駅",
    address: "和歌山駅, 和歌山県和歌山市, 日本",
  },
  "NRT-AIRPORT": {
    code: "NRT-AIRPORT",
    nameJa: "成田空港駅",
    address: "成田空港駅, 千葉県成田市, 日本",
  },
  "NRT-T2BLDG": {
    code: "NRT-T2BLDG",
    nameJa: "空港第2ビル駅",
    address: "空港第2ビル駅, 千葉県成田市, 日本",
  },
  "KIX-AIRPORT": {
    code: "KIX-AIRPORT",
    nameJa: "関西空港駅",
    address: "関西空港駅, 大阪府泉佐野市, 日本",
  },
};

export function isOriginStationCode(value: unknown): value is OriginStationCode {
  return (
    typeof value === "string" && (ORIGIN_STATION_CODES as readonly string[]).includes(value)
  );
}

export function isAirportStationCode(value: unknown): value is AirportStationCode {
  return (
    typeof value === "string" && (AIRPORT_STATION_CODES as readonly string[]).includes(value)
  );
}

/** その空港から出発する場合に使う、自宅側の出発駅。 */
export const ORIGIN_STATION_FOR_AIRPORT: Readonly<Record<AirportCode, OriginStationCode>> = {
  NRT: "KAMATORI",
  KIX: "WAKAYAMA",
};

/**
 * 出発ターミナルに応じた空港側の降車駅。
 * 成田は第1が成田空港駅、第2・第3が空港第2ビル駅。関空は関西空港駅のみ。
 */
export function airportStationForTerminal(
  airport: AirportCode,
  terminal: string | null | undefined,
): AirportStationCode {
  if (airport === "KIX") return "KIX-AIRPORT";
  if (terminal === "第1ターミナル") return "NRT-AIRPORT";
  // 第2・第3、および不明な場合は空港第2ビル駅（第3が最も遠く安全側）
  return "NRT-T2BLDG";
}
