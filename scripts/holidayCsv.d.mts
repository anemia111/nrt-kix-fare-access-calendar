// scripts/holidayCsv.mjs の型定義（テストと型チェックのため）。

export function normalizeHolidayDate(raw: unknown): string | null;

export function parseHolidayCsv(text: string): {
  holidays: Record<string, string>;
  years: number[];
};

export type HolidayFile = {
  _meta?: { hash?: string } & Record<string, unknown>;
  years: number[];
  holidays: Record<string, string>;
};

export type FetchResult =
  | { ok: true; text: string; hash: string; etag?: string | null; lastModified?: string | null }
  | { ok: false; status?: number; error?: string };

export type UpdateDecision =
  | { action: "write"; parsed: { holidays: Record<string, string>; years: number[] } }
  | { action: "no-change"; reason: string }
  | { action: "keep-last-known-good"; reason: string }
  | { action: "initial-required"; reason: string };

export function decideHolidayFileUpdate(
  existing: HolidayFile | null,
  fetchResult: FetchResult,
): UpdateDecision;
