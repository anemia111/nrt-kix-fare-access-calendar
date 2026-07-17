import { describe, expect, it } from "vitest";
import { calculateBoardingTime } from "@/lib/boardingTime";
import { findBoardingRule } from "@/domain/boardingRules";
import { clockOfJstDateTime } from "@/lib/time";
import { makeOffer } from "./fixtures";

const CALCULATED_AT = "2026-07-17T09:00:00+09:00";

function calc(offer = makeOffer(), options?: { baggage?: boolean; online?: boolean }) {
  return calculateBoardingTime({
    offer,
    hasCheckedBaggage: options?.baggage ?? false,
    usesOnlineCheckIn: options?.online ?? true,
    calculatedAt: CALCULATED_AT,
  });
}

describe("航空会社固有の公式ルールを優先する", () => {
  it("Peach(LCC)は公式値を使い、フォールバックにならない", () => {
    const result = calc(makeOffer({ marketingAirlineCode: "MM", operatingAirlineCode: "MM" }));
    expect(result.usedFallback).toBe(false);
    // 公式: 保安検査25分前 / 搭乗口20分前 / チェックイン30分前
    expect(clockOfJstDateTime(result.securityTargetAt!)).toBe("07:50");
    expect(clockOfJstDateTime(result.gateTargetAt!)).toBe("07:55");
    expect(clockOfJstDateTime(result.checkInDeadlineAt!)).toBe("07:45");
    expect(result.officialSources.some((url) => url.includes("flypeach.com"))).toBe(true);
  });

  it("JAL(FSC)は公式値を使う", () => {
    const result = calc(makeOffer({ marketingAirlineCode: "JL", operatingAirlineCode: "JL" }));
    expect(result.usedFallback).toBe(false);
    // 公式: 保安検査20分前 / 搭乗口10分前
    expect(clockOfJstDateTime(result.securityTargetAt!)).toBe("07:55");
    expect(clockOfJstDateTime(result.gateTargetAt!)).toBe("08:05");
    expect(result.officialSources.some((url) => url.includes("jal.co.jp"))).toBe(true);
  });

  it("LCCとFSCで計算結果が変わる", () => {
    const peach = calc(makeOffer({ marketingAirlineCode: "MM", operatingAirlineCode: "MM" }));
    const jal = calc(makeOffer({ marketingAirlineCode: "JL", operatingAirlineCode: "JL" }));
    // Peachの方が締切が早く、LCC加算もあるため、より早い到着が必要
    expect(peach.airportStationTargetAt < jal.airportStationTargetAt).toBe(true);
  });
});

describe("公式情報が不足する場合のフォールバック", () => {
  it("未登録の航空会社ではフォールバックを使い、その旨を根拠に残す", () => {
    const result = calc(makeOffer({ marketingAirlineCode: "ZZ", operatingAirlineCode: "ZZ" }));
    expect(result.usedFallback).toBe(true);
    expect(result.calculationReasons.some((reason) => reason.includes("目安を使用"))).toBe(true);
    // 公式値が無い項目は時刻を出さない（推測しない）
    expect(result.securityTargetAt).toBeUndefined();
    expect(result.gateTargetAt).toBeUndefined();
  });

  it("ジェットスターは保安検査の公式値が無い項目だけフォールバックする", () => {
    // 公式に保安検査通過締切の記載が確認できないため undefined のはず
    const rule = findBoardingRule("GK", "NRT", "第3ターミナル");
    expect(rule?.securityRecommendedMinutes).toBeUndefined();

    const result = calc(makeOffer({ marketingAirlineCode: "GK", operatingAirlineCode: "GK" }));
    expect(result.usedFallback).toBe(true);
    // 公式値のある搭乗口(15分前)は時刻が出る
    expect(clockOfJstDateTime(result.gateTargetAt!)).toBe("08:00");
    // 公式値の無い保安検査は時刻を出さない
    expect(result.securityTargetAt).toBeUndefined();
  });
});

describe("預け荷物とオンラインチェックイン", () => {
  it("預け荷物があると、より早い到着が必要になる", () => {
    const without = calc(makeOffer(), { baggage: false });
    const withBaggage = calc(makeOffer(), { baggage: true });
    expect(withBaggage.airportStationTargetAt < without.airportStationTargetAt).toBe(true);
    expect(
      withBaggage.calculationReasons.some((reason) => reason.includes("預け荷物があるため")),
    ).toBe(true);
  });

  it("オンラインチェックイン済み・荷物なしならカウンター手続きを計算から外す", () => {
    const online = calc(makeOffer(), { online: true, baggage: false });
    expect(
      online.calculationReasons.some((reason) => reason.includes("カウンターでの手続きは不要")),
    ).toBe(true);
  });

  it("オンラインチェックインを使わない場合はカウンター締切を考慮する", () => {
    const offline = calc(makeOffer(), { online: false, baggage: false });
    const online = calc(makeOffer(), { online: true, baggage: false });
    // Peachはチェックイン30分前 > 保安検査25分前 なので、締切が早まる
    expect(offline.airportStationTargetAt <= online.airportStationTargetAt).toBe(true);
  });
});

describe("ターミナル移動を計算に含める", () => {
  it("成田第3ターミナル(ジェットスター)は空港第2ビル駅から徒歩13分を加算する", () => {
    const result = calc(makeOffer({ marketingAirlineCode: "GK", operatingAirlineCode: "GK" }));
    expect(result.terminalTransferMinutes).toBe(13);
    expect(result.calculationReasons.some((reason) => reason.includes("空港第2ビル駅"))).toBe(true);
  });

  it("成田第1ターミナル(Peach)は成田空港駅から徒歩5分", () => {
    const result = calc(makeOffer({ marketingAirlineCode: "MM", operatingAirlineCode: "MM" }));
    expect(result.terminalTransferMinutes).toBe(5);
    expect(result.calculationReasons.some((reason) => reason.includes("成田空港駅"))).toBe(true);
  });

  it("関空第2ターミナル(Peach)は連絡バスの待ち時間と乗車時間を加算する", () => {
    const result = calc(
      makeOffer({ routeId: "KIX-NRT", marketingAirlineCode: "MM", operatingAirlineCode: "MM" }),
    );
    // 徒歩5 + 待ち15 + バス9 + 徒歩3 = 32分
    expect(result.terminalTransferMinutes).toBe(32);
    expect(result.calculationReasons.some((reason) => reason.includes("関西空港駅"))).toBe(true);
    // 連絡バスの待ち時間が公式値ではないことを根拠に残す
    expect(result.calculationReasons.some((reason) => reason.includes("連絡バス"))).toBe(true);
    expect(
      result.calculationReasons.some((reason) => reason.includes("安全側の目安")),
    ).toBe(true);
  });

  it("関空第2ターミナルは第1ターミナルより大幅に早い到着が必要", () => {
    const terminal2 = calc(
      makeOffer({ routeId: "KIX-NRT", marketingAirlineCode: "MM", operatingAirlineCode: "MM" }),
    );
    const terminal1 = calc(
      makeOffer({ routeId: "KIX-NRT", marketingAirlineCode: "GK", operatingAirlineCode: "GK" }),
    );
    expect(terminal2.terminalTransferMinutes).toBeGreaterThan(terminal1.terminalTransferMinutes);
  });

  it("ターミナル不明なら最も時間がかかるターミナルを想定して安全側に倒す", () => {
    const result = calc(makeOffer({ originTerminal: undefined }));
    // 成田で最大のものは第3ターミナルの13分
    expect(result.terminalTransferMinutes).toBe(13);
    expect(
      result.calculationReasons.some((reason) => reason.includes("出発ターミナルが不明")),
    ).toBe(true);
  });

  it("目標空港駅到着時刻はターミナル到着目標より移動時間だけ早い", () => {
    const result = calc(makeOffer({ marketingAirlineCode: "GK", operatingAirlineCode: "GK" }));
    const station = clockOfJstDateTime(result.airportStationTargetAt);
    const terminal = clockOfJstDateTime(result.terminalArrivalTargetAt);
    expect(station < terminal).toBe(true);
  });
});

describe("コードシェア便", () => {
  it("実際に運航する航空会社のルールを適用し、根拠に明示する", () => {
    const result = calc(
      makeOffer({ marketingAirlineCode: "JL", operatingAirlineCode: "GK", isCodeshare: true }),
    );
    expect(result.calculationReasons.some((reason) => reason.includes("コードシェア便"))).toBe(true);
    // 運航はジェットスター → 搭乗口15分前が使われる
    expect(clockOfJstDateTime(result.gateTargetAt!)).toBe("08:00");
  });
});

describe("安全余裕", () => {
  it("祝日は混雑を見込んで安全余裕を増やす", () => {
    // 2026-07-20 は海の日
    const holiday = calc(makeOffer({ date: "2026-07-20" }));
    const weekday = calc(makeOffer({ date: "2026-07-21" }));
    expect(holiday.safetyBufferMinutes).toBeGreaterThan(weekday.safetyBufferMinutes);
    expect(holiday.calculationReasons.some((reason) => reason.includes("祝日"))).toBe(true);
  });

  it("計算根拠と情報源を必ず保持する", () => {
    const result = calc();
    expect(result.calculationReasons.length).toBeGreaterThan(0);
    expect(result.officialSources.length).toBeGreaterThan(0);
    expect(result.calculatedAt).toBe(CALCULATED_AT);
  });
});

describe("日をまたぐ計算", () => {
  it("早朝便では前日の日付にまたがった目標時刻になっても破綻しない", () => {
    const offer = makeOffer({ departureMinutes: 30 }); // 00:30 発
    const result = calc(offer);
    // 目標駅到着は前日の23時台になる
    expect(result.airportStationTargetAt.startsWith("2026-07-20")).toBe(true);
  });
});
