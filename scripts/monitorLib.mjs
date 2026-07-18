/**
 * 公式ページ監視の純粋ロジック（副作用なし）。
 * check-official-sources.mjs とテストの両方から使う。
 */

import { createHash } from "node:crypto";

/**
 * 変更検出用に本文を正規化する。
 *
 * 生HTMLをそのままハッシュすると、リクエストごとに変わる値（CSRFトークン、
 * ナンス、セッションID、埋め込みタイムスタンプなど）だけで「変更あり」と
 * 誤検出してしまう。実際にジェットスターのページは同じ内容でもリクエストごとに
 * ハッシュが変わることを確認したため、**利用者に見える本文**だけを比較する。
 *
 *  - script / style / noscript ブロックを除去
 *  - HTMLコメントを除去
 *  - タグを除去して本文テキストだけ残す
 *  - 長い16進・base64風トークンを除去（保険）
 *  - 空白を正規化
 */
export function normalizeForHash(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[0-9a-f]{16,}/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 正規化した本文のSHA-256ハッシュ。 */
export function hashBody(text) {
  return createHash("sha256").update(normalizeForHash(text)).digest("hex");
}

/**
 * robots.txt を解析する。指定 User-Agent（無ければ *）のグループの
 * Allow / Disallow を取り出す。
 */
export function parseRobots(text) {
  const groups = [];
  let current = null;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const sepIndex = line.indexOf(":");
    if (sepIndex === -1) continue;
    const field = line.slice(0, sepIndex).trim().toLowerCase();
    const value = line.slice(sepIndex + 1).trim();

    if (field === "user-agent") {
      // 直前が rule 行ならグループを切り替える
      if (!current || current.hasRules) {
        current = { agents: [], rules: [], hasRules: false };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && current) {
      current.hasRules = true;
      current.rules.push({ type: field, path: value });
    }
  }
  return groups;
}

/** 指定 User-Agent に適用されるルールを選ぶ（一致が無ければ * を使う）。 */
function rulesForAgent(groups, userAgent) {
  const ua = userAgent.toLowerCase();
  const specific = groups.find((group) =>
    group.agents.some((agent) => agent !== "*" && ua.includes(agent)),
  );
  if (specific) return specific.rules;
  const wildcard = groups.find((group) => group.agents.includes("*"));
  return wildcard ? wildcard.rules : [];
}

/**
 * path が許可されているか。最長一致のルールを優先し、同長なら Allow を優先する
 * （RFC 相当の簡易版）。ルールが無ければ許可。
 */
export function isPathAllowed(groups, userAgent, path) {
  const rules = rulesForAgent(groups, userAgent);
  let decision = { allowed: true, length: -1 };
  for (const rule of rules) {
    if (rule.path === "") {
      // 空の Disallow は「すべて許可」を意味する
      if (rule.type === "disallow") continue;
    }
    if (path.startsWith(rule.path)) {
      const length = rule.path.length;
      if (
        length > decision.length ||
        (length === decision.length && rule.type === "allow")
      ) {
        decision = { allowed: rule.type === "allow", length };
      }
    }
  }
  return decision.allowed;
}

/**
 * 1件のソースについて、前回状態と今回取得結果を比較して差分を判定する。
 *
 * previous: { hash, etag, lastModified, checkedAt } | undefined
 * current:  { status: "ok"|"fetch-failed"|"skipped-by-robots", hash?, etag?, lastModified?, httpStatus?, checkedAt }
 */
export function diffSource(source, previous, current) {
  if (current.status === "skipped-by-robots") {
    return {
      id: source.id,
      outcome: "skipped",
      keepPrevious: true,
      reason: "robots.txt により取得が許可されていません",
    };
  }
  if (current.status === "fetch-failed") {
    return {
      id: source.id,
      outcome: "fetch-failed",
      keepPrevious: true,
      reason: `取得に失敗しました（${current.httpStatus ?? "no-response"}）。last-known-good を維持します。`,
      needsManualCheck: previous !== undefined,
    };
  }
  // status === "ok"
  if (!previous) {
    return { id: source.id, outcome: "baseline", keepPrevious: false };
  }
  if (previous.hash !== current.hash) {
    return {
      id: source.id,
      outcome: "changed",
      keepPrevious: false,
      report: buildIssueReport(source, previous, current),
    };
  }
  return { id: source.id, outcome: "unchanged", keepPrevious: false };
}

/** 変更検出時の Issue 用レポートを作る。 */
export function buildIssueReport(source, previous, current) {
  const title = `公式情報の変更を検出: ${source.name}`;
  const body = [
    `## ${source.name}`,
    "",
    `- 対象URL: ${source.url}`,
    `- 前回確認日時: ${previous.checkedAt ?? "不明"}`,
    `- 今回確認日時: ${current.checkedAt}`,
    `- 前回ハッシュ: \`${previous.hash ?? "なし"}\``,
    `- 今回ハッシュ: \`${current.hash}\``,
    `- HTTPステータス: ${current.httpStatus ?? "不明"}`,
    `- ETag: ${current.etag ?? "なし"}`,
    `- Last-Modified: ${current.lastModified ?? "なし"}`,
    "",
    "### 手動確認が必要な項目",
    ...(source.manualCheckItems ?? []).map((item) => `- [ ] ${item}`),
    "",
    "> このツールは変更の**検出のみ**を行います。締切時間などの値は自動変更していません。",
    "> 公式ページを確認し、必要なら `src/domain/boardingRules.ts` や",
    "> `src/domain/terminals.ts` の値と `checkedAt` を手動で更新してください。",
  ].join("\n");
  return { title, body };
}

/** 全ソースの差分から、コミット用の新しい状態を作る。 */
export function nextState(previousState, results) {
  const state = { ...previousState };
  for (const { source, current, diff } of results) {
    if (diff.keepPrevious && previousState[source.id]) {
      // last-known-good を維持（checkedAt だけは更新して監視の生存を示す）
      state[source.id] = { ...previousState[source.id], lastCheckedAt: current.checkedAt };
    } else if (current.status === "ok") {
      state[source.id] = {
        hash: current.hash,
        etag: current.etag ?? null,
        lastModified: current.lastModified ?? null,
        checkedAt: current.checkedAt,
        lastCheckedAt: current.checkedAt,
      };
    }
  }
  return state;
}
