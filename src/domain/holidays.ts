/**
 * 日本の国民の祝日。鉄道ダイヤの平日／土休日判定に使う（要件26）。
 *
 * 祝日法の規則（固定日・ハッピーマンデー・振替休日・国民の休日）を計算で再現し、
 * 天文計算が必要な春分の日／秋分の日だけは官報で公表済みの日付を表として持つ。
 * 表の範囲外の年は判定できないため `isHolidayKnown` が false を返し、
 * 呼び出し側は「判定不可」として安全側に倒す。推測で祝日を決めない。
 *
 * 情報源: 内閣府「国民の祝日について」 https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html
 * 最終確認日: 2026-07-17
 */

import { addDays, dayOfWeek, parseJstDate, type JstDate } from "@/lib/time";

export const HOLIDAY_SOURCE_URL = "https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html";
export const HOLIDAY_CHECKED_AT = "2026-07-17";

/** 春分の日・秋分の日は暦要項で公表された日付のみを使う。 */
const EQUINOX_TABLE: Readonly<Record<number, { vernal: number; autumnal: number }>> = {
  2026: { vernal: 20, autumnal: 23 },
  2027: { vernal: 21, autumnal: 23 },
};

export const SUPPORTED_HOLIDAY_YEARS = Object.keys(EQUINOX_TABLE).map(Number);

type FixedHoliday = { month: number; day: number; name: string };

const FIXED_HOLIDAYS: readonly FixedHoliday[] = [
  { month: 1, day: 1, name: "元日" },
  { month: 2, day: 11, name: "建国記念の日" },
  { month: 2, day: 23, name: "天皇誕生日" },
  { month: 4, day: 29, name: "昭和の日" },
  { month: 5, day: 3, name: "憲法記念日" },
  { month: 5, day: 4, name: "みどりの日" },
  { month: 5, day: 5, name: "こどもの日" },
  { month: 8, day: 11, name: "山の日" },
  { month: 11, day: 3, name: "文化の日" },
  { month: 11, day: 23, name: "勤労感謝の日" },
];

type HappyMonday = { month: number; nth: number; name: string };

const HAPPY_MONDAYS: readonly HappyMonday[] = [
  { month: 1, nth: 2, name: "成人の日" },
  { month: 7, nth: 3, name: "海の日" },
  { month: 9, nth: 3, name: "敬老の日" },
  { month: 10, nth: 2, name: "スポーツの日" },
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function nthMondayOf(year: number, month: number, nth: number): JstDate {
  const firstOfMonth: JstDate = `${year}-${pad(month)}-01`;
  const firstDow = dayOfWeek(firstOfMonth);
  // 月曜(1)までの日数
  const offsetToFirstMonday = (1 - firstDow + 7) % 7;
  const day = 1 + offsetToFirstMonday + (nth - 1) * 7;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** その年の「国民の祝日」本体（振替休日・国民の休日を含まない）。 */
function baseHolidaysOf(year: number): Map<JstDate, string> {
  const result = new Map<JstDate, string>();
  const equinox = EQUINOX_TABLE[year];
  if (!equinox) return result;

  for (const holiday of FIXED_HOLIDAYS) {
    result.set(`${year}-${pad(holiday.month)}-${pad(holiday.day)}`, holiday.name);
  }
  for (const holiday of HAPPY_MONDAYS) {
    result.set(nthMondayOf(year, holiday.month, holiday.nth), holiday.name);
  }
  result.set(`${year}-03-${pad(equinox.vernal)}`, "春分の日");
  result.set(`${year}-09-${pad(equinox.autumnal)}`, "秋分の日");
  return result;
}

/** 振替休日と国民の休日を加えた、その年の休日すべて。 */
function allHolidaysOf(year: number): Map<JstDate, string> {
  const holidays = baseHolidaysOf(year);
  if (holidays.size === 0) return holidays;

  // 振替休日: 祝日が日曜のとき、その後の最も近い平日を休日にする。
  for (const date of [...holidays.keys()].sort()) {
    if (dayOfWeek(date) !== 0) continue;
    let candidate = addDays(date, 1);
    while (holidays.has(candidate)) {
      candidate = addDays(candidate, 1);
    }
    holidays.set(candidate, "振替休日");
  }

  // 国民の休日: 前後を祝日に挟まれた平日（日曜・振替休日を除く）。
  for (const date of [...holidays.keys()].sort()) {
    const dayAfterNext = addDays(date, 2);
    if (!holidays.has(dayAfterNext)) continue;
    const between = addDays(date, 1);
    if (holidays.has(between)) continue;
    if (dayOfWeek(between) === 0) continue;
    holidays.set(between, "国民の休日");
  }

  return holidays;
}

const holidayCache = new Map<number, Map<JstDate, string>>();

function holidaysOfYear(year: number): Map<JstDate, string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const computed = allHolidaysOf(year);
  holidayCache.set(year, computed);
  return computed;
}

/** その日付の祝日判定が可能か（春分・秋分の表に年が含まれるか）。 */
export function isHolidayKnown(date: JstDate): boolean {
  const { year } = parseJstDate(date);
  return EQUINOX_TABLE[year] !== undefined;
}

/** 祝日なら名称、そうでなければ null。判定不可の年も null（`isHolidayKnown` で確認すること）。 */
export function holidayNameOf(date: JstDate): string | null {
  const { year } = parseJstDate(date);
  return holidaysOfYear(year).get(date) ?? null;
}

export function isHoliday(date: JstDate): boolean {
  return holidayNameOf(date) !== null;
}

export type DayType = "weekday" | "saturday" | "sunday" | "holiday" | "unknown";

/**
 * ダイヤ選択に使う日種別。祝日は土曜・日曜より優先する。
 * 祝日表の範囲外は "unknown" を返し、呼び出し側で安全側に扱う。
 */
export function dayTypeOf(date: JstDate): DayType {
  if (!isHolidayKnown(date)) return "unknown";
  if (isHoliday(date)) return "holiday";
  const dow = dayOfWeek(date);
  if (dow === 0) return "sunday";
  if (dow === 6) return "saturday";
  return "weekday";
}

/** 鉄道ダイヤの区分。土曜・日曜・祝日は「土休日ダイヤ」。 */
export type TimetableKind = "weekday" | "holiday" | "unknown";

export function timetableKindOf(date: JstDate): TimetableKind {
  const dayType = dayTypeOf(date);
  if (dayType === "unknown") return "unknown";
  return dayType === "weekday" ? "weekday" : "holiday";
}

export const DAY_TYPE_LABELS: Readonly<Record<DayType, string>> = {
  weekday: "平日",
  saturday: "土曜",
  sunday: "日曜",
  holiday: "祝日",
  unknown: "判定不可",
};
