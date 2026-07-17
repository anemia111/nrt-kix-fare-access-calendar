import { describe, expect, it } from "vitest";
import { createPriceBandCalculator, MIN_SAMPLES_FOR_BAND } from "@/lib/priceBand";

describe("価格帯の判定", () => {
  const prices = [5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000];

  it("最安値には最安バッジを付ける", () => {
    const calculator = createPriceBandCalculator(prices);
    expect(calculator.bandOf(5000)).toBe("cheapest");
    expect(calculator.cheapestPrice).toBe(5000);
  });

  it("安い・平均的・高いを判定する", () => {
    const calculator = createPriceBandCalculator(prices);
    expect(calculator.reliable).toBe(true);
    expect(calculator.bandOf(6000)).toBe("cheap");
    expect(calculator.bandOf(9000)).toBe("average");
    expect(calculator.bandOf(20000)).toBe("expensive");
  });

  it("価格を取得できなかった日は判定しない", () => {
    const calculator = createPriceBandCalculator(prices);
    expect(calculator.bandOf(null)).toBe("unknown");
  });
});

describe("誤解を生む判定をしない", () => {
  it("データが少なすぎるときは価格帯を判定しない", () => {
    const calculator = createPriceBandCalculator([8000, 9000, 12000]);
    expect(calculator.reliable).toBe(false);
    expect(calculator.sampleCount).toBeLessThan(MIN_SAMPLES_FOR_BAND);
    // 最安だけは表示してよいが、それ以外は判定なし
    expect(calculator.bandOf(8000)).toBe("cheapest");
    expect(calculator.bandOf(9000)).toBe("unknown");
    expect(calculator.bandOf(12000)).toBe("unknown");
  });

  it("有効な価格が1件しかないときは最安バッジも付けない", () => {
    const calculator = createPriceBandCalculator([8000, null, null]);
    expect(calculator.bandOf(8000)).toBe("unknown");
  });

  it("価格が全て同じときは高い・安いを判定しない", () => {
    const calculator = createPriceBandCalculator([9000, 9000, 9000, 9000, 9000, 9000]);
    expect(calculator.reliable).toBe(false);
    expect(calculator.bandOf(9000)).toBe("cheapest");
  });

  it("極端な異常値がしきい値を歪めない", () => {
    // 1日だけ極端に高い便があっても、通常価格帯の判定は保たれる
    const withOutlier = createPriceBandCalculator([
      5000, 5500, 6000, 6500, 7000, 7500, 8000, 500000,
    ]);
    expect(withOutlier.bandOf(7500)).not.toBe("average");
    expect(withOutlier.bandOf(500000)).toBe("expensive");
    expect(withOutlier.bandOf(5500)).toBe("cheap");
  });

  it("null や不正値を有効データとして数えない", () => {
    const calculator = createPriceBandCalculator([null, null, 8000, 9000]);
    expect(calculator.sampleCount).toBe(2);
    expect(calculator.reliable).toBe(false);
  });
});
