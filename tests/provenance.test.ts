import { describe, expect, it } from "vitest";
import {
  assertProduction,
  demo,
  isProductionProvenance,
  official,
  unavailable,
  type ProductionValue,
  type Provenanced,
} from "@/domain/provenance";

/** 実用モードのコンポーネント／関数が受け取れるのは ProductionValue のみ、という契約。 */
function useInProduction<T>(value: ProductionValue<T>): T {
  return value.value;
}

describe("本番とデモの型レベル分離", () => {
  it("公式・手動確認・取得不可の値は実用モードで使える", () => {
    const officialValue: ProductionValue<number> = {
      value: 25,
      provenance: official("https://example.com", "2026-07-17"),
    };
    expect(useInProduction(officialValue)).toBe(25);
  });

  it("demo の値は実用モードの関数に渡せない（コンパイルエラー）", () => {
    const demoValue = demo("8940円");
    // @ts-expect-error demo データは実用モードのコンポーネントへ渡せない
    useInProduction(demoValue);
    // ランタイムでも assertProduction が demo を弾く
    expect(() => assertProduction(demoValue)).toThrow();
  });

  it("isProductionProvenance が demo を false にする", () => {
    expect(isProductionProvenance(official("https://x", "2026-07-17"))).toBe(true);
    expect(isProductionProvenance(unavailable("なし"))).toBe(true);
    expect(isProductionProvenance({ kind: "demo", warning: "not-real-data" })).toBe(false);
  });

  it("assertProduction は非demoを通す", () => {
    const value: Provenanced<string> = {
      value: "第1ターミナル",
      provenance: official("https://example.com", "2026-07-17"),
    };
    expect(() => assertProduction(value)).not.toThrow();
  });
});
