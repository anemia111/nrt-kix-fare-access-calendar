/**
 * 鉄道経路取得の抽象化（要件32）。
 *
 * 対象日の実際のダイヤに基づく経路を返す責務を持つ。今日のダイヤを将来の日付へ
 * そのまま流用してはいけない。対象日の時刻表が未公開の場合は経路を捏造せず
 * `timetable_unpublished` を返す（要件26）。
 */

import type { JstDate, JstDateTime } from "@/lib/time";
import type { TransitRoute } from "@/domain/types";

export type TransitSearchInput = {
  readonly originStationCode: string;
  readonly destinationStationCode: string;
  readonly date: JstDate;
  /** この時刻までに到着したい（目標空港駅到着時刻）。 */
  readonly arriveBy: JstDateTime;
};

export type TransitSearchResult =
  | {
      readonly status: "ok";
      readonly routes: readonly TransitRoute[];
      /** 対象日のダイヤ区分（平日／土休日）。 */
      readonly timetableKind: "weekday" | "holiday" | "unknown";
      readonly timetableSource: string;
      readonly fetchedAt: JstDateTime;
    }
  /** 対象日の正式な時刻表がまだ公開されていない。 */
  | {
      readonly status: "timetable_unpublished";
      readonly publishedUntil: JstDate;
      readonly timetableSource: string;
      readonly fetchedAt: JstDateTime;
    }
  | {
      readonly status: "error";
      readonly reason: string;
      readonly timetableSource: string;
      readonly fetchedAt: JstDateTime;
    };

/** 運行情報（要件27）。取得できない場合は available:false を返す。 */
export type ServiceStatus =
  | {
      readonly available: true;
      readonly disrupted: boolean;
      readonly messages: readonly string[];
      readonly sourceUrl: string;
      readonly fetchedAt: JstDateTime;
    }
  | {
      readonly available: false;
      readonly sourceUrl: string;
    };

export interface TransitProvider {
  readonly id: string;
  readonly nameJa: string;
  readonly isDemo: boolean;
  /** リアルタイム運行情報に対応しているか。 */
  readonly supportsRealtime: boolean;

  searchRoutes(input: TransitSearchInput): Promise<TransitSearchResult>;
  getServiceStatus(stationCode: string, date: JstDate): Promise<ServiceStatus>;
}
