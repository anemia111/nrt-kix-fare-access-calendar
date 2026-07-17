/**
 * 表示用のフォーマット。
 *
 * 空席表示はとくに注意が必要（要件9）。正確な残席数を取得できた場合だけ数値を
 * 出す。API が返すのが「一度に予約可能な最大人数」の場合は、実残席数と誤解
 * させない文言にする。架空の残席数は絶対に作らない。
 */

import type { Availability, AvailabilityStatus, RiskLevel } from "@/domain/types";

export function formatYen(price: number | null | undefined): string {
  if (price === null || price === undefined || !Number.isFinite(price)) {
    return "価格を取得できません";
  }
  return `${price.toLocaleString("ja-JP")}円`;
}

/** 価格を数値部分だけで表示する（単位を別要素にしたいとき）。 */
export function formatYenNumber(price: number): string {
  return price.toLocaleString("ja-JP");
}

export type AvailabilityDisplay = {
  readonly label: string;
  /** 実残席数を示しているか。false の場合は在庫数の断定を避ける。 */
  readonly isExactSeatCount: boolean;
  /** 予約できない状態か。 */
  readonly isUnavailable: boolean;
  /** 補足説明（意味を取り違えないための説明）。 */
  readonly description: string;
};

export function describeAvailability(availability: Availability): AvailabilityDisplay {
  switch (availability.status) {
    case "exact":
      return {
        label:
          availability.seatsRemaining >= 5
            ? "残り5席以上"
            : `残り${availability.seatsRemaining}席`,
        isExactSeatCount: true,
        isUnavailable: false,
        description: "提供元から取得した販売可能数です。実際の在庫と一致しない場合があります。",
      };
    case "max_pax":
      return {
        // 実残席数ではないため、席数として読ませない文言にする。
        label: `現在${availability.maxSearchablePax}名まで検索可能`,
        isExactSeatCount: false,
        isUnavailable: false,
        description:
          "これは残席数ではなく、一度に予約できる最大人数です。実際の残席数は公開されていません。",
      };
    case "available":
      return {
        label: "空席あり",
        isExactSeatCount: false,
        isUnavailable: false,
        description: "残席数は取得できていません。",
      };
    case "few":
      return {
        label: "空席わずか",
        isExactSeatCount: false,
        isUnavailable: false,
        description: "残席数は取得できていません。",
      };
    case "undisclosed":
      return {
        label: "在庫数非公開",
        isExactSeatCount: false,
        isUnavailable: false,
        description: "提供元が在庫数を公開していません。",
      };
    case "unknown":
      return {
        label: "残席情報なし",
        isExactSeatCount: false,
        isUnavailable: false,
        description: "空席情報を取得できませんでした。",
      };
    case "recheck":
      return {
        label: "要再確認",
        isExactSeatCount: false,
        isUnavailable: false,
        description: "空席状況が変動している可能性があります。公式サイトで確認してください。",
      };
    case "sold_out":
      return {
        label: "満席",
        isExactSeatCount: false,
        isUnavailable: true,
        description: "この便は満席です。",
      };
    case "unavailable":
      return {
        label: "予約不可",
        isExactSeatCount: false,
        isUnavailable: true,
        description: "現在この便は予約できません。",
      };
  }
}

/** 色に頼らず状況を伝えるための記号。 */
export const AVAILABILITY_SYMBOLS: Readonly<Record<AvailabilityStatus, string>> = {
  exact: "●",
  available: "●",
  few: "◒",
  undisclosed: "?",
  unknown: "?",
  recheck: "!",
  max_pax: "?",
  sold_out: "×",
  unavailable: "×",
};

export const RISK_SYMBOLS: Readonly<Record<RiskLevel, string>> = {
  LOW: "◎",
  MEDIUM: "○",
  HIGH: "▲",
  UNAVAILABLE: "×",
};

/** 取得できなかった項目の統一表現。推測値を出さない。 */
export const UNKNOWN_LABEL = "不明";
export const CHECK_OFFICIAL_LABEL = "公式サイトで確認";
