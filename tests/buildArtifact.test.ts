/**
 * 静的ビルド成果物（out/）に APIキーが含まれていないことを検証する。
 *
 * GitHub Pages に置かれるファイルは誰でも読めるため、キーが混入していないことを
 * 機械的に確認する。`out/` が無い場合（ビルド前）はスキップし、CI では
 * build の後に実行する。
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const OUT_DIR = path.resolve(__dirname, "../out");

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collectFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

/** 成果物に現れてはいけないパターン。 */
const FORBIDDEN_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  // 秘密の環境変数名がバンドルに残っていないこと
  { name: "SERPAPI_API_KEY", pattern: /SERPAPI_API_KEY/ },
  { name: "GOOGLE_MAPS_API_KEY", pattern: /GOOGLE_MAPS_API_KEY/ },
  // Google の APIキー形式（AIza...）
  { name: "Google APIキー形式", pattern: /AIza[0-9A-Za-z_-]{20,}/ },
  // SerpApi のキーは64桁の16進。誤検出を避けるため語境界つきで探す
  { name: "SerpApiキー形式", pattern: /\bserpapi[^\n]{0,40}[0-9a-f]{64}\b/i },
  // 外部APIを直接呼んでいないこと（キーが必要になるため）
  { name: "serpapi.com への直接アクセス", pattern: /serpapi\.com\/search/ },
  { name: "routes.googleapis.com への直接アクセス", pattern: /routes\.googleapis\.com/ },
];

const TEXT_EXTENSIONS = new Set([".js", ".mjs", ".css", ".html", ".json", ".txt", ".map"]);

describe("ビルド成果物にAPIキーが含まれない", () => {
  const hasBuild = existsSync(OUT_DIR);

  it.skipIf(!hasBuild)("out/ の全テキストファイルに禁止パターンが無い", () => {
    const files = collectFiles(OUT_DIR).filter((file) =>
      TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()),
    );
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      for (const { name, pattern } of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(OUT_DIR, file)}: ${name}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it.skipIf(!hasBuild)("公開してよい設定（Worker のURL）だけがバンドルされる", () => {
    // NEXT_PUBLIC_API_BASE_URL は秘密情報ではないため含まれてよい。
    // ここでは「キーらしき長い英数字」が紛れていないことを確認する。
    const files = collectFiles(OUT_DIR).filter((file) => path.extname(file) === ".js");
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      expect(content).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    }
  });
});
