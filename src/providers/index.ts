/**
 * プロバイダーの選択（要件35）。
 *
 * 環境変数でデモモードと実データモードを切り替える。APIキーはサーバー側でのみ
 * 読み、クライアントへは絶対に渡さない。そのため `FLIGHT_API_KEY` などは
 * `NEXT_PUBLIC_` を付けない。付けるとビルド時にクライアントバンドルへ
 * 埋め込まれ、閲覧者に見えてしまう。
 *
 * クライアントに知らせてよいのは「今どちらのモードか」だけなので、それだけを
 * `NEXT_PUBLIC_DATA_MODE` として公開する。
 */

import { MockFlightProvider } from "./flight/mockFlightProvider";
import { MockTransitProvider } from "./transit/mockTransitProvider";
import type { FlightProvider } from "./flight/FlightProvider";
import type { TransitProvider } from "./transit/TransitProvider";

export type DataMode = "demo" | "live";

/**
 * 画面表示用のモード。クライアントからも参照してよい。
 * 既定はデモ。実データモードにするには明示的に設定する必要がある。
 */
export function currentDataMode(): DataMode {
  return process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "demo";
}

export function isDemoMode(): boolean {
  return currentDataMode() === "demo";
}

/**
 * 航空券プロバイダーを作る。
 *
 * 実データプロバイダーはサーバーランタイムでのみ動作する。GitHub Pages への
 * 静的エクスポートではサーバーが無いため、常にデモプロバイダーを返す。
 */
export function createFlightProvider(): FlightProvider {
  // 実データモードの有効化はサーバー側の実装が完了してから行う。
  // 現時点で実APIプロバイダーは未実装のため、常にデモを返す。
  return new MockFlightProvider();
}

export function createTransitProvider(): TransitProvider {
  return new MockTransitProvider();
}

/** デモモードで必ず表示する注意書き（要件34）。 */
export const DEMO_NOTICE_TITLE = "現在はデモデータを表示しています。";
export const DEMO_NOTICE_BODY = "実際の航空券価格、空席、列車時刻ではありません。";
