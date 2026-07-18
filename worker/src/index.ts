/**
 * Cloudflare Worker: 航空券・公共交通 API のプロキシ。
 *
 * 役割:
 *  - SerpApi / Google Routes の APIキーをサーバー側に隔離する
 *  - 生レスポンスを DTO へ変換して返す（UI が提供元構造に依存しないように）
 *  - キャッシュとレート制限で無料枠を守る
 *
 * 禁止事項:
 *  - APIキーをレスポンス・ログへ出さない
 *  - 生レスポンスを保存しない
 *  - 本番でデモデータへフォールバックしない（失敗は失敗として返す）
 */

import type {
  BookingOptionsResponse,
  FlightSearchResponse,
  FlightSearchResult,
  RevalidateResult,
  TransitSearchResponse,
} from "../../shared/dto";
import { matchFlight } from "../../shared/serpapiTransform";
import { OFFICIAL_BOOKING_PAGES } from "../../shared/airlineDomains";
import { numberFromEnv, type Env } from "./env";
import {
  checkRateLimit,
  clientKey,
  corsHeaders,
  errorResponse,
  isOriginAllowed,
  json,
  readJsonBody,
} from "./http";
import { flightCacheKey, readCache, transitCacheKey, writeCache } from "./cache";
import { fetchBookingOptions, searchFlights, type UpstreamFailure } from "./serpapi";
import { searchTransit } from "./googleRoutes";
import {
  validateBookingToken,
  validateFlightSearch,
  validateIdentity,
  validateTransitSearch,
} from "./validate";
import { BOARDING_RULES_REFERENCE, TERMINALS_REFERENCE } from "./reference";

/** レート制限（同一クライアント / 1分あたり）。 */
const RATE_LIMITS = {
  flightSearch: 5,
  bookingOptions: 10,
  transitSearch: 10,
} as const;
const RATE_WINDOW_SECONDS = 60;

const RATE_LIMIT_MESSAGE = "検索回数が多すぎます。少し時間をおいて再度お試しください";

function failureToResponse(
  failure: UpstreamFailure,
  request: Request,
  env: Env,
  fallbackMessage: string,
): Response {
  if (failure.kind === "notConfigured") {
    return errorResponse(
      "not_configured",
      "APIキーが設定されていません",
      request,
      env,
      503,
    );
  }
  if (failure.kind === "quota") {
    return errorResponse("upstream_quota", failure.message, request, env, 503);
  }
  return errorResponse("upstream_unavailable", failure.message || fallbackMessage, request, env, 502);
}

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (!isOriginAllowed(request, env)) {
      return errorResponse("invalid_request", "許可されていないオリジンです", request, env, 403);
    }

    try {
      switch (`${request.method} ${url.pathname}`) {
        case "GET /api/health":
          return handleHealth(request, env);
        case "GET /api/reference/boarding-rules":
          return json(BOARDING_RULES_REFERENCE, request, env);
        case "GET /api/reference/terminals":
          return json(TERMINALS_REFERENCE, request, env);
        case "POST /api/flights/search":
          return await handleFlightSearch(request, env);
        case "POST /api/flights/revalidate":
          return await handleRevalidate(request, env);
        case "POST /api/flights/booking-options":
          return await handleBookingOptions(request, env);
        case "POST /api/transit/search":
          return await handleTransitSearch(request, env);
        default:
          return errorResponse("invalid_request", "エンドポイントが存在しません", request, env, 404);
      }
    } catch (error) {
      // 内部エラーの詳細は返さない（秘密情報の漏洩防止）
      const message = error instanceof Error ? error.message : "unknown";
      if (message === "body-too-large") {
        return errorResponse("invalid_request", "リクエストが大きすぎます", request, env, 413);
      }
      if (message === "invalid-json") {
        return errorResponse("invalid_request", "リクエスト形式が不正です", request, env, 400);
      }
      return errorResponse("internal", "内部エラーが発生しました", request, env, 500);
    }
  },
};

function handleHealth(request: Request, env: Env): Response {
  // キーの有無だけを返す。値は返さない。
  return json(
    {
      status: "ok",
      flightProviderConfigured: Boolean(env.SERPAPI_API_KEY),
      transitProviderConfigured: Boolean(env.GOOGLE_MAPS_API_KEY),
      supportedRoutes: ["NRT-KIX", "KIX-NRT"],
      time: new Date().toISOString(),
    },
    request,
    env,
  );
}

async function handleFlightSearch(request: Request, env: Env): Promise<Response> {
  const limit = checkRateLimit(
    clientKey(request, "flights"),
    RATE_LIMITS.flightSearch,
    RATE_WINDOW_SECONDS,
  );
  if (!limit.allowed) {
    return errorResponse("rate_limited", RATE_LIMIT_MESSAGE, request, env, 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const body = await readJsonBody(request);
  const validated = validateFlightSearch(body);
  if (!validated.ok) {
    return errorResponse("invalid_request", validated.reason, request, env, 400);
  }
  const input = validated.value;

  const cacheKey = flightCacheKey({
    origin: input.origin,
    destination: input.destination,
    date: input.date,
    adults: input.adults,
    cabin: "economy",
    directOnly: true,
  });
  const ttl = numberFromEnv(env.FLIGHT_CACHE_TTL_SECONDS, 3600);

  const cached = await readCache<{ flights: FlightSearchResult[]; filteredOutCount: number }>(
    "flights",
    cacheKey,
  );
  if (cached.hit && cached.ageSeconds < ttl) {
    const response: FlightSearchResponse = {
      flights: cached.value.flights,
      filteredOutCount: cached.value.filteredOutCount,
      cache: { isCached: true, cacheAgeSeconds: cached.ageSeconds, fetchedAt: cached.storedAt },
      source: "serpapi-google-flights",
    };
    return json(response, request, env);
  }

  const result = await searchFlights(env, input);
  if (!result.ok) {
    return failureToResponse(
      result.failure,
      request,
      env,
      "航空券検索サービスへ接続できませんでした",
    );
  }

  await writeCache(
    "flights",
    cacheKey,
    { flights: result.flights, filteredOutCount: result.filteredOutCount },
    ttl,
  );

  const response: FlightSearchResponse = {
    flights: result.flights,
    filteredOutCount: result.filteredOutCount,
    cache: { isCached: false, cacheAgeSeconds: 0, fetchedAt: result.fetchedAt },
    source: "serpapi-google-flights",
  };
  return json(response, request, env);
}

/**
 * 予約導線へ進む前の再確認。
 * キャッシュを使わず必ずライブ取得する（価格・在庫の最新確認のため）。
 */
async function handleRevalidate(request: Request, env: Env): Promise<Response> {
  const limit = checkRateLimit(
    clientKey(request, "revalidate"),
    RATE_LIMITS.flightSearch,
    RATE_WINDOW_SECONDS,
  );
  if (!limit.allowed) {
    return errorResponse("rate_limited", RATE_LIMIT_MESSAGE, request, env, 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const body = await readJsonBody(request);
  const record = (body ?? {}) as Record<string, unknown>;

  const search = validateFlightSearch(record.search);
  if (!search.ok) {
    return errorResponse("invalid_request", search.reason, request, env, 400);
  }
  const identity = validateIdentity(record.identity);
  if (!identity.ok) {
    return errorResponse("invalid_request", identity.reason, request, env, 400);
  }
  const previousPriceAmount =
    typeof record.previousPriceAmount === "number" ? record.previousPriceAmount : null;

  const result = await searchFlights(env, search.value);
  if (!result.ok) {
    return failureToResponse(
      result.failure,
      request,
      env,
      "航空券検索サービスへ接続できませんでした",
    );
  }

  const checkedAt = new Date().toISOString();
  const matched = matchFlight(identity.value, result.flights);

  if (!matched) {
    // 便が消えた場合、売り切れか掲載終了かを区別できない。
    // 同一便を確定できない旨を返し、UI 側で再検索を促す。
    const payload: RevalidateResult =
      result.flights.length === 0
        ? { status: "soldOut", checkedAt }
        : {
            status: "notMatched",
            reason: "同じ便を再確認できませんでした。再検索してください",
            checkedAt,
          };
    return json(payload, request, env);
  }

  const currentAmount = matched.price?.amount ?? null;
  if (previousPriceAmount !== null && currentAmount !== null && currentAmount !== previousPriceAmount) {
    const payload: RevalidateResult = {
      status: "priceChanged",
      flight: matched,
      previousAmount: previousPriceAmount,
      currentAmount,
      deltaAmount: currentAmount - previousPriceAmount,
      checkedAt,
    };
    return json(payload, request, env);
  }

  const payload: RevalidateResult = { status: "unchanged", flight: matched, checkedAt };
  return json(payload, request, env);
}

async function handleBookingOptions(request: Request, env: Env): Promise<Response> {
  const limit = checkRateLimit(
    clientKey(request, "booking"),
    RATE_LIMITS.bookingOptions,
    RATE_WINDOW_SECONDS,
  );
  if (!limit.allowed) {
    return errorResponse("rate_limited", RATE_LIMIT_MESSAGE, request, env, 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const body = await readJsonBody(request);
  const record = (body ?? {}) as Record<string, unknown>;

  const token = validateBookingToken(record);
  if (!token.ok) {
    return errorResponse("invalid_request", token.reason, request, env, 400);
  }
  const search = validateFlightSearch(record.search);
  if (!search.ok) {
    return errorResponse("invalid_request", search.reason, request, env, 400);
  }

  const result = await fetchBookingOptions(env, search.value, token.value);
  if (!result.ok) {
    return failureToResponse(result.failure, request, env, "予約オプションを取得できませんでした");
  }

  const response: BookingOptionsResponse = {
    options: result.options,
    fetchedAt: result.fetchedAt,
    unavailableReason:
      result.options.length === 0
        ? "この便の購入オプションを取得できませんでした。航空会社の公式ページで確認してください"
        : null,
  };
  return json(response, request, env);
}

async function handleTransitSearch(request: Request, env: Env): Promise<Response> {
  const limit = checkRateLimit(
    clientKey(request, "transit"),
    RATE_LIMITS.transitSearch,
    RATE_WINDOW_SECONDS,
  );
  if (!limit.allowed) {
    return errorResponse("rate_limited", RATE_LIMIT_MESSAGE, request, env, 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const body = await readJsonBody(request);
  const validated = validateTransitSearch(body);
  if (!validated.ok) {
    return errorResponse("invalid_request", validated.reason, request, env, 400);
  }
  const input = validated.value;

  const cacheKey = transitCacheKey(input);
  const ttl = numberFromEnv(env.TRANSIT_CACHE_TTL_SECONDS, 86400);

  const cached = await readCache<TransitSearchResponse["availability"]>("transit", cacheKey);
  if (cached.hit && cached.ageSeconds < ttl) {
    const response: TransitSearchResponse = {
      availability: cached.value,
      cache: { isCached: true, cacheAgeSeconds: cached.ageSeconds, fetchedAt: cached.storedAt },
      source: "google-routes",
    };
    return json(response, request, env);
  }

  const result = await searchTransit(env, {
    originStationCode: input.originStationCode as never,
    destinationStationCode: input.destinationStationCode as never,
    arriveBy: input.arriveBy,
  });

  if (!result.ok && result.kind === "failure") {
    return failureToResponse(result.failure, request, env, "公共交通経路を取得できませんでした");
  }

  const availability: TransitSearchResponse["availability"] =
    result.ok === true
      ? { kind: "available", routes: result.routes }
      : { kind: "scheduleUnavailable", reason: result.reason };

  // ダイヤ未取得もキャッシュする（同じ日に何度も問い合わせないため）
  await writeCache("transit", cacheKey, availability, ttl);

  const response: TransitSearchResponse = {
    availability,
    cache: {
      isCached: false,
      cacheAgeSeconds: 0,
      fetchedAt: result.ok ? result.fetchedAt : new Date().toISOString(),
    },
    source: "google-routes",
  };
  return json(response, request, env);
}

export default handler;

export { OFFICIAL_BOOKING_PAGES };
