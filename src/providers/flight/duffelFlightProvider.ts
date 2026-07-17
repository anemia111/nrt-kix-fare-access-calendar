/**
 * 実データ用の航空券プロバイダー（Duffel）の骨組み。
 *
 * ⚠ 現時点では未実装です。「実装済み」ではありません。
 *
 * 実装していない理由（調査結果, 2026-07-17 時点）:
 *  - Duffel の取扱航空会社一覧に Peach（MM）が含まれていない。NRT–KIX の直行便を
 *    運航しているのは Peach とジェットスター・ジャパンの2社のみのため、Peach が
 *    欠けたまま「最安値」と表示すると利用者を誤解させる。
 *  - Duffel の test モードは架空データ（Duffel Airways）を返すため実データにならず、
 *    live モードには支払い情報の登録が必要。
 *
 * 実装する場合にこのクラスが満たすべき契約:
 *  - `DUFFEL_API_KEY` はサーバー側でのみ読む。クライアントへ渡さない。
 *  - 税金・空港施設使用料・必須手数料を含む総額を `totalPriceYen` に入れる。
 *  - 料金内訳を取得できない場合は `fareBreakdown.known = false` にする。推測しない。
 *  - 残席数が取得できない場合は架空の数値を作らず、`availability.status` を
 *    `undisclosed` / `unknown` などにする。
 *  - API が返す予約URLは、航空会社の公式ドメイン上にあることを検証してから使う
 *    （`@/lib/officialLink` が検証する）。
 */

import type {
  AvailabilityResult,
  CalendarSearchInput,
  FlightOfferRefreshResult,
  FlightProvider,
  FlightSearchInput,
} from "./FlightProvider";
import type { DailyLowestFare, FlightOffer } from "@/domain/types";

export class DuffelFlightProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuffelFlightProviderNotConfiguredError";
  }
}

const NOT_IMPLEMENTED_MESSAGE =
  "Duffel プロバイダーは未実装です。デモモードで動作しています。実データモードを有効にするには、Duffel の live トークンを取得したうえで duffelFlightProvider.ts を実装してください。";

export class DuffelFlightProvider implements FlightProvider {
  readonly id = "duffel";
  readonly nameJa = "Duffel";
  readonly isDemo = false;
  readonly supportsPriceRefresh = true;

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new DuffelFlightProviderNotConfiguredError(
        "DUFFEL_API_KEY が設定されていません。",
      );
    }
  }

  async searchFlights(_input: FlightSearchInput): Promise<FlightOffer[]> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async getLowestFareByDate(_input: CalendarSearchInput): Promise<DailyLowestFare[]> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async refreshOffer(_offerId: string): Promise<FlightOfferRefreshResult> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async getAvailability(_offerId: string): Promise<AvailabilityResult> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async getBookingUrl(_offerId: string): Promise<string | null> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }
}
