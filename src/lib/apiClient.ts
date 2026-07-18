/**
 * Cloudflare Worker（APIプロキシ）へのクライアント。
 *
 * APIキーはここには存在しない。Worker のURLだけを公開設定として持つ
 * （URL は秘密情報ではないため NEXT_PUBLIC_ でよい）。
 *
 * 本番モードで失敗した場合、デモデータへフォールバックしない。失敗は失敗として返す。
 */

import type {
  ApiErrorCode,
  BookingOptionsResponse,
  FlightIdentity,
  FlightSearchInput,
  FlightSearchResponse,
  RevalidateResult,
  TransitSearchInput,
  TransitSearchResponse,
} from "@shared/dto";

/** Worker のベースURL。未設定なら実データ検索は利用できない。 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export const PROVIDER_NOT_CONFIGURED_MESSAGE = "実価格検索プロバイダーが設定されていません";

export function isLiveSearchConfigured(): boolean {
  return API_BASE_URL.length > 0;
}

export type ApiFailure = {
  readonly code: ApiErrorCode | "network";
  readonly message: string;
};

export type ApiResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: ApiFailure };

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * タイムアウトと呼び出し側の中断をまとめた AbortSignal を作る。
 *
 * `AbortSignal.any` / `AbortSignal.timeout` は Safari / iOS で利用できない場合が
 * あり、そのまま使うと iOS だけ検索が失敗する。互換性のため AbortController で
 * 組み立てる。
 */
function createRequestSignal(externalSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    },
  };
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<ApiResult<T>> {
  if (!isLiveSearchConfigured()) {
    return {
      ok: false,
      failure: { code: "not_configured", message: PROVIDER_NOT_CONFIGURED_MESSAGE },
    };
  }

  const request = createRequestSignal(signal);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: request.signal,
    });
  } catch {
    return {
      ok: false,
      failure: { code: "network", message: "サーバーへ接続できませんでした" },
    };
  } finally {
    request.cleanup();
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return {
      ok: false,
      failure: { code: "internal", message: "応答を解釈できませんでした" },
    };
  }

  if (!response.ok) {
    const record = parsed as { error?: { code?: ApiErrorCode; message?: string } };
    return {
      ok: false,
      failure: {
        code: record?.error?.code ?? "internal",
        message: record?.error?.message ?? "エラーが発生しました",
      },
    };
  }

  return { ok: true, value: parsed as T };
}

export function searchFlights(
  input: FlightSearchInput,
  signal?: AbortSignal,
): Promise<ApiResult<FlightSearchResponse>> {
  return postJson<FlightSearchResponse>("/api/flights/search", input, signal);
}

export function revalidateFlight(
  input: {
    search: FlightSearchInput;
    identity: FlightIdentity;
    previousPriceAmount: number | null;
  },
  signal?: AbortSignal,
): Promise<ApiResult<RevalidateResult>> {
  return postJson<RevalidateResult>("/api/flights/revalidate", input, signal);
}

export function fetchBookingOptions(
  input: { bookingToken: string; search: FlightSearchInput },
  signal?: AbortSignal,
): Promise<ApiResult<BookingOptionsResponse>> {
  return postJson<BookingOptionsResponse>("/api/flights/booking-options", input, signal);
}

export function searchTransit(
  input: TransitSearchInput,
  signal?: AbortSignal,
): Promise<ApiResult<TransitSearchResponse>> {
  return postJson<TransitSearchResponse>("/api/transit/search", input, signal);
}

/** 上流エラーを利用者向けの文言にする。 */
export function describeFailure(failure: ApiFailure, context: "flight" | "transit"): string {
  switch (failure.code) {
    case "rate_limited":
      return "検索回数が多すぎます。少し時間をおいて再度お試しください";
    case "upstream_quota":
      return context === "flight"
        ? "今月のリアルタイム航空券検索上限に達しました。航空会社公式サイトで確認してください"
        : "公共交通経路検索の利用上限に達しました";
    case "not_configured":
      return PROVIDER_NOT_CONFIGURED_MESSAGE;
    case "upstream_unavailable":
    case "network":
      return context === "flight"
        ? "航空券検索サービスへ接続できませんでした"
        : "公共交通経路を取得できませんでした";
    default:
      return failure.message;
  }
}
