/**
 * SerpApi Google Flights クライアント。
 *
 * APIキーは Secrets からのみ読み、レスポンスにもログにも含めない。
 * 生レスポンスは保存せず、DTO へ変換して返す。
 */

import type {
  AirportCode,
  FlightSearchResult,
  BookingOption,
} from "../../shared/dto";
import {
  transformSerpApiFlights,
  type SerpApiRaw,
} from "../../shared/serpapiTransform";
import {
  transformBookingOptions,
  type SerpApiBookingRaw,
} from "../../shared/bookingTransform";
import { fetchWithTimeout } from "./http";
import type { Env } from "./env";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

export type UpstreamFailure =
  | { readonly kind: "notConfigured" }
  | { readonly kind: "quota"; readonly message: string }
  | { readonly kind: "unavailable"; readonly message: string };

export type SerpApiSearchOk = {
  readonly ok: true;
  readonly flights: FlightSearchResult[];
  readonly filteredOutCount: number;
  readonly fetchedAt: string;
};

export type SerpApiSearchResult = SerpApiSearchOk | { readonly ok: false; readonly failure: UpstreamFailure };

export type FlightQuery = {
  readonly origin: AirportCode;
  readonly destination: AirportCode;
  readonly date: string;
  readonly adults: number;
};

/** 検索パラメータを組み立てる（Booking Options でも同じ条件が必要）。 */
function baseParams(query: FlightQuery, apiKey: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set("engine", "google_flights");
  params.set("departure_id", query.origin);
  params.set("arrival_id", query.destination);
  params.set("outbound_date", query.date);
  // 1 = Round trip, 2 = One way
  params.set("type", "2");
  params.set("adults", String(query.adults));
  // 1 = Economy
  params.set("travel_class", "1");
  // 1 = Nonstop only（直行便を優先）
  params.set("stops", "1");
  params.set("currency", "JPY");
  params.set("hl", "ja");
  params.set("gl", "jp");
  params.set("api_key", apiKey);
  return params;
}

function classifyFailure(status: number, body: string): UpstreamFailure {
  if (status === 429) {
    return { kind: "quota", message: "航空券検索の利用上限に達しました" };
  }
  // SerpApi は枠切れを 401/403 とメッセージで返すことがある
  if ((status === 401 || status === 403) && /run out|limit|quota/i.test(body)) {
    return { kind: "quota", message: "航空券検索の利用上限に達しました" };
  }
  return { kind: "unavailable", message: `航空券検索サービスへ接続できませんでした (${status})` };
}

export async function searchFlights(
  env: Env,
  query: FlightQuery,
): Promise<SerpApiSearchResult> {
  const apiKey = env.SERPAPI_API_KEY;
  if (!apiKey) {
    return { ok: false, failure: { kind: "notConfigured" } };
  }

  const url = `${SERPAPI_ENDPOINT}?${baseParams(query, apiKey).toString()}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { method: "GET" });
  } catch {
    // タイムアウト・ネットワーク障害。URL（キーを含む）はログへ出さない。
    return {
      ok: false,
      failure: { kind: "unavailable", message: "航空券検索サービスへ接続できませんでした" },
    };
  }

  if (!response.ok) {
    const text = await safeText(response);
    return { ok: false, failure: classifyFailure(response.status, text) };
  }

  let raw: SerpApiRaw;
  try {
    raw = (await response.json()) as SerpApiRaw;
  } catch {
    return {
      ok: false,
      failure: { kind: "unavailable", message: "航空券検索の応答を解釈できませんでした" },
    };
  }

  if (raw.error) {
    // SerpApi は 200 でも error フィールドで枠切れを返すことがある
    const failure = /run out|limit|quota/i.test(raw.error)
      ? ({ kind: "quota", message: "航空券検索の利用上限に達しました" } as const)
      : ({ kind: "unavailable", message: "航空券検索サービスから結果を取得できませんでした" } as const);
    return { ok: false, failure };
  }

  const fetchedAt = new Date().toISOString();
  const { flights, filteredOutCount } = transformSerpApiFlights(raw, {
    origin: query.origin,
    destination: query.destination,
    fetchedAt,
    expiresAt: null,
  });

  return { ok: true, flights, filteredOutCount, fetchedAt };
}

export type BookingOptionsResult =
  | { readonly ok: true; readonly options: BookingOption[]; readonly fetchedAt: string }
  | { readonly ok: false; readonly failure: UpstreamFailure };

export async function fetchBookingOptions(
  env: Env,
  query: FlightQuery,
  bookingToken: string,
): Promise<BookingOptionsResult> {
  const apiKey = env.SERPAPI_API_KEY;
  if (!apiKey) {
    return { ok: false, failure: { kind: "notConfigured" } };
  }

  const params = baseParams(query, apiKey);
  params.set("booking_token", bookingToken);
  const url = `${SERPAPI_ENDPOINT}?${params.toString()}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { method: "GET" });
  } catch {
    return {
      ok: false,
      failure: { kind: "unavailable", message: "予約オプションを取得できませんでした" },
    };
  }

  if (!response.ok) {
    const text = await safeText(response);
    return { ok: false, failure: classifyFailure(response.status, text) };
  }

  let raw: SerpApiBookingRaw;
  try {
    raw = (await response.json()) as SerpApiBookingRaw;
  } catch {
    return {
      ok: false,
      failure: { kind: "unavailable", message: "予約オプションの応答を解釈できませんでした" },
    };
  }

  return {
    ok: true,
    options: transformBookingOptions(raw),
    fetchedAt: new Date().toISOString(),
  };
}

/** エラー本文の読み取り（失敗しても落とさない。キーは含まれない）。 */
async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}
