/**
 * サイト名と表示モードの構成。
 *
 * 「最安値」という語は、実価格APIが有効で、対象路線を運航する Peach と
 * ジェットスターを含む比較範囲を正確に説明できる場合だけ使ってよい（要件）。
 * 現在は実価格APIが無いため、名称から「最安値」を外す。
 */

/** 実価格プロバイダーが有効かどうか。 */
export function realPriceProviderEnabled(): boolean {
  // NEXT_PUBLIC_DATA_MODE=live かつ実プロバイダーIDが設定されている場合のみ。
  // 現状は実装済みの実プロバイダーが無いため、常に false。
  return (
    process.env.NEXT_PUBLIC_DATA_MODE === "live" &&
    (process.env.NEXT_PUBLIC_FLIGHT_PROVIDER ?? "mock") !== "mock"
  );
}

/**
 * 「最安値」を名乗ってよいか。
 * 実価格APIが有効で、Peach とジェットスターの両方を比較範囲に含められる場合のみ。
 */
export function canClaimLowestFare(): boolean {
  // 実プロバイダー実装時に、Peach/ジェットスターのカバレッジを確認して true にする。
  return false;
}

export const SITE_NAME = canClaimLowestFare()
  ? "成田⇄関空 最安値・空港アクセスカレンダー"
  : "成田⇄関空 フライト・空港アクセス計画";

export const SITE_DESCRIPTION =
  "成田空港と関西国際空港を結ぶ航空便について、対応航空会社の公式予約サイト、出発空港のターミナルと最寄り駅、公式の搭乗締切、空港到着目標を確認できる計画ツールです。";

/** デモモードで全画面上部に常時表示する警告文。 */
export const DEMO_PERSISTENT_NOTICE =
  "機能確認用のデモです。価格・空席・列車時刻は実際の情報ではありません";
