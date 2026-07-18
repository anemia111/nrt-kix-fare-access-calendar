/**
 * 内閣府が公開する「国民の祝日」CSVから祝日データを生成する。
 *
 *   node scripts/generate-holidays.mjs
 *
 * 生成先: src/data/holidays.generated.json
 *
 * 方針:
 *  - CSV は Shift_JIS のため、正しくデコードする
 *  - CSV には振替休日・国民の休日も行として含まれるため、それらも保持する
 *  - 日付と祝日名を検証し、不正な行は捨てる（変換ロジックは holidayCsv.mjs）
 *  - 取得に失敗した場合、既存ファイルを削除しない（last-known-good を維持）
 *  - 内容に差分がある場合だけ書き込む
 *  - 出典URL・取得日時・本文ハッシュを保持する
 *
 * 終了コード: 0=更新または差分なし / 2=初期生成が必要 / 3=取得失敗でlast-known-good維持 / 1=想定外
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decideHolidayFileUpdate } from "./holidayCsv.mjs";

const SOURCE_URL = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";
const OUT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/data/holidays.generated.json",
);

async function readExisting() {
  try {
    return JSON.parse(await readFile(OUT_PATH, "utf-8"));
  } catch {
    return null;
  }
}

async function fetchCsv() {
  try {
    const response = await fetch(SOURCE_URL, {
      headers: { "User-Agent": "nrt-kix-fare-access-calendar holiday generator" },
    });
    if (!response.ok) return { ok: false, status: response.status };
    const buffer = Buffer.from(await response.arrayBuffer());
    const text = new TextDecoder("shift_jis").decode(buffer);
    return {
      ok: true,
      text,
      hash: createHash("sha256").update(text).digest("hex"),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function main() {
  const existing = await readExisting();
  const fetchResult = await fetchCsv();
  const decision = decideHolidayFileUpdate(existing, fetchResult);

  switch (decision.action) {
    case "no-change":
      console.log("差分なし。ファイルは更新しません。");
      return;
    case "keep-last-known-good":
      console.error(
        `祝日CSVの取得または解釈に失敗しました（${decision.reason}）。既存ファイルを維持します（last-known-good）。`,
      );
      process.exit(3);
      return;
    case "initial-required":
      console.error(
        `祝日CSVを取得できず、既存ファイルもありません（${decision.reason}）。手動での初期生成が必要です。`,
      );
      process.exit(2);
      return;
    case "write": {
      const { parsed } = decision;
      const output = {
        _meta: {
          generated: true,
          note: "内閣府の国民の祝日CSVから自動生成しています。手動で編集しないでください。scripts/generate-holidays.mjs が生成します。",
          sourceUrl: SOURCE_URL,
          fetchedAt: new Date().toISOString(),
          hash: fetchResult.hash,
          etag: fetchResult.etag,
          lastModified: fetchResult.lastModified,
        },
        years: parsed.years,
        holidays: parsed.holidays,
      };
      await mkdir(path.dirname(OUT_PATH), { recursive: true });
      await writeFile(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf-8");
      console.log(
        `holidays.generated.json を更新しました（${Object.keys(parsed.holidays).length}件, ${parsed.years[0]}〜${parsed.years[parsed.years.length - 1]}年）。`,
      );
      return;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
