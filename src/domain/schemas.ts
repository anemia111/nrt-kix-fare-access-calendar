/**
 * 入力値の検証（要件38・42）。
 *
 * 外部から渡る値（URLクエリ、APIリクエスト）は必ずここで検証してから使う。
 * 対象空港は NRT と KIX、出発駅は鎌取駅と和歌山駅に限定する。
 */

import { z } from "zod";
import { ROUTE_IDS } from "./types";
import { SELECTABLE_TIME_PERIODS } from "./timePeriods";
import { CALENDAR_DAYS } from "./routes";

export const routeIdSchema = z.enum(ROUTE_IDS);

export const airportCodeSchema = z.enum(["NRT", "KIX"]);

/** 出発駅は初期リリースでこの2駅に限定する。 */
export const originStationCodeSchema = z.enum(["KAMATORI", "WAKAYAMA"]);

export const airportStationCodeSchema = z.enum(["NRT-AIRPORT", "NRT-T2BLDG", "KIX-AIRPORT"]);

export const jstDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日付は YYYY-MM-DD 形式で指定してください")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "存在しない日付です");

export const selectableTimePeriodSchema = z.enum(SELECTABLE_TIME_PERIODS);

/** 全未選択は許可しない（要件5）。 */
export const periodsSchema = z
  .array(selectableTimePeriodSchema)
  .min(1, "時間帯は1つ以上選択してください")
  .max(SELECTABLE_TIME_PERIODS.length);

/** 初期リリースは大人1名固定だが、将来の拡張に備えて範囲を検証する。 */
export const adultsSchema = z.number().int().min(1).max(9).default(1);

export const calendarRequestSchema = z.object({
  route: routeIdSchema,
  periods: periodsSchema,
  adults: adultsSchema,
  days: z.number().int().min(1).max(CALENDAR_DAYS).default(CALENDAR_DAYS),
});

export type CalendarRequest = z.infer<typeof calendarRequestSchema>;

export const flightSearchRequestSchema = z.object({
  route: routeIdSchema,
  date: jstDateSchema,
  periods: periodsSchema,
  adults: adultsSchema,
});

export type FlightSearchRequest = z.infer<typeof flightSearchRequestSchema>;

/** デモプロバイダーのオファーID形式。 */
export const offerIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9:_-]+$/, "オファーIDに使用できない文字が含まれています");

export const airportAccessRequestSchema = z.object({
  offerId: offerIdSchema,
  hasCheckedBaggage: z.boolean().default(false),
  usesOnlineCheckIn: z.boolean().default(true),
});

export const transitRequestSchema = z.object({
  origin: originStationCodeSchema,
  destination: airportStationCodeSchema,
  date: jstDateSchema,
  arriveBy: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/),
});

/**
 * URLクエリ（文字列）を検証済みの値に変換する。
 * 不正値は例外にせず既定値へフォールバックし、画面が壊れないようにする。
 */
export function safeParseWithFallback<T>(
  schema: z.ZodType<T>,
  value: unknown,
  fallback: T,
): T {
  const result = schema.safeParse(value);
  return result.success ? result.data : fallback;
}
