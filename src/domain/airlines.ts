/**
 * 航空会社レジストリ（実データ）。
 *
 * 航空会社コードと公式サイトの対応表はここ1か所で管理する（要件13）。
 * IATA コードを正規化のキーとし、ICAO コード・和名は補助的に持つ。
 *
 * `officialDomains` は「公式サイト」と表示してよいドメインの許可リスト。
 * 旅行代理店・価格比較サイト・広告サイトは絶対に含めない（要件11）。
 * ドメイン判定は部分一致ではなく URL 解析で行う（`@/lib/externalUrl`）。
 *
 * `supportsDeepLink` は「航空会社が正式に公開している予約ディープリンク仕様が
 * 確認できた場合のみ」true にする。未公開の URL 仕様を推測して独自のクエリ
 * パラメータを作ってはいけない（要件12）。現時点でいずれの航空会社についても
 * 公式のディープリンク仕様を確認できていないため、すべて false とし、
 * 公式の予約ページ（要件12の優先順位4）へ案内する。
 *
 * 最終確認日: 2026-07-17
 */

import type { AirlineCategory } from "./types";

export type AirlineOfficialSite = {
  /** IATA 2レターコード。正規化のキー。 */
  readonly airlineCode: string;
  /** ICAO 3レターコード（補助）。 */
  readonly icaoCode?: string;
  readonly airlineNameJa: string;
  readonly category: AirlineCategory;
  /** 「公式」と表示してよいドメイン。サブドメインは URL 解析側で許可する。 */
  readonly officialDomains: readonly string[];
  /** 公式の国内線予約ページ。 */
  readonly bookingUrl: string;
  readonly homeUrl: string;
  /** 公式のディープリンク仕様を確認できた場合のみ true。 */
  readonly supportsDeepLink: boolean;
  readonly sourceUrls: readonly string[];
  readonly checkedAt: string;
};

const CHECKED_AT = "2026-07-17";

export const AIRLINES: Readonly<Record<string, AirlineOfficialSite>> = {
  MM: {
    airlineCode: "MM",
    icaoCode: "APJ",
    airlineNameJa: "Peach Aviation",
    category: "LCC",
    officialDomains: ["flypeach.com"],
    bookingUrl: "https://www.flypeach.com/jp/ja",
    homeUrl: "https://www.flypeach.com/jp/ja",
    supportsDeepLink: false,
    sourceUrls: ["https://www.flypeach.com/lm/ai/airports/checkin"],
    checkedAt: CHECKED_AT,
  },
  GK: {
    airlineCode: "GK",
    icaoCode: "JJP",
    airlineNameJa: "ジェットスター・ジャパン",
    category: "LCC",
    officialDomains: ["jetstar.com"],
    bookingUrl: "https://www.jetstar.com/jp/ja/home",
    homeUrl: "https://www.jetstar.com/jp/ja/home",
    supportsDeepLink: false,
    sourceUrls: ["https://www.jetstar.com/jp/ja/help/when-do-i-need-to-get-to-the-airport"],
    checkedAt: CHECKED_AT,
  },
  NH: {
    airlineCode: "NH",
    icaoCode: "ANA",
    airlineNameJa: "ANA（全日本空輸）",
    category: "FSC",
    officialDomains: ["ana.co.jp"],
    bookingUrl: "https://www.ana.co.jp/ja/jp/domestic/",
    homeUrl: "https://www.ana.co.jp/ja/jp/",
    supportsDeepLink: false,
    sourceUrls: [
      "https://www.ana.co.jp/ja/jp/guide/boarding-procedures/checkin/domestic/flow_airport/",
    ],
    checkedAt: CHECKED_AT,
  },
  JL: {
    airlineCode: "JL",
    icaoCode: "JAL",
    airlineNameJa: "JAL（日本航空）",
    category: "FSC",
    officialDomains: ["jal.co.jp"],
    bookingUrl: "https://www.jal.co.jp/jp/ja/dom/",
    homeUrl: "https://www.jal.co.jp/jp/ja/",
    supportsDeepLink: false,
    sourceUrls: ["https://www.jal.co.jp/jp/ja/dom/boarding_attention/"],
    checkedAt: CHECKED_AT,
  },
  IJ: {
    airlineCode: "IJ",
    icaoCode: "SJO",
    airlineNameJa: "SPRING JAPAN",
    category: "LCC",
    // 公式サイトは ch.com 配下（jp.ch.com が日本語サイト）。
    officialDomains: ["ch.com"],
    bookingUrl: "https://jp.ch.com/",
    homeUrl: "https://jp.ch.com/",
    supportsDeepLink: false,
    sourceUrls: ["https://jp.ch.com/rules-refund"],
    checkedAt: CHECKED_AT,
  },
};

export function findAirline(airlineCode: string | undefined | null): AirlineOfficialSite | null {
  if (!airlineCode) return null;
  return AIRLINES[normalizeAirlineCode(airlineCode)] ?? null;
}

/** IATA コードの表記ゆれを吸収する。 */
export function normalizeAirlineCode(airlineCode: string): string {
  return airlineCode.trim().toUpperCase();
}

/** 航空会社を特定できない場合は名前を作らず、その旨を返す（要件13）。 */
export function airlineDisplayName(airlineCode: string | undefined | null): string {
  const airline = findAirline(airlineCode);
  if (airline) return airline.airlineNameJa;
  return airlineCode ? `${normalizeAirlineCode(airlineCode)}（未登録の航空会社）` : "不明";
}

export function airlineCategoryOf(airlineCode: string | undefined | null): AirlineCategory {
  return findAirline(airlineCode)?.category ?? "UNKNOWN";
}

export const AIRLINE_CATEGORY_LABELS: Readonly<Record<AirlineCategory, string>> = {
  LCC: "LCC（格安航空会社）",
  FSC: "FSC（フルサービス航空会社）",
  HYBRID: "ハイブリッド",
  UNKNOWN: "区分不明",
};
