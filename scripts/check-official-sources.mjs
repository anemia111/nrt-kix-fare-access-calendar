/**
 * 公式ページの日次監視。
 *
 *   node scripts/check-official-sources.mjs
 *
 * 各対象について:
 *   1. robots.txt を確認し、取得が許可されていないページは対象外にする
 *   2. ETag・Last-Modified・本文ハッシュを取得する
 *   3. 前回値（monitor/sources.state.json）と比較する
 *   4. 変更があればレポート（monitor/report.json）を生成する
 *   5. 取得失敗時は last-known-good を維持する
 *   6. 締切時間などの値は自動変更しない（検出のみ）
 *
 * Issue の作成はワークフロー側（github-script）が report.json を読んで行う。
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MONITORED_SOURCES } from "./monitored-sources.mjs";
import { diffSource, hashBody, isPathAllowed, nextState, parseRobots } from "./monitorLib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_PATH = path.join(ROOT, "monitor", "sources.state.json");
const REPORT_PATH = path.join(ROOT, "monitor", "report.json");

const USER_AGENT =
  "nrt-kix-fare-access-calendar-source-monitor (+https://github.com/anemia111/nrt-kix-fare-access-calendar)";

const FETCH_TIMEOUT_MS = 12_000;

/** タイムアウト付き fetch。応答しないサイトで無限に待たないようにする。 */
function fetchWithTimeout(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf-8"));
  } catch {
    return fallback;
  }
}

const robotsCache = new Map();

async function robotsFor(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let groups = [];
  try {
    const response = await fetchWithTimeout(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (response.ok) {
      groups = parseRobots(await response.text());
    }
    // robots.txt が無い/404 は「すべて許可」（標準的な扱い）
  } catch {
    groups = [];
  }
  robotsCache.set(origin, groups);
  return groups;
}

async function checkOne(source) {
  const checkedAt = new Date().toISOString();
  const url = new URL(source.url);

  const robots = await robotsFor(url.origin);
  if (!isPathAllowed(robots, USER_AGENT, url.pathname)) {
    return { status: "skipped-by-robots", checkedAt };
  }

  try {
    const response = await fetchWithTimeout(source.url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
      return { status: "fetch-failed", httpStatus: response.status, checkedAt };
    }
    const text = await response.text();
    return {
      status: "ok",
      hash: hashBody(text),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      httpStatus: response.status,
      checkedAt,
    };
  } catch (error) {
    return { status: "fetch-failed", httpStatus: `error: ${error.message}`, checkedAt };
  }
}

async function main() {
  const previousState = await readJson(STATE_PATH, {});
  const results = [];
  const changes = [];
  const notices = [];

  for (const source of MONITORED_SOURCES) {
    const current = await checkOne(source);
    const diff = diffSource(source, previousState[source.id], current);
    results.push({ source, current, diff });
    if (diff.outcome === "changed" && diff.report) changes.push(diff.report);
    if (diff.outcome === "fetch-failed" || diff.outcome === "skipped") {
      notices.push(`${source.name}: ${diff.reason}`);
    }
    console.log(`[${diff.outcome}] ${source.name}`);
  }

  const state = nextState(previousState, results);
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf-8");

  const report = {
    generatedAt: new Date().toISOString(),
    hasChanges: changes.length > 0,
    changes,
    notices,
  };
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log(
    `完了: 変更 ${changes.length}件 / 注意 ${notices.length}件。詳細は monitor/report.json。`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
