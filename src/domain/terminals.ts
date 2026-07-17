/**
 * 空港ターミナルと最寄駅の対応、および駅からチェックインカウンターまでの移動時間。
 *
 * 「関西空港駅に着いた＝空港に着いた」ではない。Peach は関西国際空港の
 * 第2ターミナルを使うため連絡バスでの移動が必要で、ジェットスターは成田空港の
 * 第3ターミナルを使うため空港第2ビル駅から徒歩13分かかる。この移動時間を
 * 加算しないと推奨列車が実際より遅くなり、搭乗できない（要件23・24）。
 *
 * 各移動時間は `official: true`（公式サイトに明示された数値）と
 * `official: false`（公式に数値の記載が無く、アプリ側で安全側に置いた仮定）を
 * 区別して持つ。後者は画面に「アプリ側の安全側の目安」と表示する。
 * 公式の数値であるかのように見せてはいけない。
 *
 * 最終確認日: 2026-07-17
 */

import type { AirportCode } from "./types";

const CHECKED_AT = "2026-07-17";

const NARITA_ROUTE_1 = "https://www.narita-airport.jp/ja/access/train/railway-route-1/";
const NARITA_ROUTE_2 = "https://www.narita-airport.jp/ja/access/train/railway-route-2/";
const NARITA_ROUTE_3 = "https://www.narita-airport.jp/ja/access/train/railway-route-3/";
const NARITA_SHUTTLE = "https://www.narita-airport.jp/ja/access/shuttlebus/";
const KANSAI_T2_BUS = "https://www.kansai-airport.or.jp/access/t2";
const KANSAI_STATION_FAQ = "https://www.kansai-airport.or.jp/faq/101";

/** 移動時間の内訳。公式値かアプリ側の仮定かを必ず区別する。 */
export type TimingComponent = {
  readonly label: string;
  readonly minutes: number;
  /** true = 公式サイトに明示された数値。false = アプリ側の安全側の仮定。 */
  readonly official: boolean;
  readonly sourceUrl?: string;
  readonly note?: string;
};

export type AirportStation = {
  readonly stationCode: string;
  readonly stationNameJa: string;
  readonly airportCode: AirportCode;
};

export const AIRPORT_STATIONS: Readonly<Record<string, AirportStation>> = {
  "NRT-AIRPORT": {
    stationCode: "NRT-AIRPORT",
    stationNameJa: "成田空港駅",
    airportCode: "NRT",
  },
  "NRT-T2BLDG": {
    stationCode: "NRT-T2BLDG",
    stationNameJa: "空港第2ビル駅",
    airportCode: "NRT",
  },
  "KIX-AIRPORT": {
    stationCode: "KIX-AIRPORT",
    stationNameJa: "関西空港駅",
    airportCode: "KIX",
  },
};

export type TerminalAccess = {
  readonly airportCode: AirportCode;
  readonly terminal: string;
  /** そのターミナルに最も適した降車駅。 */
  readonly stationCode: string;
  readonly stationNameJa: string;
  /** 駅の改札からチェックインカウンターまでの内訳。 */
  readonly components: readonly TimingComponent[];
  readonly sourceUrls: readonly string[];
  readonly checkedAt: string;
  readonly notes: readonly string[];
};

export const TERMINAL_ACCESS: readonly TerminalAccess[] = [
  {
    airportCode: "NRT",
    terminal: "第1ターミナル",
    stationCode: "NRT-AIRPORT",
    stationNameJa: "成田空港駅",
    components: [
      {
        label: "成田空港駅から第1ターミナル出発ロビーまで徒歩",
        minutes: 5,
        official: true,
        sourceUrl: NARITA_ROUTE_1,
      },
    ],
    sourceUrls: [NARITA_ROUTE_1],
    checkedAt: CHECKED_AT,
    notes: ["第1ターミナルの最寄駅は成田空港駅です。空港第2ビル駅ではありません。"],
  },
  {
    airportCode: "NRT",
    terminal: "第2ターミナル",
    stationCode: "NRT-T2BLDG",
    stationNameJa: "空港第2ビル駅",
    components: [
      {
        label: "空港第2ビル駅から第2ターミナル出発ロビーまで徒歩",
        minutes: 5,
        official: true,
        sourceUrl: NARITA_ROUTE_2,
      },
    ],
    sourceUrls: [NARITA_ROUTE_2],
    checkedAt: CHECKED_AT,
    notes: ["第2ターミナルの最寄駅は空港第2ビル駅です。"],
  },
  {
    airportCode: "NRT",
    terminal: "第3ターミナル",
    stationCode: "NRT-T2BLDG",
    stationNameJa: "空港第2ビル駅",
    components: [
      {
        label: "空港第2ビル駅改札から第3ターミナル2階出発ロビー案内カウンターまで徒歩",
        minutes: 13,
        official: true,
        sourceUrl: NARITA_ROUTE_3,
        note: "無料のターミナル連絡バス（第2ターミナル〜第3ターミナルは約3分）も利用できますが、待ち時間があるため徒歩を基準に計算しています。",
      },
    ],
    sourceUrls: [NARITA_ROUTE_3, NARITA_SHUTTLE],
    checkedAt: CHECKED_AT,
    notes: [
      "第3ターミナルには鉄道駅が直結していません。最寄駅は空港第2ターミナルの空港第2ビル駅で、そこから徒歩約13分かかります。",
      "成田空港駅（第1ターミナル）で降りると、さらに移動が必要になります。",
    ],
  },
  {
    airportCode: "KIX",
    terminal: "第1ターミナル",
    stationCode: "KIX-AIRPORT",
    stationNameJa: "関西空港駅",
    components: [
      {
        label: "関西空港駅から第1ターミナル出発フロアまで徒歩",
        minutes: 5,
        official: false,
        sourceUrl: KANSAI_STATION_FAQ,
        note: "公式サイトは「駅は第1ターミナル2階と直結、連絡通路を渡って徒歩数分」と記載しており、具体的な分数の明示がないため、安全側に5分として計算しています。",
      },
    ],
    sourceUrls: [KANSAI_STATION_FAQ],
    checkedAt: CHECKED_AT,
    notes: ["第1ターミナルは関西空港駅と連絡通路で直結しています。"],
  },
  {
    airportCode: "KIX",
    terminal: "第2ターミナル",
    stationCode: "KIX-AIRPORT",
    components: [
      {
        label: "関西空港駅から連絡バス乗り場（エアロプラザ1階）まで徒歩",
        minutes: 5,
        official: false,
        sourceUrl: KANSAI_T2_BUS,
        note: "公式サイトに分数の明示がないため、安全側に5分として計算しています。",
      },
      {
        label: "連絡バスの待ち時間",
        minutes: 15,
        official: false,
        sourceUrl: KANSAI_T2_BUS,
        note: "実際の発車時刻は南海バスの時刻表によります。時刻表を取得していないため、安全側に15分の待ち時間を見込んでいます。",
      },
      {
        label: "連絡バス乗車（エアロプラザ→第2ターミナル）",
        minutes: 9,
        official: true,
        sourceUrl: KANSAI_T2_BUS,
        note: "公式の所要時間は7〜9分。安全側に上限の9分を採用しています。",
      },
      {
        label: "バス降車から第2ターミナルのチェックインカウンターまで徒歩",
        minutes: 3,
        official: false,
        sourceUrl: KANSAI_T2_BUS,
        note: "公式サイトに分数の明示がないため、安全側に3分として計算しています。",
      },
    ],
    stationNameJa: "関西空港駅",
    sourceUrls: [KANSAI_T2_BUS],
    checkedAt: CHECKED_AT,
    notes: [
      "第2ターミナルには鉄道駅が直結していません。関西空港駅から無料の連絡バスでの移動が必要です。",
      "関西空港駅への到着だけでは空港到着完了とみなせません。連絡バスの待ち時間と乗車時間を加算しています。",
    ],
  },
];

/** 航空会社が使用するターミナル（実データ）。 */
export const AIRLINE_TERMINALS: Readonly<Record<string, Partial<Record<AirportCode, string>>>> = {
  MM: { NRT: "第1ターミナル", KIX: "第2ターミナル" },
  GK: { NRT: "第3ターミナル", KIX: "第1ターミナル" },
  NH: { NRT: "第1ターミナル", KIX: "第1ターミナル" },
  JL: { NRT: "第2ターミナル", KIX: "第1ターミナル" },
};

export function terminalOfAirline(
  airlineCode: string,
  airportCode: AirportCode,
): string | undefined {
  return AIRLINE_TERMINALS[airlineCode.trim().toUpperCase()]?.[airportCode];
}

export function findTerminalAccess(
  airportCode: AirportCode,
  terminal: string | undefined,
): TerminalAccess | null {
  if (!terminal) return null;
  return (
    TERMINAL_ACCESS.find(
      (access) => access.airportCode === airportCode && access.terminal === terminal,
    ) ?? null
  );
}

export function terminalAccessesOf(airportCode: AirportCode): readonly TerminalAccess[] {
  return TERMINAL_ACCESS.filter((access) => access.airportCode === airportCode);
}

export function totalTransferMinutes(access: TerminalAccess): number {
  return access.components.reduce((sum, component) => sum + component.minutes, 0);
}

/**
 * ターミナルが不明な場合に使う、その空港で最も時間がかかるターミナルの移動時間。
 * 安全側に倒すため。使用した場合は画面にその旨を表示する。
 */
export function worstCaseTransferMinutes(airportCode: AirportCode): number {
  const accesses = terminalAccessesOf(airportCode);
  return Math.max(...accesses.map(totalTransferMinutes));
}
