/**
 * 最近の検索条件を LocalStorage へ保存・復元する。
 *
 * 保存するのは検索条件（路線・日付・人数など）だけで、架空の価格や便時刻は
 * 保存しない。React からは useSyncExternalStore の外部ストアとして読み取れるよう、
 * スナップショットをキャッシュし、更新時にイベントを発火する。
 */

import {
  parsePlanConditions,
  serializePlanConditions,
  type PlanSearchConditions,
} from "@/domain/planSearch";

const STORAGE_KEY = "nrt-kix:recent-searches";
const CHANGE_EVENT = "nrt-kix:recent-change";
const MAX_ITEMS = 5;

/** サーバー描画時の安定した空スナップショット。 */
const EMPTY: PlanSearchConditions[] = [];

function available(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function readRaw(): string {
  if (!available()) return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

// getSnapshot は同じ内容なら同じ参照を返す必要がある（React の要求）。
let cache: { raw: string; value: PlanSearchConditions[] } | null = null;

function parseRaw(raw: string): PlanSearchConditions[] {
  if (!raw) return EMPTY;
  try {
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return EMPTY;
    return items
      .filter((item): item is string => typeof item === "string")
      .map((query) => parsePlanConditions(new URLSearchParams(query)))
      .slice(0, MAX_ITEMS);
  } catch {
    return EMPTY;
  }
}

export function getRecentSnapshot(): PlanSearchConditions[] {
  const raw = readRaw();
  if (cache && cache.raw === raw) return cache.value;
  const value = parseRaw(raw);
  cache = { raw, value };
  return value;
}

export function getRecentServerSnapshot(): PlanSearchConditions[] {
  return EMPTY;
}

export function subscribeRecent(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** 後方互換のための同期読み取り（テスト用）。 */
export function loadRecentSearches(): PlanSearchConditions[] {
  return getRecentSnapshot();
}

export function saveRecentSearch(conditions: PlanSearchConditions): void {
  if (!available()) return;
  try {
    const query = serializePlanConditions(conditions);
    const existing = parseRaw(readRaw()).map(serializePlanConditions);
    const next = [query, ...existing.filter((item) => item !== query)].slice(0, MAX_ITEMS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // 外部ストアの購読者へ変更を知らせる
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // 保存失敗は致命的でないため握りつぶす
  }
}

export function clearRecentSearches(): void {
  if (!available()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // noop
  }
}
