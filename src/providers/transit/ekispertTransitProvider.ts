/**
 * 実データ用の鉄道経路プロバイダー（駅すぱあと API）の骨組み。
 *
 * ⚠ 現時点では未実装です。「実装済み」ではありません。
 *
 * 実装していない理由（調査結果, 2026-07-17 時点）:
 *  - 駅すぱあと API のフリープラン（無料）で使えるのは駅情報の取得と経路検索結果
 *    URL の生成のみで、経路探索そのものが含まれない。
 *  - 経路探索を含む全機能を使えるのは90日間の評価版のみで、恒久的に無料で
 *    利用できる手段にならない。
 *
 * 実装する場合にこのクラスが満たすべき契約:
 *  - `EKISPERT_API_KEY` はサーバー側でのみ読む。クライアントへ渡さない。
 *  - 対象日を必ずリクエストに含める。今日のダイヤを将来の日付へ流用しない。
 *  - 対象日の時刻表が未公開の場合は `timetable_unpublished` を返す。経路を作らない。
 *  - 運賃を取得できない経路は `fareYen: null` にする。推測しない。
 *  - 提供元の利用規約に従い、キャッシュ期間と再配布の可否を守る。
 *
 * 参考: https://docs.ekispert.com/v1/
 */

import type {
  ServiceStatus,
  TransitProvider,
  TransitSearchInput,
  TransitSearchResult,
} from "./TransitProvider";
import type { JstDate } from "@/lib/time";

export class EkispertTransitProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EkispertTransitProviderNotConfiguredError";
  }
}

const NOT_IMPLEMENTED_MESSAGE =
  "駅すぱあと API プロバイダーは未実装です。デモモードで動作しています。実データモードを有効にするには、経路探索を含むプランのアクセスキーを取得したうえで ekispertTransitProvider.ts を実装してください。";

export class EkispertTransitProvider implements TransitProvider {
  readonly id = "ekispert";
  readonly nameJa = "駅すぱあと API";
  readonly isDemo = false;
  readonly supportsRealtime = false;

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new EkispertTransitProviderNotConfiguredError(
        "EKISPERT_API_KEY が設定されていません。",
      );
    }
  }

  async searchRoutes(_input: TransitSearchInput): Promise<TransitSearchResult> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async getServiceStatus(_stationCode: string, _date: JstDate): Promise<ServiceStatus> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }
}
