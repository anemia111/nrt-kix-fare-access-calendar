/**
 * CORS・レスポンス生成・入力検証・レート制限。
 *
 * CORS は GitHub Pages 本番オリジンと localhost に限定する。
 * Referer だけに依存した保護はしない。
 */

import type { ApiErrorBody, ApiErrorCode } from "../../shared/dto";
import { allowedOrigins, type Env } from "./env";

/** リクエストボディの上限（バイト）。過大な入力を早期に拒否する。 */
export const MAX_BODY_BYTES = 8 * 1024;

export function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowed = allowedOrigins(env);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function isOriginAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin");
  // 同一オリジン/サーバー間呼び出し（Origin なし）は許可する
  if (!origin) return true;
  return allowedOrigins(env).includes(origin);
}

export function json(
  body: unknown,
  request: Request,
  env: Env,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request, env),
      ...extraHeaders,
    },
  });
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  request: Request,
  env: Env,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return json(body, request, env, status, extraHeaders);
}

/** ボディを安全に読む（サイズ制限つき）。 */
export async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error("body-too-large");
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new Error("body-too-large");
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("invalid-json");
  }
}

// ---------------------------------------------------------------------------
// レート制限（無料枠のみで動かすため、KV を使わない簡易実装）
// ---------------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };

/**
 * isolate 内メモリのレート制限。
 *
 * 制約: Cloudflare の isolate は複数存在しうるため、これは厳密なグローバル制限
 * ではなく best-effort。無料枠を守るための一次防壁として使う（KV を使えば
 * 厳密にできるが、名前空間の作成が必要になるためここでは採用しない）。
 */
const buckets = new Map<string, Bucket>();

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function checkRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * クライアント識別子。
 * IP が取れない環境で「全員を同一ユーザー扱い」しないよう、
 * IP が無い場合は User-Agent と Accept-Language を混ぜた弱い識別子を使う。
 */
export function clientKey(request: Request, scope: string): string {
  const ip =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    null;
  if (ip) return `${scope}:ip:${ip}`;

  const fingerprint = [
    request.headers.get("User-Agent") ?? "",
    request.headers.get("Accept-Language") ?? "",
  ].join("|");
  return `${scope}:ua:${simpleHash(fingerprint)}`;
}

function simpleHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** テスト用にバケットを消す。 */
export function resetRateLimits(): void {
  buckets.clear();
}

// ---------------------------------------------------------------------------
// タイムアウト付き fetch（外部API呼び出し用）
// ---------------------------------------------------------------------------

export const UPSTREAM_TIMEOUT_MS = 12_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = UPSTREAM_TIMEOUT_MS,
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
