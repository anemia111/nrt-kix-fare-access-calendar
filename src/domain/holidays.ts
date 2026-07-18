/**
 * 日本の国民の祝日。鉄道ダイヤの平日／土休日判定に使う（要件26）。
 *
 * データは内閣府が公開する「国民の祝日」CSVから自動生成した
 * `src/data/holidays.generated.json` を読み込む。CSV には振替休日・
 * 国民の休日も含まれるため、それらもそのまま保持している。生成は
 * `scripts/generate-holidays.mjs`（GitHub Actions で定期実行）が行う。
 *
 * 生成JSONに含まれない年は判定できないため `isHolidayKnown` が false を返し、
 * 呼び出し側は「判定不可（unknown）」として安全側に倒す。**対応外の年を
 * 平日扱いにはしない。** 推測で祝日を決めることもしない。
 *
 * 情報源: 内閣府「国民の祝日について」 https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html
 */

import { dayOfWeek, parseJstDate, type JstDate } from "@/lib/time";
import holidaysData from "@/data/holidays.generated.json";

type HolidaysFile = {
  readonly _meta: {
    readonly generated: boolean;
    readonly note: string;
    readonly sourceUrl: string;
    readonly fetchedAt: string;
    readonly hash: string;
    readonly etag: string | null;
    readonly lastModified: string | null;
  };
  readonly years: readonly number[];
  readonly holidays: Readonly<Record<string, string>>;
};

const data = holidaysData as HolidaysFile;

export const HOLIDAY_SOURCE_URL = data._meta.sourceUrl;
/** 生成JSONの取得日時（最終確認日時に相当）。 */
export const HOLIDAY_FETCHED_AT = data._meta.fetchedAt;
export const HOLIDAY_META = data._meta;

/** 祝日判定が可能な年の一覧（CSVに含まれる年）。 */
export const SUPPORTED_HOLIDAY_YEARS: readonly number[] = data.years;

const supportedYears = new Set(data.years);

/** その日付の祝日判定が可能か（生成JSONに年が含まれるか）。 */
export function isHolidayKnown(date: JstDate): boolean {
  return supportedYears.has(parseJstDate(date).year);
}

/**
 * 祝日なら名称、そうでなければ null。
 * 判定不可の年も null（必ず `isHolidayKnown` で確認すること）。
 */
export function holidayNameOf(date: JstDate): string | null {
  return data.holidays[date] ?? null;
}

export function isHoliday(date: JstDate): boolean {
  return holidayNameOf(date) !== null;
}

export type DayType = "weekday" | "saturday" | "sunday" | "holiday" | "unknown";

/**
 * ダイヤ選択に使う日種別。祝日は土曜・日曜より優先する。
 * 祝日データの範囲外は "unknown" を返し、呼び出し側で安全側に扱う。
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
