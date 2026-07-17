/**
 * 航空会社ごとの国内線 搭乗ルール（実データ）。
 *
 * すべて各航空会社の公式サイト・公式FAQを一次情報として調査した値。
 * ブログ・まとめサイト・生成AIの回答は根拠にしていない（要件20）。
 *
 * 重要: 公式に確認できなかった項目は `undefined` のままにする。
 * 「たぶんこれくらい」で数値を埋めてはいけない。undefined の項目は
 * 計算側で区分別フォールバックに切り替わり、その旨が画面に表示される（要件21）。
 *
 * 最終確認日: 2026-07-17
 */

import type { AirlineCategory, AirportCode } from "./types";

export type AirlineBoardingRule = {
  readonly airlineCode: string;
  readonly airlineNameJa: string;
  readonly category: AirlineCategory;
  readonly airportCode: AirportCode;
  /** 適用ターミナル。 */
  readonly terminal?: string;
  /** 出発何分前にチェックイン（搭乗手続き）が締め切られるか。 */
  readonly checkInDeadlineMinutes?: number;
  /** 出発何分前に預け荷物の受付が締め切られるか。 */
  readonly baggageDropDeadlineMinutes?: number;
  /** 出発何分前までに保安検査場を通過する必要があるか。 */
  readonly securityRecommendedMinutes?: number;
  /** 出発何分前までに搭乗口へ到着する必要があるか。 */
  readonly gateDeadlineMinutes?: number;
  readonly onlineCheckInAvailable?: boolean;
  /** オンライン／アプリチェックインの締切（出発何分前）。 */
  readonly onlineCheckInDeadlineMinutes?: number;
  readonly officialSourceUrls: readonly string[];
  readonly checkedAt: string;
  readonly notes?: readonly string[];
};

const CHECKED_AT = "2026-07-17";

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
  "保安検査場から搭乗口までは約10分かかる場合があります。",
] as const;

/**
 * 対応航空会社 × 空港のルール。
 *
 * SPRING JAPAN（IJ）は成田発の一部路線のみの運航で NRT-KIX を運航しておらず、
 * 国内線の締切時刻を公式で確認できなかったため、あえて登録しない。
 * 登録が無い航空会社は計算側でフォールバックに切り替わり、
 * 「公式の締切時刻を確認できませんでした」と表示される（要件20）。
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
    // 保安検査場の通過締切は公式に明示が見当たらないため未設定（推測しない）。
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

/**
 * 航空会社固有の公式ルールを取得できなかった場合に使う、区分別の安全側の目安。
 *
 * これは公式値ではない。実際の締切より早め（安全側）に倒してあり、
 * 使用した場合は必ず画面に注意書きを表示する（要件21）。
 * 「LCCだから一律◯分前」で済ませず、まず航空会社固有の公式ルールを優先すること。
 */
export type BoardingFallback = {
  readonly checkInDeadlineMinutes: number;
  readonly baggageDropDeadlineMinutes: number;
  readonly securityRecommendedMinutes: number;
  readonly gateDeadlineMinutes: number;
};

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
  // 区分すら不明な場合は最も安全側に倒す。
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

/**
 * 航空会社と空港（必要ならターミナル）に対応する公式ルールを返す。
 * 見つからない場合は null。呼び出し側でフォールバックへ切り替える。
 */
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
