/**
 * 実用モードの公式情報の組み立て。
 *
 * 架空の便・価格・空席・列車時刻を一切生成しない。返すのは、対象路線を運航する
 * 航空会社ごとの「公式に確認できる情報」だけ:
 *  - 航空会社と公式予約サイト
 *  - 出発空港のターミナルと最寄り駅、駅からの移動時間
 *  - 公式の搭乗締切
 *  - （利用者が出発時刻を入力した場合のみ）空港到着目標と前泊検討の要否
 *
 * すべての値に出所（provenance）を付け、最終確認日を保持する。
 */

import { AIRLINE_CATEGORY_LABELS, airlineCategoryOf, findAirline } from "@/domain/airlines";
import {
  FALLBACK_NOTICE,
  RULE_UNAVAILABLE_NOTICE,
  findBoardingRule,
  type AirlineBoardingRule,
} from "@/domain/boardingRules";
import { carriersOfRoute } from "@/domain/routeCarriers";
import { ROUTES } from "@/domain/routes";
import { findTerminalAccess, terminalOfAirline, type TerminalAccess } from "@/domain/terminals";
import { official, unavailable, type ProductionProvenance } from "@/domain/provenance";
import type { PlanSearchConditions } from "@/domain/planSearch";
import type { AirportCode, BoardingTimeCalculation } from "@/domain/types";
import { resolveOfficialLinkByAirline, type OfficialLink } from "@/lib/officialLink";
import {
  calculateBoardingTimeFromParams,
  type BoardingParams,
} from "@/lib/boardingTime";
import { clockToMinutes } from "@/domain/timePeriods";
import { clockOfJstDateTime, toJstDateTime, type JstDate, type JstDateTime } from "@/lib/time";

/** これより早い空港到着目標は、当日移動が困難として前泊検討を促す（目安）。 */
const EARLY_ARRIVAL_THRESHOLD_MINUTES = 5 * 60; // 05:00

export type OvernightRecommendation = {
  readonly recommend: boolean;
  readonly reason: string;
  readonly note: string;
};

export type CarrierPlan = {
  readonly airlineCode: string;
  readonly airlineNameJa: string;
  readonly categoryLabel: string;
  readonly officialLink: OfficialLink;
  /** 出発ターミナル（実データ）。 */
  readonly terminal: string | undefined;
  readonly terminalAccess: TerminalAccess | null;
  readonly terminalTransferMinutes: number | null;
  /** 公式の搭乗締切ルール。取得できなければ null。 */
  readonly boardingRule: AirlineBoardingRule | null;
  /** 公式に締切を確認できたか。 */
  readonly boardingRuleAvailable: boolean;
  readonly boardingRuleNote: string | null;
  /** 出発時刻が入力された場合の搭乗締切計算。未入力なら null。 */
  readonly boarding: BoardingTimeCalculation | null;
  readonly overnight: OvernightRecommendation | null;
  readonly provenance: ProductionProvenance;
  readonly carrierProvenance: ProductionProvenance;
};

export type PlanResult = {
  readonly routeId: PlanSearchConditions["routeId"];
  readonly routeLabel: string;
  readonly originAirport: AirportCode;
  readonly destinationAirport: AirportCode;
  readonly date: JstDate;
  readonly adults: number;
  readonly checkedBaggage: boolean;
  readonly departureTime: string | null;
  readonly carriers: readonly CarrierPlan[];
  readonly calculatedAt: JstDateTime;
};

export function buildPlan(
  conditions: PlanSearchConditions,
  calculatedAt: JstDateTime,
): PlanResult {
  const route = ROUTES[conditions.routeId];
  const originAirport = route.origin;

  const carriers = carriersOfRoute(conditions.routeId).map((carrier) =>
    buildCarrierPlan(carrier.airlineCode, carrier.provenance, conditions, originAirport, calculatedAt),
  );

  return {
    routeId: conditions.routeId,
    routeLabel: route.fullLabelJa,
    originAirport,
    destinationAirport: route.destination,
    date: conditions.date,
    adults: conditions.adults,
    checkedBaggage: conditions.checkedBaggage,
    departureTime: conditions.departureTime,
    carriers,
    calculatedAt,
  };
}

function buildCarrierPlan(
  airlineCode: string,
  carrierProvenance: ProductionProvenance,
  conditions: PlanSearchConditions,
  originAirport: AirportCode,
  calculatedAt: JstDateTime,
): CarrierPlan {
  const airline = findAirline(airlineCode);
  const terminal = terminalOfAirline(airlineCode, originAirport);
  const access = findTerminalAccess(originAirport, terminal);
  const terminalTransferMinutes = access
    ? access.components.reduce((sum, component) => sum + component.minutes, 0)
    : null;

  const rule = findBoardingRule(airlineCode, originAirport, terminal);
  const boardingRuleNote = rule
    ? rule.securityRecommendedMinutes === undefined
      ? FALLBACK_NOTICE
      : null
    : RULE_UNAVAILABLE_NOTICE;

  // 出発時刻が入力された場合のみ、具体的な空港到着目標を計算する。
  // 便時刻はこちらで生成しない（利用者が公式サイトで確認した値を使う）。
  let boarding: BoardingTimeCalculation | null = null;
  let overnight: OvernightRecommendation | null = null;
  if (conditions.departureTime) {
    const departureMinutes = clockToMinutes(conditions.departureTime);
    const params: BoardingParams = {
      originAirport,
      originTerminal: terminal,
      operatingAirlineCode: airlineCode,
      marketingAirlineCode: airlineCode,
      isCodeshare: false,
      date: conditions.date,
      departureMinutes,
      departureAt: toJstDateTime(conditions.date, departureMinutes),
      hasCheckedBaggage: conditions.checkedBaggage,
      usesOnlineCheckIn: true,
      calculatedAt,
    };
    boarding = calculateBoardingTimeFromParams(params);
    overnight = judgeOvernight(boarding.airportStationTargetAt);
  }

  const provenance: ProductionProvenance = rule
    ? official(rule.officialSourceUrls[0], rule.checkedAt)
    : airline
      ? official(airline.sourceUrls[0], airline.checkedAt)
      : unavailable(`${airlineCode} の公式情報を確認できませんでした`);

  return {
    airlineCode,
    airlineNameJa: airline?.airlineNameJa ?? `${airlineCode}（未登録）`,
    categoryLabel: AIRLINE_CATEGORY_LABELS[airlineCategoryOf(airlineCode)],
    officialLink: resolveOfficialLinkByAirline(airlineCode),
    terminal,
    terminalAccess: access,
    terminalTransferMinutes,
    boardingRule: rule,
    boardingRuleAvailable: rule !== null && rule.securityRecommendedMinutes !== undefined,
    boardingRuleNote,
    boarding,
    overnight,
    provenance,
    carrierProvenance,
  };
}

/**
 * 空港到着目標の時刻から前泊検討の要否を判断する。
 * 実際の始発時刻は取得していないため、時刻を根拠に控えめに案内し、
 * 必ず公式の経路検索での確認を促す。
 */
export function judgeOvernight(airportStationTargetAt: JstDateTime): OvernightRecommendation {
  const clock = clockOfJstDateTime(airportStationTargetAt);
  const [h, m] = clock.split(":").map(Number);
  const minutes = h * 60 + m;
  const targetDate = airportStationTargetAt.slice(0, 10);

  if (minutes < EARLY_ARRIVAL_THRESHOLD_MINUTES) {
    return {
      recommend: true,
      reason: `空港到着目標が ${clock}（${targetDate}）と早朝のため、当日の始発列車では間に合わない可能性があります。`,
      note: "前日に空港周辺へ移動する、空港バスやタクシーを利用する、より遅い便を選ぶなどをご検討ください。実際の始発時刻は公式の経路検索で必ず確認してください。",
    };
  }
  return {
    recommend: false,
    reason: `空港到着目標は ${clock} です。`,
    note: "始発列車の運行時間帯であれば当日移動で間に合う可能性がありますが、実際の列車時刻は公式の経路検索で必ず確認してください。",
  };
}
