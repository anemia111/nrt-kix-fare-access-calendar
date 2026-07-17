/**
 * 価格帯の判定（要件8）。
 *
 * データが少ない場合や異常値がある場合に、誤解を生む価格帯判定をしてはいけない。
 * そのため:
 *  - 有効な価格が少ないときは判定せず "unknown" を返す
 *  - 四分位範囲から大きく外れた異常値は、しきい値の計算から除外する
 *    （1日だけ極端に高い便があっても「平均的」の基準が歪まないようにする）
 *  - 価格がほぼ一様で差が無いときも判定しない（「高い」と言えるほどの差がない）
 */

import type { PriceBand } from "@/domain/types";

/** 価格帯を判定するために最低限必要な有効データ数。 */
export const MIN_SAMPLES_FOR_BAND = 5;

/** 最安バッジを付けるために最低限必要な有効データ数。 */
export const MIN_SAMPLES_FOR_CHEAPEST = 2;

export type PriceBandCalculator = {
  /** その価格の価格帯。判定できない場合は "unknown"。 */
  bandOf(price: number | null): PriceBand;
  readonly cheapestPrice: number | null;
  /** 価格帯を判定できるだけのデータが揃っているか。 */
  readonly reliable: boolean;
  readonly sampleCount: number;
};

export function createPriceBandCalculator(
  prices: readonly (number | null)[],
): PriceBandCalculator {
  const valid = prices
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  const cheapestPrice = valid.length > 0 ? valid[0] : null;
  const canMarkCheapest = valid.length >= MIN_SAMPLES_FOR_CHEAPEST;

  if (valid.length < MIN_SAMPLES_FOR_BAND) {
    return {
      bandOf: (price) =>
        canMarkCheapest && price !== null && price === cheapestPrice ? "cheapest" : "unknown",
      cheapestPrice,
      reliable: false,
      sampleCount: valid.length,
    };
  }

  const withoutOutliers = removeOutliers(valid);
  const q1 = quantile(withoutOutliers, 0.25);
  const q3 = quantile(withoutOutliers, 0.75);

  // 価格差がほとんど無い場合は「安い/高い」と言えるだけの根拠がない。
  const spreadIsMeaningful = q3 > q1;
  if (!spreadIsMeaningful) {
    return {
      bandOf: (price) => (price !== null && price === cheapestPrice ? "cheapest" : "unknown"),
      cheapestPrice,
      reliable: false,
      sampleCount: valid.length,
    };
  }

  return {
    bandOf(price) {
      if (price === null || !Number.isFinite(price)) return "unknown";
      if (price === cheapestPrice) return "cheapest";
      if (price <= q1) return "cheap";
      if (price <= q3) return "average";
      return "expensive";
    },
    cheapestPrice,
    reliable: true,
    sampleCount: valid.length,
  };
}

/** Tukey の基準（四分位範囲の1.5倍）で外れ値を除外する。 */
function removeOutliers(sortedPrices: readonly number[]): number[] {
  const q1 = quantile(sortedPrices, 0.25);
  const q3 = quantile(sortedPrices, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return [...sortedPrices];
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const filtered = sortedPrices.filter((price) => price >= lower && price <= upper);
  // 全部除外されるような極端なケースでは元の配列を使う。
  return filtered.length >= MIN_SAMPLES_FOR_BAND ? filtered : [...sortedPrices];
}

/** 線形補間による分位数。入力は昇順であること。 */
function quantile(sortedValues: readonly number[], fraction: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const position = (sortedValues.length - 1) * fraction;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const weight = position - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

export const PRICE_BAND_LABELS: Readonly<Record<PriceBand, string>> = {
  cheapest: "最安",
  cheap: "安い",
  average: "平均的",
  expensive: "高い",
  unknown: "判定なし",
};

/** 色だけで情報を伝えないため、記号も併記する（要件8・40）。 */
export const PRICE_BAND_SYMBOLS: Readonly<Record<PriceBand, string>> = {
  cheapest: "◎",
  cheap: "○",
  average: "△",
  expensive: "▲",
  unknown: "—",
};
