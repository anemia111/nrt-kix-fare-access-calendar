import { describe, expect, it } from "vitest";
import {
  clockToMinutes,
  parsePeriodsParam,
  serializePeriods,
  timePeriodOfClock,
  togglePeriod,
  SELECTABLE_TIME_PERIODS,
  TIME_PERIOD_DEFINITIONS,
} from "@/domain/timePeriods";

describe("時間帯の境界値", () => {
  // 要件43で明示されている境界値。ここがずれると最安値の集計対象が変わる。
  it.each([
    ["05:00", "morning"],
    ["10:59", "morning"],
    ["11:00", "daytime"],
    ["16:59", "daytime"],
    ["17:00", "evening"],
    ["23:59", "evening"],
  ])("%s は %s", (clock, expected) => {
    expect(timePeriodOfClock(clock)).toBe(expected);
  });

  it("00:00〜04:59 は late_night として扱う", () => {
    expect(timePeriodOfClock("00:00")).toBe("late_night");
    expect(timePeriodOfClock("04:59")).toBe("late_night");
  });

  it("late_night は選択対象に含めない", () => {
    expect(TIME_PERIOD_DEFINITIONS.late_night.selectable).toBe(false);
    expect(SELECTABLE_TIME_PERIODS).not.toContain("late_night");
  });

  it("時間帯の定義が 0:00〜23:59 を隙間なく覆う", () => {
    for (let minutes = 0; minutes < 1440; minutes += 1) {
      expect(() => timePeriodOfClock(minutesToClock(minutes))).not.toThrow();
    }
  });

  function minutesToClock(minutes: number): string {
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
    const rest = String(minutes % 60).padStart(2, "0");
    return `${hours}:${rest}`;
  }
});

describe("clockToMinutes", () => {
  it("不正な形式を拒否する", () => {
    expect(() => clockToMinutes("8:5")).toThrow();
    expect(() => clockToMinutes("25:00")).toThrow();
    expect(() => clockToMinutes("12:60")).toThrow();
    expect(() => clockToMinutes("")).toThrow();
  });
});

describe("URLクエリの時間帯", () => {
  it("未指定なら全選択にする", () => {
    expect(parsePeriodsParam(null)).toEqual(["morning", "daytime", "evening"]);
    expect(parsePeriodsParam("")).toEqual(["morning", "daytime", "evening"]);
  });

  it("指定された時間帯だけを返す", () => {
    expect(parsePeriodsParam("morning,evening")).toEqual(["morning", "evening"]);
  });

  it("並び順を定義順で安定させる", () => {
    expect(parsePeriodsParam("evening,morning")).toEqual(["morning", "evening"]);
    expect(serializePeriods(["evening", "morning"])).toBe("morning,evening");
  });

  it("不正値は無視し、全て不正なら全選択にフォールバックする", () => {
    expect(parsePeriodsParam("morning,banana")).toEqual(["morning"]);
    expect(parsePeriodsParam("banana")).toEqual(["morning", "daytime", "evening"]);
    // late_night は選択不可なのでフォールバックする
    expect(parsePeriodsParam("late_night")).toEqual(["morning", "daytime", "evening"]);
  });
});

describe("時間帯チップの切り替え", () => {
  it("選択と解除ができる", () => {
    expect(togglePeriod(["morning", "daytime"], "evening")).toEqual([
      "morning",
      "daytime",
      "evening",
    ]);
    expect(togglePeriod(["morning", "daytime"], "daytime")).toEqual(["morning"]);
  });

  it("全未選択にはできない（最後の1つの解除を無視する）", () => {
    expect(togglePeriod(["morning"], "morning")).toEqual(["morning"]);
  });

  it("切り替え後も並び順が定義順になる", () => {
    expect(togglePeriod(["evening"], "morning")).toEqual(["morning", "evening"]);
  });
});
