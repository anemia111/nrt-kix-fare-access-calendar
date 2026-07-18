/**
 * 空港到着目標を iCalendar(.ics) として書き出す。
 *
 * カレンダーアプリに「この時刻までに空港駅へ」という予定を登録できるようにする。
 * 実データではない値（架空の便時刻など）を含めないこと。ここに渡すのは
 * 公式の搭乗締切から計算した空港到着目標のみ。
 */

import { JST_OFFSET, type JstDateTime } from "./time";

/** ICS のテキスト値をエスケープする。 */
function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** "2026-07-20T06:15:00+09:00" -> "20260720T061500"（TZID付き用のローカル表記）。 */
function toIcsLocal(value: JstDateTime): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) throw new Error(`日時の形式が不正です: ${value}`);
  const [, y, mo, d, h, mi] = match;
  return `${y}${mo}${d}T${h}${mi}00`;
}

export type IcsEventInput = {
  readonly title: string;
  readonly description: string;
  /** 予定の時刻（＝空港到着目標）。JST。 */
  readonly startAt: JstDateTime;
  /** 予定の長さ（分）。既定30分。 */
  readonly durationMinutes?: number;
  readonly location?: string;
  readonly uid?: string;
};

export function buildIcs(event: IcsEventInput): string {
  const start = toIcsLocal(event.startAt);
  const durationMinutes = event.durationMinutes ?? 30;
  const uid =
    event.uid ??
    `${start}-${Math.random().toString(36).slice(2)}@nrt-kix-fare-access-calendar`;
  // JST 固定の VTIMEZONE を同梱し、どの環境でも +09:00 として解釈させる。
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//nrt-kix-fare-access-calendar//JP",
    "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Tokyo",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0900",
    "TZOFFSETTO:+0900",
    "TZNAME:JST",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsLocal(nowJst())}`,
    `DTSTART;TZID=Asia/Tokyo:${start}`,
    `DURATION:PT${durationMinutes}M`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description)}`,
    ...(event.location ? [`LOCATION:${escapeIcs(event.location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // RFC5545 は CRLF 区切り
  return lines.join("\r\n");
}

function nowJst(): JstDateTime {
  const jst = new Date(Date.now() + 9 * 3600_000);
  return `${jst.toISOString().slice(0, 19)}${JST_OFFSET}`;
}

/** ブラウザで ICS をダウンロードさせる。 */
export function downloadIcs(filename: string, icsText: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
