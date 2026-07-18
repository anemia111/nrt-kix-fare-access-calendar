/**
 * 実価格プロバイダーの状態（将来のAPI導入用）。
 *
 * 重要な設計判断:
 *  - 実データモード（live）に設定したのにプロバイダーが未設定・無効な場合、
 *    **デモへ自動フォールバックしない**。架空データを本番情報として見せないため。
 *    代わりに `providerUnavailable` を返し、画面には
 *    「実価格検索プロバイダーが設定されていません」と表示する。
 *  - 正確な残席数が取得できない場合、席数を表示しない。
 */

/** 価格・空席の取得状態。数値は状態が許すときだけ持つ。 */
export type PriceState =
  | {
      /** リアルタイムの実価格を取得できた。 */
      readonly kind: "realTimePrice";
      readonly totalPriceYen: number;
      readonly currency: "JPY";
      readonly bookingAvailable: boolean;
      readonly fetchedAt: string;
      readonly expiresAt: string | null;
    }
  | {
      /** キャッシュされた参考価格（実価格ではあるが最新ではない）。 */
      readonly kind: "cachedReferencePrice";
      readonly totalPriceYen: number;
      readonly currency: "JPY";
      readonly fetchedAt: string;
      readonly expiresAt: string | null;
    }
  | {
      /** 予約可能だが価格は未取得。 */
      readonly kind: "bookingAvailable";
    }
  | {
      /** 在庫状況が不明。席数は表示しない。 */
      readonly kind: "availabilityUnknown";
    }
  | {
      readonly kind: "soldOut";
    }
  | {
      /** プロバイダー未設定・障害。実データモードでの既定の失敗状態。 */
      readonly kind: "providerUnavailable";
      readonly reason: string;
    }
  | {
      /** その航空会社を提供元が扱っていない（例: Peach を扱わないAPI）。 */
      readonly kind: "unsupportedCarrier";
      readonly airlineCode: string;
    };

export const PROVIDER_NOT_CONFIGURED_MESSAGE =
  "実価格検索プロバイダーが設定されていません";

export const PRICE_STATE_LABELS: Readonly<Record<PriceState["kind"], string>> = {
  realTimePrice: "実価格",
  cachedReferencePrice: "参考価格（キャッシュ）",
  bookingAvailable: "予約可能",
  availabilityUnknown: "在庫状況は不明",
  soldOut: "満席",
  providerUnavailable: "価格取得不可",
  unsupportedCarrier: "この航空会社は価格取得対象外",
};

/** 価格状態が実際の金額を持つか。 */
export function hasRealPrice(
  state: PriceState,
): state is Extract<PriceState, { totalPriceYen: number }> {
  return state.kind === "realTimePrice" || state.kind === "cachedReferencePrice";
}
