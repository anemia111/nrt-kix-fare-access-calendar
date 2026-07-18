/**
 * デモ用の鉄道経路プロバイダー。
 *
 * ここが返す列車時刻・運賃はすべて架空のデモデータであり、実際のダイヤではない。
 *
 * ただし「実際の時刻表APIが持つべき性質」は再現している:
 *  - 対象日の平日／土休日ダイヤを区別する（今日のダイヤを将来へ流用しない）
 *  - 対象日の時刻表が未公開の期間は経路を返さず timetable_unpublished を返す
 *  - 運賃を取得できない経路では null を返す（推測しない）
 *  - 一部の日に運行情報の警告を出す
 */

import { timetableKindOf } from "@/domain/holidays";
import type { DataSource, TransitLeg, TransitRoute } from "@/domain/types";
import { randomInt, seededRandom } from "@/lib/random";
import { diffDays, todayInJst, toJstDateTime, type JstDate, type JstDateTime } from "@/lib/time";
import type {
  ServiceStatus,
  TransitProvider,
  TransitSearchInput,
  TransitSearchResult,
} from "./TransitProvider";

const PROVIDER_ID = "demo-transit";
const PROVIDER_NAME_JA = "デモデータ（実際の列車時刻ではありません）";
const TIMETABLE_SOURCE = "デモデータ（実際の時刻表ではありません）";

/**
 * デモ用の「時刻表が公開されている日数」。
 *
 * これは**デモモード限定**の演出で、`scheduleUnavailable` の表示を確認するために
 * 残している。実データモードにはこの固定制限は無く、Google Routes へ実際に
 * 問い合わせて、経路が返らなかった場合のみ「ダイヤ未取得」として扱う
 * （`worker/src/googleRoutes.ts`）。
 */
export const TIMETABLE_PUBLISHED_DAYS = 60;

type LegTemplate = {
  readonly lineNameJa: string;
  readonly fromStationNameJa: string;
  readonly toStationNameJa: string;
  readonly durationMinutes: number;
};

type DemoCorridor = {
  readonly originStationCode: string;
  readonly originStationNameJa: string;
  readonly destinationStationCodes: readonly string[];
  /** 平日の始発（00:00からの経過分）。 */
  readonly firstTrainWeekday: number;
  /** 土休日の始発。 */
  readonly firstTrainHoliday: number;
  readonly lastTrainMinutes: number;
  readonly legs: readonly LegTemplate[];
  readonly baseFareYen: number;
  readonly serviceInfoSourceUrl: string;
};

const CORRIDORS: readonly DemoCorridor[] = [
  {
    originStationCode: "KAMATORI",
    originStationNameJa: "鎌取駅",
    destinationStationCodes: ["NRT-AIRPORT", "NRT-T2BLDG"],
    firstTrainWeekday: 4 * 60 + 52,
    firstTrainHoliday: 5 * 60 + 10,
    lastTrainMinutes: 21 * 60 + 30,
    legs: [
      { lineNameJa: "JR外房線", fromStationNameJa: "鎌取駅", toStationNameJa: "千葉駅", durationMinutes: 18 },
      { lineNameJa: "JR総武本線・成田線（空港支線）", fromStationNameJa: "千葉駅", toStationNameJa: "空港第2ビル駅", durationMinutes: 62 },
    ],
    baseFareYen: 1340,
    serviceInfoSourceUrl: "https://www.jreast.co.jp/",
  },
  {
    originStationCode: "WAKAYAMA",
    originStationNameJa: "和歌山駅",
    destinationStationCodes: ["KIX-AIRPORT"],
    firstTrainWeekday: 5 * 60 + 5,
    firstTrainHoliday: 5 * 60 + 25,
    lastTrainMinutes: 21 * 60 + 50,
    legs: [
      { lineNameJa: "JR阪和線", fromStationNameJa: "和歌山駅", toStationNameJa: "日根野駅", durationMinutes: 32 },
      { lineNameJa: "JR関空快速", fromStationNameJa: "日根野駅", toStationNameJa: "関西空港駅", durationMinutes: 13 },
    ],
    baseFareYen: 890,
    serviceInfoSourceUrl: "https://www.westjr.co.jp/",
  },
];

function findCorridor(originStationCode: string): DemoCorridor | null {
  return CORRIDORS.find((corridor) => corridor.originStationCode === originStationCode) ?? null;
}

function dataSource(fetchedAt: JstDateTime): DataSource {
  return {
    providerId: PROVIDER_ID,
    providerNameJa: PROVIDER_NAME_JA,
    isDemo: true,
    fetchedAt,
  };
}

function nowJst(): JstDateTime {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.toISOString().slice(0, 10)}T${jst.toISOString().slice(11, 16)}:00+09:00`;
}

/** 成田空港駅は空港第2ビル駅の次の駅のため、その分だけ余計にかかる。 */
function extraMinutesForDestination(destinationStationCode: string): number {
  return destinationStationCode === "NRT-AIRPORT" ? 2 : 0;
}

function buildRoutes(
  corridor: DemoCorridor,
  destinationStationCode: string,
  date: JstDate,
  fetchedAt: JstDateTime,
): TransitRoute[] {
  const kind = timetableKindOf(date);
  const firstTrain =
    kind === "weekday" ? corridor.firstTrainWeekday : corridor.firstTrainHoliday;
  const extra = extraMinutesForDestination(destinationStationCode);
  const routes: TransitRoute[] = [];

  let departureMinutes = firstTrain;
  let index = 0;
  while (departureMinutes <= corridor.lastTrainMinutes) {
    const random = seededRandom(`train:${corridor.originStationCode}:${date}:${index}`);
    // 乗換時間は列車ごとに変える。極端に短い接続も再現する。
    const transferMargin = randomInt(random, 3, 14);
    // 快速・各停の差を再現する。
    const speedPenalty = randomInt(random, 0, 8);

    const leg1Duration = corridor.legs[0].durationMinutes;
    const leg2Duration = corridor.legs[1].durationMinutes + speedPenalty + extra;

    const leg1Departure = departureMinutes;
    const leg1Arrival = leg1Departure + leg1Duration;
    const leg2Departure = leg1Arrival + transferMargin;
    const leg2Arrival = leg2Departure + leg2Duration;

    const destinationNameJa =
      destinationStationCode === "NRT-AIRPORT"
        ? "成田空港駅"
        : corridor.legs[1].toStationNameJa;

    const legs: TransitLeg[] = [
      {
        lineNameJa: corridor.legs[0].lineNameJa,
        fromStationNameJa: corridor.legs[0].fromStationNameJa,
        toStationNameJa: corridor.legs[0].toStationNameJa,
        departureAt: toJstDateTime(date, leg1Departure),
        arrivalAt: toJstDateTime(date, leg1Arrival),
      },
      {
        lineNameJa: corridor.legs[1].lineNameJa,
        fromStationNameJa: corridor.legs[1].fromStationNameJa,
        toStationNameJa: destinationNameJa,
        departureAt: toJstDateTime(date, leg2Departure),
        arrivalAt: toJstDateTime(date, leg2Arrival),
        transferMarginMinutes: transferMargin,
      },
    ];

    // 一部の経路は運賃を取得できないことを再現する。推測値で埋めない。
    const fareUnavailable = random() < 0.06;

    routes.push({
      id: `demo:${corridor.originStationCode}:${destinationStationCode}:${date}:${index}`,
      legs,
      departureAt: toJstDateTime(date, leg1Departure),
      arrivalAt: toJstDateTime(date, leg2Arrival),
      transferCount: 1,
      durationMinutes: leg2Arrival - leg1Departure,
      fareYen: fareUnavailable ? null : corridor.baseFareYen,
      isFirstTrain: index === 0,
      source: dataSource(fetchedAt),
    });

    departureMinutes += randomInt(random, 18, 32);
    index += 1;
  }

  return routes;
}

export class MockTransitProvider implements TransitProvider {
  readonly id = PROVIDER_ID;
  readonly nameJa = PROVIDER_NAME_JA;
  readonly isDemo = true;
  // デモプロバイダーはリアルタイム運行情報を持たない。
  readonly supportsRealtime = false;

  private readonly today: JstDate;

  constructor(today: JstDate = todayInJst()) {
    this.today = today;
  }

  async searchRoutes(input: TransitSearchInput): Promise<TransitSearchResult> {
    const fetchedAt = nowJst();
    const corridor = findCorridor(input.originStationCode);

    if (!corridor) {
      return {
        status: "error",
        reason: `対応していない出発駅です: ${input.originStationCode}`,
        timetableSource: TIMETABLE_SOURCE,
        fetchedAt,
      };
    }

    if (!corridor.destinationStationCodes.includes(input.destinationStationCode)) {
      return {
        status: "error",
        reason: `対応していない到着駅です: ${input.destinationStationCode}`,
        timetableSource: TIMETABLE_SOURCE,
        fetchedAt,
      };
    }

    // 対象日の時刻表がまだ公開されていない期間は、経路を作らない。
    const daysAhead = diffDays(this.today, input.date);
    if (daysAhead > TIMETABLE_PUBLISHED_DAYS) {
      return {
        status: "timetable_unpublished",
        publishedUntil: addDaysSafe(this.today, TIMETABLE_PUBLISHED_DAYS),
        timetableSource: TIMETABLE_SOURCE,
        fetchedAt,
      };
    }

    const routes = buildRoutes(corridor, input.destinationStationCode, input.date, fetchedAt);
    return {
      status: "ok",
      routes,
      timetableKind: timetableKindOf(input.date),
      timetableSource: TIMETABLE_SOURCE,
      fetchedAt,
    };
  }

  async getServiceStatus(stationCode: string, _date: JstDate): Promise<ServiceStatus> {
    const corridor = findCorridor(stationCode);
    // リアルタイム運行情報を取得できないため available:false を返す。
    // 画面には「通常ダイヤに基づく計算です」と表示させる（要件27）。
    return {
      available: false,
      sourceUrl: corridor?.serviceInfoSourceUrl ?? "https://www.jreast.co.jp/",
    };
  }
}

function addDaysSafe(date: JstDate, days: number): JstDate {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/**
 * デモ用に、一部の日で遅延警告を出すか判定する。
 * 実データモードでは提供元のリアルタイム運行情報に置き換える。
 */
export function demoServiceWarning(stationCode: string, date: JstDate): string | null {
  const random = seededRandom(`service:${stationCode}:${date}`);
  const roll = random();
  if (roll < 0.06) {
    return "【デモ】強風の影響で遅延が発生する可能性があります。最新の運行情報を鉄道会社公式サイトで確認してください。";
  }
  if (roll < 0.1) {
    return "【デモ】線路設備の工事に伴い、一部列車の時刻が変更される可能性があります。";
  }
  return null;
}
