/**
 * 日本時間（JST, UTC+09:00）専用の日付・時刻ユーティリティ。
 *
 * 実行環境のタイムゾーンに依存すると、CI（UTC）と手元（JST）で計算結果が
 * ずれてテストが不安定になる。そのため日付は "YYYY-MM-DD" の文字列、時刻は
 * 「その日の00:00からの経過分」として扱い、曜日判定だけ UTC 基準の Date で行う。
 * 経過分は負値や 1440 以上（前日・翌日へのはみ出し）を許容する。
 */

export const JST_OFFSET = "+09:00";

/** "YYYY-MM-DD" */
export type JstDate = string;
/** ISO8601（例: "2026-07-20T08:15:00+09:00"） */
export type JstDateTime = string;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseJstDate(date: JstDate): { year: number; month: number; day: number } {
  const match = DATE_PATTERN.exec(date);
  if (!match) {
    throw new Error(`日付の形式が不正です: ${date}`);
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function toUtcMillis(date: JstDate): number {
  const { year, month, day } = parseJstDate(date);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMillis(millis: number): JstDate {
  const value = new Date(millis);
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: JstDate, days: number): JstDate {
  return fromUtcMillis(toUtcMillis(date) + days * 86_400_000);
}

export function diffDays(from: JstDate, to: JstDate): number {
  return Math.round((toUtcMillis(to) - toUtcMillis(from)) / 86_400_000);
}

/** 0=日曜, 1=月曜, ... 6=土曜 */
export function dayOfWeek(date: JstDate): number {
  return new Date(toUtcMillis(date)).getUTCDay();
}

/** 現在の JST 日付（"YYYY-MM-DD"）。 */
export function todayInJst(now: Date = new Date()): JstDate {
  return fromUtcMillis(now.getTime() + 9 * 60 * 60 * 1000);
}

/**
 * 経過分を "HH:mm" にする。日をまたぐ場合も 0〜23 時に正規化する。
 * 何日ずれたかを知りたい場合は `dayShiftOfMinutes` を使う。
 */
export function minutesToClock(minutesFromMidnight: number): string {
  const normalized = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** 経過分が基準日から何日ずれるか（-1=前日, 0=当日, 1=翌日）。 */
export function dayShiftOfMinutes(minutesFromMidnight: number): number {
  return Math.floor(minutesFromMidnight / 1440);
}

/** 日付＋経過分から JST の ISO8601 文字列を作る。日跨ぎは日付側で吸収する。 */
export function toJstDateTime(date: JstDate, minutesFromMidnight: number): JstDateTime {
  const shiftedDate = addDays(date, dayShiftOfMinutes(minutesFromMidnight));
  return `${shiftedDate}T${minutesToClock(minutesFromMidnight)}:00${JST_OFFSET}`;
}

/** 表示用: "7月20日" */
export function formatMonthDay(date: JstDate): string {
  const { month, day } = parseJstDate(date);
  return `${month}月${day}日`;
}

/** 表示用: "2026年7月" */
export function formatYearMonth(date: JstDate): string {
  const { year, month } = parseJstDate(date);
  return `${year}年${month}月`;
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function weekdayLabel(date: JstDate): string {
  return WEEKDAY_LABELS[dayOfWeek(date)];
}

/** 分数を "1時間17分" のように表示する。 */
export function formatDuration(minutes: number): string {
  if (minutes < 0) throw new Error(`所要時間が負です: ${minutes}`);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}

/** ISO8601（JST）から "HH:mm" を取り出す。 */
export function clockOfJstDateTime(value: JstDateTime): string {
  const match = /T(\d{2}:\d{2})/.exec(value);
  if (!match) throw new Error(`日時の形式が不正です: ${value}`);
  return match[1];
}

/** ISO8601（JST）から日付部分を取り出す。 */
export function dateOfJstDateTime(value: JstDateTime): JstDate {
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(value);
  if (!match) throw new Error(`日時の形式が不正です: ${value}`);
  return match[1];
}

/**
 * ISO8601（JST）を比較可能な通算分に変換する。
 * 日をまたぐ列車の前後関係を正しく比較するために使う。
 */
export function jstDateTimeToAbsoluteMinutes(value: JstDateTime): number {
  const date = dateOfJstDateTime(value);
  const clock = clockOfJstDateTime(value);
  const [hours, minutes] = clock.split(":").map(Number);
  return diffDays("1970-01-01", date) * 1440 + hours * 60 + minutes;
}

/** 2つの JST 日時の差（分）。to - from。 */
export function diffMinutes(from: JstDateTime, to: JstDateTime): number {
  return jstDateTimeToAbsoluteMinutes(to) - jstDateTimeToAbsoluteMinutes(from);
}

/** 取得時刻の表示用: "07/17 14:32 時点" */
export function formatFetchedAt(value: JstDateTime): string {
  const date = dateOfJstDateTime(value);
  const { month, day } = parseJstDate(date);
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")} ${clockOfJstDateTime(value)} 時点`;
}
