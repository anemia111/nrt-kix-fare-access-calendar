import { describe, expect, it } from "vitest";
import {
  dayTypeOf,
  holidayNameOf,
  isHolidayKnown,
  timetableKindOf,
} from "@/domain/holidays";

describe("祝日判定", () => {
  it("ハッピーマンデーの祝日を正しく計算する", () => {
    expect(holidayNameOf("2026-07-20")).toBe("海の日"); // 7月第3月曜
    expect(holidayNameOf("2026-09-21")).toBe("敬老の日"); // 9月第3月曜
    expect(holidayNameOf("2026-10-12")).toBe("スポーツの日"); // 10月第2月曜
  });

  it("固定日の祝日を判定する", () => {
    expect(holidayNameOf("2026-08-11")).toBe("山の日");
    expect(holidayNameOf("2026-11-03")).toBe("文化の日");
  });

  it("秋分の日を暦要項の日付で判定する", () => {
    expect(holidayNameOf("2026-09-23")).toBe("秋分の日");
  });

  it("敬老の日と秋分の日に挟まれた日を国民の休日として保持する", () => {
    // 2026年は 9/21(敬老の日)・9/23(秋分の日) のため 9/22 が国民の休日。
    // 内閣府CSVはこれを「休日」と表記しているため、その表記をそのまま保持する。
    expect(holidayNameOf("2026-09-22")).toBe("休日");
  });

  it("振替休日を保持する", () => {
    // 内閣府CSVには振替休日も「休日」として含まれる
    expect(holidayNameOf("2026-05-06")).toBe("休日"); // 5/3が日曜のため振替
  });

  it("祝日でない日は null", () => {
    expect(holidayNameOf("2026-07-21")).toBeNull();
    expect(holidayNameOf("2026-07-17")).toBeNull();
  });
});

describe("日種別", () => {
  it("平日・土曜・日曜・祝日を区別する", () => {
    expect(dayTypeOf("2026-07-21")).toBe("weekday"); // 火
    expect(dayTypeOf("2026-07-18")).toBe("saturday");
    expect(dayTypeOf("2026-07-19")).toBe("sunday");
    expect(dayTypeOf("2026-07-20")).toBe("holiday"); // 海の日(月)
  });

  it("祝日は曜日より優先する", () => {
    // 2026-07-20 は月曜だが祝日
    expect(dayTypeOf("2026-07-20")).toBe("holiday");
  });

  it("土曜・日曜・祝日は土休日ダイヤ、平日は平日ダイヤ", () => {
    expect(timetableKindOf("2026-07-21")).toBe("weekday");
    expect(timetableKindOf("2026-07-18")).toBe("holiday");
    expect(timetableKindOf("2026-07-19")).toBe("holiday");
    expect(timetableKindOf("2026-07-20")).toBe("holiday");
  });
});

describe("判定できない年", () => {
  it("春分・秋分の表に無い年は判定不可として扱い、推測しない", () => {
    expect(isHolidayKnown("2026-07-20")).toBe(true);
    expect(isHolidayKnown("2030-07-15")).toBe(false);
    expect(dayTypeOf("2030-07-15")).toBe("unknown");
    expect(timetableKindOf("2030-07-15")).toBe("unknown");
  });
});
