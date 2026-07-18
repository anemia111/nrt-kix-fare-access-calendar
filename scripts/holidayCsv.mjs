/**
 * 内閣府「国民の祝日」CSVの変換ロジック（純粋関数）。
 *
 * 生成スクリプト（generate-holidays.mjs）とテスト（tests/holidayCsv.test.ts）の
 * 両方から使う。ここに副作用（fetch・ファイルI/O）は置かない。
 */

/** "2026/1/1" -> "2026-01-01"。不正なら null。 */
export function normalizeHolidayDate(raw) {
  if (typeof raw !== "string") return null;
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(raw.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * CSV本文を { holidays, years } に変換する。
 * ヘッダー行や不正行は捨てる。振替休日・国民の休日はCSVの表記のまま保持する。
 */
export function parseHolidayCsv(text) {
  const holidays = {};
  const years = new Set();
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [dateRaw, nameRaw] = line.split(",");
    if (!dateRaw || !nameRaw) continue;
    const date = normalizeHolidayDate(dateRaw);
    const name = nameRaw.trim();
    if (!date || !name) continue;
    holidays[date] = name;
    years.add(Number(date.slice(0, 4)));
  }
  return { holidays, years: [...years].sort((a, b) => a - b) };
}

/**
 * 取得結果と既存ファイルから、生成ファイルをどう扱うか決める。
 *
 *  - 取得失敗 → 既存を維持（last-known-good）。既存が無ければ initial-required。
 *  - 解釈0件 → 既存を維持。
 *  - ハッシュ一致 → 更新不要。
 *  - それ以外 → 書き込み。
 */
export function decideHolidayFileUpdate(existing, fetchResult) {
  if (!fetchResult || fetchResult.ok !== true) {
    return existing
      ? { action: "keep-last-known-good", reason: "fetch-failed" }
      : { action: "initial-required", reason: "fetch-failed-no-existing" };
  }
  const parsed = parseHolidayCsv(fetchResult.text);
  if (Object.keys(parsed.holidays).length === 0) {
    return existing
      ? { action: "keep-last-known-good", reason: "empty-parse" }
      : { action: "initial-required", reason: "empty-parse-no-existing" };
  }
  if (existing && existing._meta && existing._meta.hash === fetchResult.hash) {
    return { action: "no-change", reason: "hash-match" };
  }
  return { action: "write", parsed };
}
