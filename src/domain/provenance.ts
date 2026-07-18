/**
 * データの出所（provenance）を型で表現する。
 *
 * 目的は「デモの架空データを、実用モードの画面に混入させない」ことを
 * **型レベルで**保証することにある。実用モードのコンポーネントは
 * `ProductionProvenance`（demo を除いたもの）しか受け取れないように定義し、
 * `kind: "demo"` の値を渡すとコンパイルエラーになる。
 */

/** すべてのデータに付与できる出所情報。 */
export type DataProvenance =
  | {
      /** 各航空会社・空港・官公庁などの公式サイトを一次情報とするデータ。 */
      readonly kind: "official";
      readonly sourceUrl: string;
      readonly checkedAt: string;
    }
  | {
      /** 外部APIプロバイダーから取得したデータ（実データモード）。 */
      readonly kind: "provider";
      readonly provider: string;
      readonly fetchedAt: string;
      readonly expiresAt: string | null;
    }
  | {
      /** 公式情報を人手で確認して転記したデータ。 */
      readonly kind: "manualVerified";
      readonly sourceUrl: string;
      readonly checkedAt: string;
    }
  | {
      /** 機能確認用のデモデータ。実際の情報ではない。 */
      readonly kind: "demo";
      readonly warning: "not-real-data";
    }
  | {
      /** 取得できなかったことを表す。理由を保持する。 */
      readonly kind: "unavailable";
      readonly reason: string;
    };

/**
 * 実用モードで扱ってよい出所。demo を型から除外する。
 * これが「demo を実用モードへ渡せない」設計の要。
 */
export type ProductionProvenance = Exclude<DataProvenance, { kind: "demo" }>;

/** 値と出所をひとまとめにした型。 */
export type Provenanced<
  T,
  P extends DataProvenance = DataProvenance,
> = {
  readonly value: T;
  readonly provenance: P;
};

/**
 * 実用モードのコンポーネントが受け取れる値。
 * demo 出所の値（`Provenanced<T, { kind: "demo" }>`）はこの型に代入できない。
 */
export type ProductionValue<T> = Provenanced<T, ProductionProvenance>;

/** demo 出所であることが確定した値。 */
export type DemoValue<T> = Provenanced<T, Extract<DataProvenance, { kind: "demo" }>>;

export const DEMO_PROVENANCE = {
  kind: "demo",
  warning: "not-real-data",
} as const satisfies DataProvenance;

export function official(sourceUrl: string, checkedAt: string): ProductionProvenance {
  return { kind: "official", sourceUrl, checkedAt };
}

export function manualVerified(sourceUrl: string, checkedAt: string): ProductionProvenance {
  return { kind: "manualVerified", sourceUrl, checkedAt };
}

export function unavailable(reason: string): ProductionProvenance {
  return { kind: "unavailable", reason };
}

export function demo<T>(value: T): DemoValue<T> {
  return { value, provenance: DEMO_PROVENANCE };
}

export function isDemoProvenance(provenance: DataProvenance): boolean {
  return provenance.kind === "demo";
}

export function isProductionProvenance(
  provenance: DataProvenance,
): provenance is ProductionProvenance {
  return provenance.kind !== "demo";
}

/**
 * 実行時ガード。万一 demo データが実用モードの経路に流れてきたら、
 * 本番情報として描画する前に落とす（型で防げない動的な流入への保険）。
 */
export function assertProduction<T>(
  data: Provenanced<T>,
): asserts data is ProductionValue<T> {
  if (data.provenance.kind === "demo") {
    throw new Error(
      "デモデータを実用モードで使用しようとしました。実用モードでは架空データを表示できません。",
    );
  }
}

/** 出所の人間向けラベル（色に依存しない表示のため文字も持つ）。 */
export const PROVENANCE_LABELS: Readonly<Record<DataProvenance["kind"], string>> = {
  official: "公式情報",
  provider: "提供元データ",
  manualVerified: "公式確認済み",
  demo: "デモ（実データではありません）",
  unavailable: "取得できません",
};

/** 出所を色以外でも判別するための記号。 */
export const PROVENANCE_SYMBOLS: Readonly<Record<DataProvenance["kind"], string>> = {
  official: "✔",
  provider: "◆",
  manualVerified: "✔",
  demo: "⚠",
  unavailable: "—",
};
