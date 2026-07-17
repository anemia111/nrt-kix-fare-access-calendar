/**
 * 航空券データ取得の抽象化（要件32）。
 *
 * 特定の航空券APIに強く依存しない構造にする。デモ用のモックと実APIの実装を
 * 差し替えられるよう、UI とロジックはこのインターフェースにのみ依存する。
 */

import type { JstDate, JstDateTime } from "@/lib/time";
import type { SelectableTimePeriod } from "@/domain/timePeriods";
import type {
  Availability,
  DailyLowestFare,
  FlightOffer,
  RouteId,
} from "@/domain/types";

export type FlightSearchInput = {
  readonly routeId: RouteId;
  readonly date: JstDate;
  readonly periods: readonly SelectableTimePeriod[];
  readonly adults: number;
};

export type CalendarSearchInput = {
  readonly routeId: RouteId;
  readonly startDate: JstDate;
  readonly days: number;
  readonly periods: readonly SelectableTimePeriod[];
  readonly adults: number;
};

/**
 * 価格再検証の結果（要件16）。
 * 「予約確定」ではなく、公式サイトへ進む前の価格確認のために使う。
 */
export type FlightOfferRefreshResult =
  | { readonly status: "unchanged"; readonly offer: FlightOffer }
  | {
      readonly status: "price_changed";
      readonly offer: FlightOffer;
      readonly previousPriceYen: number;
      readonly currentPriceYen: number;
    }
  /** 売り切れ・予約不可になった場合。 */
  | { readonly status: "unavailable"; readonly offerId: string }
  /** 価格再検証に対応していない提供元の場合。 */
  | { readonly status: "unsupported"; readonly offerId: string }
  | { readonly status: "not_found"; readonly offerId: string };

export type AvailabilityResult = {
  readonly offerId: string;
  readonly availability: Availability;
  readonly fetchedAt: JstDateTime;
};

export interface FlightProvider {
  readonly id: string;
  readonly nameJa: string;
  /** デモデータを返す提供元かどうか。画面表示の判断に使う。 */
  readonly isDemo: boolean;
  /** 価格再検証に対応しているか。 */
  readonly supportsPriceRefresh: boolean;

  searchFlights(input: FlightSearchInput): Promise<FlightOffer[]>;
  getLowestFareByDate(input: CalendarSearchInput): Promise<DailyLowestFare[]>;
  refreshOffer(offerId: string): Promise<FlightOfferRefreshResult>;
  getAvailability(offerId: string): Promise<AvailabilityResult>;
  /** 航空券APIが公式の予約ディープリンクを返す場合のみ URL を返す。 */
  getBookingUrl(offerId: string): Promise<string | null>;
}
