/**
 * 公式情報（搭乗ルール・ターミナル・空港駅）の唯一の情報源。
 *
 * フロントエンドと Cloudflare Worker の両方から参照する。安全に関わる値なので
 * 二重管理して食い違うことがないよう、ここに集約している。
 * `src/domain/boardingRules.ts` と `src/domain/terminals.ts` はこのファイルを
 * 再エクスポートしているだけ。
 *
 * すべて各航空会社・空港の公式サイトを一次情報として調査した実データ。
 * 公式に確認できなかった項目は undefined のままにする（推測で埋めない）。
 *
 * 最終確認日: 2026-07-17
 */

import type { AirportCode } from "./dto";

export type AirlineCategory = "LCC" | "FSC" | "HYBRID" | "UNKNOWN";

const CHECKED_AT = "2026-07-17";

// ---------------------------------------------------------------------------
// 搭乗ルール
// ---------------------------------------------------------------------------

export type AirlineBoardingRule = {
  readonly airlineCode: string;
  readonly airlineNameJa: string;
  readonly category: AirlineCategory;
  readonly airportCode: AirportCode;
  readonly terminal?: string;
  readonly checkInDeadlineMinutes?: number;
  readonly baggageDropDeadlineMinutes?: number;
  readonly securityRecommendedMinutes?: number;
  readonly gateDeadlineMinutes?: number;
  readonly onlineCheckInAvailable?: boolean;
  readonly onlineCheckInDeadlineMinutes?: number;
  readonly officialSourceUrls: readonly string[];
  readonly checkedAt: string;
  readonly notes?: readonly string[];
};

const PEACH_SOURCES = [
  "https://www.flypeach.com/lm/ai/airports/checkin",
  "https://www.flypeach.com/lm/ai/airports/airportguide_domestic/nrt",
  "https://www.flypeach.com/lm/ai/airports/airportguide_domestic/kix",
] as const;

const PEACH_NOTES = [
  "チェックインと手荷物のお預けは、いずれも出発の30分前までに完了する必要があります。",
  "預け荷物の受付は出発の90分前から30分前まで。",
  "アプリでのチェックインは出発の120分前から30分前まで可能。",
] as const;

const JETSTAR_SOURCES = [
  "https://www.jetstar.com/jp/ja/help/when-do-i-need-to-get-to-the-airport",
  "https://www.jetstar.com/jp/ja/help/checking-in",
  "https://www.jetstar.com/jp/ja/help/nrt-t3",
] as const;

const JETSTAR_NOTES = [
  "カウンターでの手続きは出発予定時刻の30分前までに完了する必要があります。",
  "搭乗ゲートへは出発予定時刻の30分前（目安）までに。ゲートは出発予定時刻の15分前に閉まります。",
  "ジェットスター・ジャパン（GK）国内線のオンラインチェックインは出発の48時間前から35分前まで。",
] as const;

const ANA_SOURCES = [
  "https://www.ana.co.jp/ja/jp/guide/boarding-procedures/checkin/domestic/flow_airport/",
  "https://www.ana.co.jp/ja/jp/topics/notice181024/",
  "https://www.ana.co.jp/ja/jp/guide/boarding-procedures/baggage/domestic/checked-in/",
] as const;

const ANA_NOTES = [
  "出発時刻の20分前までに保安検査場を通過する必要があります。この時刻を過ぎると搭乗できません。",
  "搭乗口には出発時刻の10分前までに到着する必要があります。",
  "お預けの手荷物は出発時刻の20分前までに預ける必要があります。",
] as const;

const JAL_SOURCES = [
  "https://faq-jp.jal.co.jp/ja/s/article/jdsp000000R0000000014750dom",
  "https://www.jal.co.jp/jp/ja/dom/boarding_attention/",
  "https://faq.jal.co.jp/app/answers/detail/a_id/4442/",
] as const;

const JAL_NOTES = [
  "出発時刻の20分前までに保安検査場を通過する必要があります。",
  "搭乗口には出発時刻の10分前までに到着する必要があります。",
  "お預けの手荷物は出発時刻の30分前までにお預けください。",
] as const;

/**
 * SPRING JAPAN（IJ）は成田発の一部路線のみの運航で NRT-KIX を運航しておらず、
 * 国内線の締切時刻を公式で確認できなかったため、あえて登録していない。
 * 登録が無い航空会社は計算側でフォールバックに切り替わる。
 */
export const AIRLINE_BOARDING_RULES: readonly AirlineBoardingRule[] = [
  {
    airlineCode: "MM",
    airlineNameJa: "Peach Aviation",
    category: "LCC",
    airportCode: "NRT",
    terminal: "第1ターミナル",
    checkInDeadlineMinutes: 30,
    baggageDropDeadlineMinutes: 30,
    securityRecommendedMinutes: 25,
    gateDeadlineMinutes: 20,
    onlineCheckInAvailable: true,
    onlineCheckInDeadlineMinutes: 30,
    officialSourceUrls: PEACH_SOURCES,
    checkedAt: CHECKED_AT,
    notes: PEACH_NOTES,
  },
  {
    airlineCode: "MM",
    airlineNameJa: "Peach Aviation",
    category: "LCC",
    airportCode: "KIX",
    terminal: "第2ターミナル",
    checkInDeadlineMinutes: 30,
    baggageDropDeadlineMinutes: 30,
    securityRecommendedMinutes: 25,
    gateDeadlineMinutes: 20,
    onlineCheckInAvailable: true,
    onlineCheckInDeadlineMinutes: 30,
    officialSourceUrls: PEACH_SOURCES,
    checkedAt: CHECKED_AT,
    notes: [
      ...PEACH_NOTES,
      "関西国際空港では第2ターミナルを使用します。関西空港駅から連絡バスでの移動が必要です。",
    ],
  },
  {
    airlineCode: "GK",
    airlineNameJa: "ジェットスター・ジャパン",
    category: "LCC",
    airportCode: "NRT",
    terminal: "第3ターミナル",
    checkInDeadlineMinutes: 30,
    baggageDropDeadlineMinutes: 30,
    // 保安検査場の通過締切は公式に明示が見当たらないため未設定（推測しない）
    securityRecommendedMinutes: undefined,
    gateDeadlineMinutes: 15,
    onlineCheckInAvailable: true,
    onlineCheckInDeadlineMinutes: 35,
    officialSourceUrls: JETSTAR_SOURCES,
    checkedAt: CHECKED_AT,
    notes: [
      ...JETSTAR_NOTES,
      "成田空港では第3ターミナルを使用します。空港第2ビル駅から徒歩での移動が必要です。",
    ],
  },
  {
    airlineCode: "GK",
    airlineNameJa: "ジェットスター・ジャパン",
    category: "LCC",
    airportCode: "KIX",
    terminal: "第1ターミナル",
    checkInDeadlineMinutes: 30,
    baggageDropDeadlineMinutes: 30,
    securityRecommendedMinutes: undefined,
    gateDeadlineMinutes: 15,
    onlineCheckInAvailable: true,
    onlineCheckInDeadlineMinutes: 35,
    officialSourceUrls: JETSTAR_SOURCES,
    checkedAt: CHECKED_AT,
    notes: JETSTAR_NOTES,
  },
  {
    airlineCode: "NH",
    airlineNameJa: "ANA（全日本空輸）",
    category: "FSC",
    airportCode: "NRT",
    terminal: "第1ターミナル",
    checkInDeadlineMinutes: 20,
    baggageDropDeadlineMinutes: 20,
    securityRecommendedMinutes: 20,
    gateDeadlineMinutes: 10,
    onlineCheckInAvailable: true,
    officialSourceUrls: ANA_SOURCES,
    checkedAt: CHECKED_AT,
    notes: ANA_NOTES,
  },
  {
    airlineCode: "NH",
    airlineNameJa: "ANA（全日本空輸）",
    category: "FSC",
    airportCode: "KIX",
    terminal: "第1ターミナル",
    checkInDeadlineMinutes: 20,
    baggageDropDeadlineMinutes: 20,
    securityRecommendedMinutes: 20,
    gateDeadlineMinutes: 10,
    onlineCheckInAvailable: true,
    officialSourceUrls: ANA_SOURCES,
    checkedAt: CHECKED_AT,
    notes: ANA_NOTES,
  },
  {
    airlineCode: "JL",
    airlineNameJa: "JAL（日本航空）",
    category: "FSC",
    airportCode: "NRT",
    terminal: "第2ターミナル",
    checkInDeadlineMinutes: 20,
    baggageDropDeadlineMinutes: 30,
    securityRecommendedMinutes: 20,
    gateDeadlineMinutes: 10,
    onlineCheckInAvailable: true,
    officialSourceUrls: JAL_SOURCES,
    checkedAt: CHECKED_AT,
    notes: JAL_NOTES,
  },
  {
    airlineCode: "JL",
    airlineNameJa: "JAL（日本航空）",
    category: "FSC",
    airportCode: "KIX",
    terminal: "第1ターミナル",
    checkInDeadlineMinutes: 20,
    baggageDropDeadlineMinutes: 30,
    securityRecommendedMinutes: 20,
    gateDeadlineMinutes: 10,
    onlineCheckInAvailable: true,
    officialSourceUrls: JAL_SOURCES,
    checkedAt: CHECKED_AT,
    notes: JAL_NOTES,
  },
];

export type BoardingFallback = {
  readonly checkInDeadlineMinutes: number;
  readonly baggageDropDeadlineMinutes: number;
  readonly securityRecommendedMinutes: number;
  readonly gateDeadlineMinutes: number;
};

/**
 * 航空会社固有の公式ルールを取得できなかった場合に使う、区分別の安全側の目安。
 * これは公式値ではない。使用した場合は画面に注意書きを表示する。
 */
export const BOARDING_FALLBACKS: Readonly<Record<AirlineCategory, BoardingFallback>> = {
  LCC: {
    checkInDeadlineMinutes: 45,
    baggageDropDeadlineMinutes: 45,
    securityRecommendedMinutes: 35,
    gateDeadlineMinutes: 25,
  },
  FSC: {
    checkInDeadlineMinutes: 40,
    baggageDropDeadlineMinutes: 40,
    securityRecommendedMinutes: 30,
    gateDeadlineMinutes: 20,
  },
  HYBRID: {
    checkInDeadlineMinutes: 45,
    baggageDropDeadlineMinutes: 45,
    securityRecommendedMinutes: 35,
    gateDeadlineMinutes: 25,
  },
  UNKNOWN: {
    checkInDeadlineMinutes: 60,
    baggageDropDeadlineMinutes: 60,
    securityRecommendedMinutes: 45,
    gateDeadlineMinutes: 30,
  },
};

export const FALLBACK_NOTICE =
  "航空会社固有の公式情報を取得できなかったため、安全側の目安を使用しています。";

export const RULE_UNAVAILABLE_NOTICE =
  "公式の締切時刻を確認できませんでした。航空会社公式サイトで確認してください。";

export function findBoardingRule(
  airlineCode: string,
  airportCode: AirportCode,
  terminal?: string,
): AirlineBoardingRule | null {
  const code = airlineCode.trim().toUpperCase();
  const candidates = AIRLINE_BOARDING_RULES.filter(
    (rule) => rule.airlineCode === code && rule.airportCode === airportCode,
  );
  if (candidates.length === 0) return null;
  if (terminal) {
    const exact = candidates.find((rule) => rule.terminal === terminal);
    if (exact) return exact;
  }
  return candidates[0];
}

export function boardingRulesOf(airlineCode: string): readonly AirlineBoardingRule[] {
  const code = airlineCode.trim().toUpperCase();
  return AIRLINE_BOARDING_RULES.filter((rule) => rule.airlineCode === code);
}

// ---------------------------------------------------------------------------
// ターミナル・空港駅
// ---------------------------------------------------------------------------

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
  readonly stationCode: string;
  readonly stationNameJa: string;
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
      "第3ターミナルには鉄道駅が直結していません。最寄駅は空港第2ビル駅で、そこから徒歩約13分かかります。",
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
    stationNameJa: "関西空港駅",
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
    sourceUrls: [KANSAI_T2_BUS],
    checkedAt: CHECKED_AT,
    notes: [
      "第2ターミナルには鉄道駅が直結していません。関西空港駅から無料の連絡バスでの移動が必要です。",
      "関西空港駅への到着だけでは空港到着完了とみなせません。",
    ],
  },
];

/** 航空会社が使用するターミナル（実データ）。 */
export const AIRLINE_TERMINALS: Readonly<
  Record<string, Partial<Record<AirportCode, string>>>
> = {
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

/** ターミナル不明時に使う、その空港で最も時間がかかる移動時間。 */
export function worstCaseTransferMinutes(airportCode: AirportCode): number {
  const accesses = terminalAccessesOf(airportCode);
  return Math.max(...accesses.map(totalTransferMinutes));
}
