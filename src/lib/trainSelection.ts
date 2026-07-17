/**
 * 「遅くとも乗るべき列車」と「推奨列車」の選定（要件19・29）。
 *
 * 遅くとも乗るべき列車 = 目標空港駅到着時刻に間に合う最も遅い列車。
 * ただし搭乗を保証するものではない。
 *
 * 推奨列車 = 原則として1本以上早い列車。単に「1本前」と固定せず、経路の
 * 安全性を評価して必要なだけ早い列車を選ぶ。乗換時間が短い・乗換回数が多い・
 * ラッシュ・始発に近い・LCCで締切が厳格・預け荷物あり・ターミナル間移動が
 * 必要、といった条件が重なるほど、より大きい安全余裕を要求する。
 *
 * 最短時間の経路だけを推奨してはいけない。初期表示では安全余裕の大きい経路を
 * 優先する。
 */

import type { AirlineCategory, RiskLevel, TransitRoute } from "@/domain/types";
import { dayTypeOf } from "@/domain/holidays";
import {
  clockOfJstDateTime,
  diffMinutes,
  jstDateTimeToAbsoluteMinutes,
  type JstDateTime,
} from "./time";

export type TrainSelectionContext = {
  readonly airlineCategory: AirlineCategory;
  readonly hasCheckedBaggage: boolean;
  readonly onlineCheckInAvailable: boolean;
  readonly terminalTransferMinutes: number;
  readonly usedBoardingFallback: boolean;
};

export type TrainSelectionInput = {
  /** 候補となる経路。出発時刻順でなくてよい。 */
  readonly routes: readonly TransitRoute[];
  /** 目標空港駅到着時刻（`calculateBoardingTime` の結果）。 */
  readonly targetArrivalAt: JstDateTime;
  readonly context: TrainSelectionContext;
};

export type TrainSelectionResult = {
  readonly status: "ok" | "first_train_too_late" | "no_routes";
  readonly latestSafeRoute?: TransitRoute;
  readonly recommendedRoute?: TransitRoute;
  readonly riskLevel: RiskLevel;
  readonly riskReasons: readonly string[];
  readonly recommendationReasons: readonly string[];
  readonly warnings: readonly string[];
  /** 推奨列車に求めた安全余裕（分）。根拠表示に使う。 */
  readonly requiredSlackMinutes: number;
};

/** 平日朝のラッシュ時間帯（この時間に駅を発つ列車は混雑を見込む）。 */
const RUSH_START_MINUTES = 7 * 60;
const RUSH_END_MINUTES = 9 * 60 + 30;

const BASE_REQUIRED_SLACK_MINUTES = 10;

export function selectTrains(input: TrainSelectionInput): TrainSelectionResult {
  const { routes, targetArrivalAt, context } = input;

  if (routes.length === 0) {
    return {
      status: "no_routes",
      riskLevel: "UNAVAILABLE",
      riskReasons: ["利用できる経路が見つかりませんでした。"],
      recommendationReasons: [],
      warnings: ["経路を取得できませんでした。公式の経路検索で確認してください。"],
      requiredSlackMinutes: 0,
    };
  }

  const sorted = [...routes].sort(
    (a, b) =>
      jstDateTimeToAbsoluteMinutes(a.departureAt) - jstDateTimeToAbsoluteMinutes(b.departureAt),
  );

  const targetMinutes = jstDateTimeToAbsoluteMinutes(targetArrivalAt);
  const eligible = sorted.filter(
    (route) => jstDateTimeToAbsoluteMinutes(route.arrivalAt) <= targetMinutes,
  );

  // 始発でも間に合わない場合は、無理な経路を推奨してはいけない（要件28）。
  if (eligible.length === 0) {
    return {
      status: "first_train_too_late",
      riskLevel: "UNAVAILABLE",
      riskReasons: ["当日の始発列車でも、推奨時刻までに空港へ到着できません。"],
      recommendationReasons: [],
      warnings: [
        "当日の始発列車では、推奨時刻までに空港へ到着できません。",
        "前日に空港周辺へ移動する、空港バスやタクシーを利用する、より遅い便を選ぶなどの検討が必要です。",
      ],
      requiredSlackMinutes: 0,
    };
  }

  const latestSafeRoute = eligible[eligible.length - 1];

  const { requiredSlackMinutes, slackReasons } = calculateRequiredSlack({
    context,
    latestSafeRoute,
  });

  // 推奨列車の条件:
  //  (1) 目標時刻に対して requiredSlackMinutes 以上の余裕をもって到着する
  //  (2) 遅くとも乗るべき列車より確実に早い（原則1本以上前）
  const recommendedDeadline = targetMinutes - requiredSlackMinutes;
  const latestSafeDeparture = jstDateTimeToAbsoluteMinutes(latestSafeRoute.departureAt);

  const withEnoughSlack = eligible.filter(
    (route) =>
      jstDateTimeToAbsoluteMinutes(route.arrivalAt) <= recommendedDeadline &&
      jstDateTimeToAbsoluteMinutes(route.departureAt) < latestSafeDeparture,
  );

  const recommendationReasons: string[] = [];
  const warnings: string[] = [];
  const riskReasons: string[] = [];

  let recommendedRoute: TransitRoute;
  if (withEnoughSlack.length > 0) {
    // 条件を満たす中では最も遅い列車を選ぶ（早すぎる列車を押し付けない）。
    recommendedRoute = withEnoughSlack[withEnoughSlack.length - 1];
    recommendationReasons.push("航空会社の搭乗締切を考慮しています。");
    recommendationReasons.push("空港駅からターミナルまでの移動時間を考慮しています。");
    recommendationReasons.push(
      `鉄道の遅延や乗換の失敗に備え、目標時刻より${requiredSlackMinutes}分以上早く着く列車を選んでいます。`,
    );
    recommendationReasons.push(...slackReasons);
  } else {
    // 十分な余裕を持つ列車が無い。せめて1本前を推奨する。
    const oneEarlier = eligible.filter(
      (route) => jstDateTimeToAbsoluteMinutes(route.departureAt) < latestSafeDeparture,
    );
    if (oneEarlier.length > 0) {
      recommendedRoute = oneEarlier[oneEarlier.length - 1];
      recommendationReasons.push(
        `安全余裕${requiredSlackMinutes}分を満たす列車がないため、遅くとも乗るべき列車の1本前を推奨しています。`,
      );
      recommendationReasons.push(...slackReasons);
      warnings.push("推奨列車でも安全余裕が十分ではありません。さらに早い移動を検討してください。");
      riskReasons.push("目標時刻に対して余裕のある列車がありません。");
    } else {
      // 間に合う列車が1本しかない。
      recommendedRoute = latestSafeRoute;
      recommendationReasons.push(
        "目標時刻に間に合う列車がこの1本しかないため、遅くとも乗るべき列車と同じ列車を推奨しています。",
      );
      warnings.push(
        "この列車を逃すと、当日中に搭乗できない可能性があります。1本の遅延が搭乗不可に直結します。",
      );
      riskReasons.push("間に合う列車が1本しかなく、代替がありません。");
    }
  }

  // --- リスク評価 --------------------------------------------------------
  const actualSlack = targetMinutes - jstDateTimeToAbsoluteMinutes(recommendedRoute.arrivalAt);
  const routeRisks = evaluateRouteRisks(recommendedRoute);
  riskReasons.push(...routeRisks);

  if (recommendedRoute === latestSafeRoute) {
    riskReasons.push("推奨列車と遅くとも乗るべき列車が同じです。");
  }

  const riskLevel = decideRiskLevel({
    actualSlack,
    requiredSlackMinutes,
    isSameAsLatest: recommendedRoute === latestSafeRoute,
    routeRiskCount: routeRisks.length,
  });

  if (eligible.length === 1) {
    warnings.push("1本遅れると搭乗が困難になります。");
  }

  if (recommendedRoute.isFirstTrain) {
    warnings.push("推奨列車が始発です。これより早い代替手段はありません。");
  }

  return {
    status: "ok",
    latestSafeRoute,
    recommendedRoute,
    riskLevel,
    riskReasons,
    recommendationReasons,
    warnings,
    requiredSlackMinutes,
  };
}

function calculateRequiredSlack(params: {
  context: TrainSelectionContext;
  latestSafeRoute: TransitRoute;
}): { requiredSlackMinutes: number; slackReasons: string[] } {
  const { context, latestSafeRoute } = params;
  const reasons: string[] = [];
  let slack = BASE_REQUIRED_SLACK_MINUTES;

  if (latestSafeRoute.transferCount >= 2) {
    slack += 10;
    reasons.push("乗換回数が多く、1回の遅れが後続に波及するため、より早い列車を選んでいます。");
  }

  const minMargin = minimumTransferMargin(latestSafeRoute);
  if (minMargin !== null && minMargin < 5) {
    slack += 10;
    reasons.push("乗換時間が極端に短い区間があるため、より早い列車を選んでいます。");
  } else if (minMargin !== null && minMargin < 8) {
    slack += 5;
    reasons.push("乗換時間に余裕が少ないため、より早い列車を選んでいます。");
  }

  if (isRushHour(latestSafeRoute)) {
    slack += 10;
    reasons.push("ラッシュ時間帯にあたるため、混雑による遅れを見込んでいます。");
  }

  if (latestSafeRoute.isFirstTrain) {
    slack += 15;
    reasons.push("始発に近く、遅延時の代替列車がないため、より大きい余裕を確保しています。");
  }

  if (context.airlineCategory === "LCC" || context.airlineCategory === "HYBRID") {
    slack += 10;
    reasons.push("LCCは締切が厳格で、遅れると搭乗できないため、より早い列車を選んでいます。");
  }

  if (context.hasCheckedBaggage) {
    slack += 10;
    reasons.push("預け荷物の手続き時間を見込んでいます。");
  }

  if (!context.onlineCheckInAvailable) {
    slack += 5;
    reasons.push("オンラインチェックインを利用できないため、カウンターでの待ち時間を見込んでいます。");
  }

  if (context.terminalTransferMinutes >= 20) {
    slack += 10;
    reasons.push("空港駅から搭乗ターミナルまでの移動が長いため、より早い列車を選んでいます。");
  }

  if (context.usedBoardingFallback) {
    slack += 10;
    reasons.push("航空会社の公式締切を確認できない項目があるため、安全側に倒しています。");
  }

  return { requiredSlackMinutes: slack, slackReasons: reasons };
}

/** 経路そのものの危うさ（乗換の詰まり・始発依存など）。 */
function evaluateRouteRisks(route: TransitRoute): string[] {
  const risks: string[] = [];
  const minMargin = minimumTransferMargin(route);
  if (minMargin !== null && minMargin < 5) {
    risks.push(`乗換時間が${minMargin}分しかない区間があります。`);
  }
  if (route.transferCount >= 2) {
    risks.push(`乗換が${route.transferCount}回あります。`);
  }
  if (route.isFirstTrain) {
    risks.push("始発列車のため、遅延しても代替列車がありません。");
  }
  if (isRushHour(route)) {
    risks.push("ラッシュ時間帯で混雑が見込まれます。");
  }
  return risks;
}

export function minimumTransferMargin(route: TransitRoute): number | null {
  const margins = route.legs
    .map((leg) => leg.transferMarginMinutes)
    .filter((margin): margin is number => margin !== undefined);
  return margins.length > 0 ? Math.min(...margins) : null;
}

function isRushHour(route: TransitRoute): boolean {
  const dayType = dayTypeOf(route.departureAt.slice(0, 10));
  if (dayType !== "weekday" && dayType !== "unknown") return false;
  const clock = clockOfJstDateTime(route.departureAt);
  const [hours, minutes] = clock.split(":").map(Number);
  const departureMinutes = hours * 60 + minutes;
  return departureMinutes >= RUSH_START_MINUTES && departureMinutes <= RUSH_END_MINUTES;
}

function decideRiskLevel(params: {
  actualSlack: number;
  requiredSlackMinutes: number;
  isSameAsLatest: boolean;
  routeRiskCount: number;
}): RiskLevel {
  const { actualSlack, requiredSlackMinutes, isSameAsLatest, routeRiskCount } = params;
  if (isSameAsLatest) return "HIGH";
  if (actualSlack < requiredSlackMinutes) return "HIGH";
  if (actualSlack >= requiredSlackMinutes * 2 && routeRiskCount === 0) return "LOW";
  if (routeRiskCount >= 2) return "MEDIUM";
  return actualSlack >= requiredSlackMinutes * 1.5 ? "LOW" : "MEDIUM";
}

/**
 * 経路の比較用スコア。初期表示では安全余裕の大きい経路を優先するため、
 * 最速だけでなく乗換の少なさ・余裕の大きさを考慮する（要件29）。
 */
export function safetyScoreOf(route: TransitRoute, targetArrivalAt: JstDateTime): number {
  const slack = diffMinutes(route.arrivalAt, targetArrivalAt);
  const minMargin = minimumTransferMargin(route);
  let score = slack;
  score -= route.transferCount * 5;
  if (minMargin !== null && minMargin < 5) score -= 15;
  if (route.isFirstTrain) score -= 10;
  return score;
}

export const LATEST_SAFE_TRAIN_DISCLAIMER =
  "鉄道の遅延、混雑、保安検査の待ち時間などにより、搭乗できない可能性があります。";
