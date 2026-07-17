/**
 * 目標空港到着時刻の算出（要件17・21・22）。
 *
 * 単純に「出発時刻から一定時間を引く」計算はしない。次の順で組み立てる。
 *
 *   飛行機出発時刻
 *   − 航空会社の搭乗手続き上必要な時間（公式の締切のうち最も早いもの）
 *   − 安全余裕（LCCの締切厳格性・預け荷物・混雑・祝日などで変動）
 *   ＝ 目標ターミナル到着時刻
 *   − 空港駅からターミナルまでの移動時間
 *   ＝ 目標空港駅到着時刻
 *
 * 航空会社固有の公式ルールを最優先し、公式情報が不足する場合に限り
 * LCC・FSC区分に応じた安全側のフォールバックを使う。フォールバックを使った
 * ことは `usedFallback` で呼び出し側に伝え、画面に注意書きを表示させる。
 */

import {
  BOARDING_FALLBACKS,
  FALLBACK_NOTICE,
  findBoardingRule,
  type AirlineBoardingRule,
} from "@/domain/boardingRules";
import { airlineCategoryOf, airlineDisplayName, findAirline } from "@/domain/airlines";
import { dayTypeOf, DAY_TYPE_LABELS } from "@/domain/holidays";
import {
  findTerminalAccess,
  totalTransferMinutes,
  worstCaseTransferMinutes,
} from "@/domain/terminals";
import type { AirportCode, BoardingTimeCalculation, FlightOffer } from "@/domain/types";
import { toJstDateTime, type JstDateTime } from "./time";

export type BoardingTimeInput = {
  readonly offer: FlightOffer;
  /** 預け荷物があるか。既定の検索条件は「預け荷物なし」（要件3）。 */
  readonly hasCheckedBaggage: boolean;
  /** オンライン／アプリチェックインを済ませているか。 */
  readonly usesOnlineCheckIn: boolean;
  readonly calculatedAt: JstDateTime;
};

/** 安全余裕の基礎値（分）。空港内で迷う・並ぶことを見込む最低限。 */
const BASE_SAFETY_BUFFER_MINUTES = 10;

export function calculateBoardingTime(input: BoardingTimeInput): BoardingTimeCalculation {
  const { offer, hasCheckedBaggage, usesOnlineCheckIn, calculatedAt } = input;
  const airportCode = offer.originAirport;
  const reasons: string[] = [];
  const sources = new Set<string>();

  // --- 1. 適用する航空会社ルールを決める ---------------------------------
  // コードシェア便では空港での手続きは実際の運航会社の案内が適用されることが
  // 多いため、運航会社を先に探し、無ければ販売会社で探す（要件14）。
  const { rule, appliedAirlineCode } = resolveRule(offer, airportCode);

  const category = airlineCategoryOf(appliedAirlineCode);
  const fallback = BOARDING_FALLBACKS[category];

  if (offer.isCodeshare) {
    reasons.push(
      `コードシェア便のため、実際に空港手続きが適用される${airlineDisplayName(appliedAirlineCode)}のルールで計算しています。`,
    );
  }

  if (rule) {
    rule.officialSourceUrls.forEach((url) => sources.add(url));
  } else {
    reasons.push(
      `${airlineDisplayName(appliedAirlineCode)}の公式の搭乗締切を確認できなかったため、${category === "UNKNOWN" ? "最も安全側の" : `${category}区分の`}目安を使用しています。`,
    );
    const airline = findAirline(appliedAirlineCode);
    airline?.sourceUrls.forEach((url) => sources.add(url));
  }

  // --- 2. 各締切を確定する（公式値が無い項目だけフォールバック） ---------
  let usedFallback = !rule;

  const checkInMinutes = pick(rule?.checkInDeadlineMinutes, fallback.checkInDeadlineMinutes);
  const baggageDropMinutes = pick(
    rule?.baggageDropDeadlineMinutes,
    fallback.baggageDropDeadlineMinutes,
  );
  const securityMinutes = pick(rule?.securityRecommendedMinutes, fallback.securityRecommendedMinutes);
  const gateMinutes = pick(rule?.gateDeadlineMinutes, fallback.gateDeadlineMinutes);

  if (rule) {
    const missing: string[] = [];
    if (rule.checkInDeadlineMinutes === undefined) missing.push("チェックイン締切");
    if (hasCheckedBaggage && rule.baggageDropDeadlineMinutes === undefined) {
      missing.push("手荷物預け締切");
    }
    if (rule.securityRecommendedMinutes === undefined) missing.push("保安検査通過目標");
    if (rule.gateDeadlineMinutes === undefined) missing.push("搭乗口到着締切");
    if (missing.length > 0) {
      usedFallback = true;
      reasons.push(
        `公式サイトで${missing.join("・")}を確認できなかったため、その項目のみ${category}区分の安全側の目安を使用しています。`,
      );
    }
  }

  // --- 3. 拘束条件（最も早い締切）を決める ------------------------------
  const applicable: Array<{ label: string; minutes: number }> = [];

  applicable.push({ label: "保安検査通過目標", minutes: securityMinutes });
  applicable.push({ label: "搭乗口到着締切", minutes: gateMinutes });

  if (hasCheckedBaggage) {
    applicable.push({ label: "手荷物預け締切", minutes: baggageDropMinutes });
    applicable.push({ label: "チェックイン締切", minutes: checkInMinutes });
    reasons.push("預け荷物があるため、手荷物預け締切を計算に含めています。");
  } else if (usesOnlineCheckIn && rule?.onlineCheckInAvailable) {
    reasons.push(
      "オンライン／アプリチェックイン済みかつ預け荷物なしのため、カウンターでの手続きは不要として計算しています。",
    );
  } else {
    applicable.push({ label: "チェックイン締切", minutes: checkInMinutes });
    if (usesOnlineCheckIn && rule && !rule.onlineCheckInAvailable) {
      reasons.push(
        "この航空会社ではオンラインチェックインを利用できないため、カウンターでの手続き時間を計算に含めています。",
      );
    }
  }

  // 最も早い締切＝出発時刻から見て最も大きい「◯分前」が拘束条件になる。
  const binding = applicable.reduce((earliest, current) =>
    current.minutes > earliest.minutes ? current : earliest,
  );
  reasons.push(
    `航空会社の締切のうち最も早いのは${binding.label}（出発${binding.minutes}分前）のため、これを基準にしています。`,
  );

  // --- 4. 安全余裕 -------------------------------------------------------
  const { safetyBufferMinutes, bufferReasons } = calculateSafetyBuffer({
    category,
    hasCheckedBaggage,
    usedFallback,
    date: offer.date,
  });
  reasons.push(...bufferReasons);

  // --- 5. ターミナル移動 -------------------------------------------------
  const access = findTerminalAccess(airportCode, offer.originTerminal);
  let terminalTransferMinutes: number;
  if (access) {
    terminalTransferMinutes = totalTransferMinutes(access);
    access.sourceUrls.forEach((url) => sources.add(url));
    reasons.push(
      `${access.stationNameJa}から${offer.originTerminal}のチェックインカウンターまで${terminalTransferMinutes}分かかるため、その分早い列車が必要です。`,
    );
    const assumptions = access.components.filter((component) => !component.official);
    if (assumptions.length > 0) {
      reasons.push(
        `うち${assumptions.map((component) => component.label).join("・")}は公式に分数の記載がないため、アプリ側で安全側の目安を使用しています。`,
      );
    }
  } else {
    // ターミナルが不明な場合は、その空港で最も時間がかかるターミナルを想定する。
    terminalTransferMinutes = worstCaseTransferMinutes(airportCode);
    reasons.push(
      `出発ターミナルが不明なため、この空港で最も移動に時間がかかるターミナル（${terminalTransferMinutes}分）を想定して安全側に計算しています。`,
    );
  }

  // --- 6. 各時刻を組み立てる --------------------------------------------
  const departureMinutes = offer.departureMinutes;
  const at = (minutesBeforeDeparture: number): JstDateTime =>
    toJstDateTime(offer.date, departureMinutes - minutesBeforeDeparture);

  const terminalArrivalOffset = binding.minutes + safetyBufferMinutes;
  const stationTargetOffset = terminalArrivalOffset + terminalTransferMinutes;

  return {
    flightDepartureAt: offer.departureAt,
    checkInDeadlineAt: rule?.checkInDeadlineMinutes !== undefined ? at(checkInMinutes) : undefined,
    baggageDropDeadlineAt:
      rule?.baggageDropDeadlineMinutes !== undefined ? at(baggageDropMinutes) : undefined,
    securityTargetAt:
      rule?.securityRecommendedMinutes !== undefined ? at(securityMinutes) : undefined,
    gateTargetAt: rule?.gateDeadlineMinutes !== undefined ? at(gateMinutes) : undefined,
    airportStationTargetAt: at(stationTargetOffset),
    terminalArrivalTargetAt: at(terminalArrivalOffset),
    terminalTransferMinutes,
    safetyBufferMinutes,
    calculationReasons: reasons,
    officialSources: [...sources],
    usedFallback,
    calculatedAt,
  };
}

function pick(officialValue: number | undefined, fallbackValue: number): number {
  return officialValue ?? fallbackValue;
}

function resolveRule(
  offer: FlightOffer,
  airportCode: AirportCode,
): { rule: AirlineBoardingRule | null; appliedAirlineCode: string } {
  const operatingRule = findBoardingRule(
    offer.operatingAirlineCode,
    airportCode,
    offer.originTerminal,
  );
  if (operatingRule) {
    return { rule: operatingRule, appliedAirlineCode: offer.operatingAirlineCode };
  }
  const marketingRule = findBoardingRule(
    offer.marketingAirlineCode,
    airportCode,
    offer.originTerminal,
  );
  if (marketingRule) {
    return { rule: marketingRule, appliedAirlineCode: offer.marketingAirlineCode };
  }
  return { rule: null, appliedAirlineCode: offer.operatingAirlineCode };
}

type SafetyBufferInput = {
  category: ReturnType<typeof airlineCategoryOf>;
  hasCheckedBaggage: boolean;
  usedFallback: boolean;
  date: string;
};

/**
 * 安全余裕を状況に応じて積み上げる。「LCCだから一律◯分」にはしない。
 */
export function calculateSafetyBuffer(input: SafetyBufferInput): {
  safetyBufferMinutes: number;
  bufferReasons: string[];
} {
  const reasons: string[] = [];
  let buffer = BASE_SAFETY_BUFFER_MINUTES;
  reasons.push(`空港内で迷う・並ぶ可能性を見込み、基礎の安全余裕として${BASE_SAFETY_BUFFER_MINUTES}分を確保しています。`);

  if (input.category === "LCC" || input.category === "HYBRID") {
    buffer += 10;
    reasons.push("LCCは締切の運用が厳格で、締切を過ぎると搭乗できないため、安全余裕を10分追加しています。");
  }

  if (input.hasCheckedBaggage) {
    buffer += 10;
    reasons.push("預け荷物カウンターの待ち時間を見込み、安全余裕を10分追加しています。");
  }

  if (input.usedFallback) {
    buffer += 10;
    reasons.push("公式の締切時刻を確認できない項目があるため、安全余裕を10分追加しています。");
  }

  const dayType = dayTypeOf(input.date);
  if (dayType === "holiday" || dayType === "saturday" || dayType === "sunday") {
    buffer += 10;
    reasons.push(
      `${DAY_TYPE_LABELS[dayType]}は空港が混雑しやすいため、安全余裕を10分追加しています。`,
    );
  } else if (dayType === "unknown") {
    buffer += 10;
    reasons.push("対象日の祝日判定ができないため、安全側に安全余裕を10分追加しています。");
  }

  return { safetyBufferMinutes: buffer, bufferReasons: reasons };
}

export { FALLBACK_NOTICE };
