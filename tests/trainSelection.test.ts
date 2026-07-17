import { describe, expect, it } from "vitest";
import { selectTrains, type TrainSelectionContext } from "@/lib/trainSelection";
import { makeTransitRoute } from "./fixtures";

const BASE_CONTEXT: TrainSelectionContext = {
  airlineCategory: "FSC",
  hasCheckedBaggage: false,
  onlineCheckInAvailable: true,
  terminalTransferMinutes: 5,
  usedBoardingFallback: false,
};

const TARGET = "2026-07-21T06:15:00+09:00";

describe("遅くとも乗るべき列車", () => {
  it("目標時刻に間に合う最も遅い列車を選ぶ", () => {
    const result = selectTrains({
      routes: [
        makeTransitRoute({ departure: "04:31", arrival: "05:48" }),
        makeTransitRoute({ departure: "04:52", arrival: "06:02" }),
        makeTransitRoute({ departure: "05:20", arrival: "06:30" }), // 目標超過
      ],
      targetArrivalAt: TARGET,
      context: BASE_CONTEXT,
    });

    expect(result.status).toBe("ok");
    expect(result.latestSafeRoute?.departureAt).toContain("04:52");
  });

  it("目標時刻を過ぎる列車は候補にしない", () => {
    const result = selectTrains({
      routes: [
        makeTransitRoute({ departure: "04:31", arrival: "05:48" }),
        makeTransitRoute({ departure: "05:30", arrival: "06:16" }), // 1分超過
      ],
      targetArrivalAt: TARGET,
      context: BASE_CONTEXT,
    });
    expect(result.latestSafeRoute?.departureAt).toContain("04:31");
  });
});

describe("推奨列車", () => {
  it("遅くとも乗るべき列車より早い列車を推奨する", () => {
    const result = selectTrains({
      routes: [
        makeTransitRoute({ departure: "04:00", arrival: "05:10" }),
        makeTransitRoute({ departure: "04:31", arrival: "05:48" }),
        makeTransitRoute({ departure: "04:52", arrival: "06:02" }),
      ],
      targetArrivalAt: TARGET,
      context: BASE_CONTEXT,
    });

    expect(result.latestSafeRoute?.departureAt).toContain("04:52");
    expect(result.recommendedRoute?.departureAt).not.toContain("04:52");
    expect(result.recommendationReasons.length).toBeGreaterThan(0);
  });

  it("条件が悪いほど、より早い列車を選ぶ（1本前に固定しない）", () => {
    const routes = [
      makeTransitRoute({ departure: "04:00", arrival: "05:05" }),
      makeTransitRoute({ departure: "04:20", arrival: "05:25" }),
      makeTransitRoute({ departure: "04:40", arrival: "05:45" }),
      makeTransitRoute({ departure: "05:00", arrival: "06:05" }),
    ];

    const easy = selectTrains({ routes, targetArrivalAt: TARGET, context: BASE_CONTEXT });
    const hard = selectTrains({
      routes,
      targetArrivalAt: TARGET,
      context: {
        airlineCategory: "LCC",
        hasCheckedBaggage: true,
        onlineCheckInAvailable: false,
        terminalTransferMinutes: 32,
        usedBoardingFallback: true,
      },
    });

    expect(hard.requiredSlackMinutes).toBeGreaterThan(easy.requiredSlackMinutes);
    // 条件が厳しい方がより早い列車になる
    expect(
      hard.recommendedRoute!.departureAt < easy.recommendedRoute!.departureAt,
    ).toBe(true);
  });

  it("乗換時間が短い経路ではより大きい余裕を要求する", () => {
    const routes = [
      makeTransitRoute({ departure: "04:00", arrival: "05:05", transferMargins: [3] }),
      makeTransitRoute({ departure: "04:40", arrival: "05:45", transferMargins: [3] }),
      makeTransitRoute({ departure: "05:00", arrival: "06:05", transferMargins: [3] }),
    ];
    const tight = selectTrains({ routes, targetArrivalAt: TARGET, context: BASE_CONTEXT });

    const roomy = selectTrains({
      routes: routes.map((route) => ({
        ...route,
        legs: route.legs.map((leg) => ({ ...leg, transferMarginMinutes: 15 })),
      })),
      targetArrivalAt: TARGET,
      context: BASE_CONTEXT,
    });

    expect(tight.requiredSlackMinutes).toBeGreaterThan(roomy.requiredSlackMinutes);
    expect(tight.riskReasons.some((reason) => reason.includes("乗換時間"))).toBe(true);
  });

  it("間に合う列車が1本しかない場合は警告し、リスクを高くする", () => {
    const result = selectTrains({
      routes: [
        makeTransitRoute({ departure: "04:52", arrival: "06:02" }),
        makeTransitRoute({ departure: "05:40", arrival: "06:50" }), // 間に合わない
      ],
      targetArrivalAt: TARGET,
      context: BASE_CONTEXT,
    });

    expect(result.recommendedRoute?.departureAt).toContain("04:52");
    expect(result.latestSafeRoute?.departureAt).toContain("04:52");
    expect(result.riskLevel).toBe("HIGH");
    expect(result.warnings.some((warning) => warning.includes("1本遅れると搭乗が困難"))).toBe(true);
  });
});

describe("始発でも間に合わない場合", () => {
  it("無理な経路を推奨せず、明確に警告する", () => {
    const result = selectTrains({
      routes: [
        makeTransitRoute({ departure: "05:30", arrival: "06:40", isFirstTrain: true }),
        makeTransitRoute({ departure: "06:00", arrival: "07:10" }),
      ],
      targetArrivalAt: TARGET,
      context: BASE_CONTEXT,
    });

    expect(result.status).toBe("first_train_too_late");
    expect(result.riskLevel).toBe("UNAVAILABLE");
    expect(result.recommendedRoute).toBeUndefined();
    expect(result.latestSafeRoute).toBeUndefined();
    expect(
      result.warnings.some((warning) =>
        warning.includes("始発列車では、推奨時刻までに空港へ到着できません"),
      ),
    ).toBe(true);
  });

  it("代替案の案内に、料金を推測した数値を含めない", () => {
    const result = selectTrains({
      routes: [makeTransitRoute({ departure: "06:00", arrival: "07:10", isFirstTrain: true })],
      targetArrivalAt: TARGET,
      context: BASE_CONTEXT,
    });
    const text = result.warnings.join("");
    expect(text).not.toMatch(/\d+\s*円/);
  });
});

describe("経路が取得できない場合", () => {
  it("架空の経路を作らず、取得できないことを伝える", () => {
    const result = selectTrains({ routes: [], targetArrivalAt: TARGET, context: BASE_CONTEXT });
    expect(result.status).toBe("no_routes");
    expect(result.riskLevel).toBe("UNAVAILABLE");
    expect(result.recommendedRoute).toBeUndefined();
  });
});

describe("始発列車", () => {
  it("推奨が始発なら、それ以上早い手段が無いことを警告する", () => {
    const result = selectTrains({
      routes: [
        makeTransitRoute({ departure: "04:31", arrival: "05:20", isFirstTrain: true }),
        makeTransitRoute({ departure: "04:52", arrival: "06:02" }),
      ],
      targetArrivalAt: TARGET,
      context: BASE_CONTEXT,
    });
    expect(result.recommendedRoute?.isFirstTrain).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("始発"))).toBe(true);
  });
});
