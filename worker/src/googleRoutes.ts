/**
 * Google Routes API（computeRoutes / TRANSIT）クライアント。
 *
 * APIキーは Secrets からのみ読む。到着時刻指定（arrivalTime）で
 * 「この時刻までに空港へ到着できる経路」を検索する。
 *
 * 経路が返らない場合に架空の時刻を作ることはしない。
 */

import type { TransitRoute } from "../../shared/dto";
import { transformGoogleRoutes, type GoogleRoutesRaw } from "../../shared/routesTransform";
import { STATIONS, type StationCode } from "../../shared/stations";
import { fetchWithTimeout } from "./http";
import type { Env } from "./env";
import type { UpstreamFailure } from "./serpapi";

const ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";

/** 必要なフィールドだけ要求してレスポンス量と課金を抑える。 */
const FIELD_MASK = [
  "routes.duration",
  "routes.travelAdvisory.transitFare",
  "routes.legs.steps.travelMode",
  "routes.legs.steps.staticDuration",
  "routes.legs.steps.transitDetails.stopDetails",
  "routes.legs.steps.transitDetails.transitLine.name",
  "routes.legs.steps.transitDetails.transitLine.nameShort",
  "routes.legs.steps.transitDetails.transitLine.vehicle.type",
].join(",");

export type TransitQuery = {
  readonly originStationCode: StationCode;
  readonly destinationStationCode: StationCode;
  /** この時刻までに到着したい（ISO8601）。 */
  readonly arriveBy: string;
};

export type RoutesResult =
  | { readonly ok: true; readonly routes: TransitRoute[]; readonly fetchedAt: string }
  /** ダイヤが取得できない（遠い将来など）。架空時刻は作らない。 */
  | { readonly ok: false; readonly kind: "scheduleUnavailable"; readonly reason: string }
  | { readonly ok: false; readonly kind: "failure"; readonly failure: UpstreamFailure };

export async function searchTransit(env: Env, query: TransitQuery): Promise<RoutesResult> {
  const apiKey = env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { ok: false, kind: "failure", failure: { kind: "notConfigured" } };
  }

  const origin = STATIONS[query.originStationCode];
  const destination = STATIONS[query.destinationStationCode];
  if (!origin || !destination) {
    return {
      ok: false,
      kind: "failure",
      failure: { kind: "unavailable", message: "対応していない駅が指定されました" },
    };
  }

  const body = {
    origin: { address: origin.address },
    destination: { address: destination.address },
    travelMode: "TRANSIT",
    // 到着時刻指定: この時刻までに着く便を返す
    arrivalTime: new Date(query.arriveBy).toISOString(),
    computeAlternativeRoutes: true,
    transitPreferences: {
      allowedTravelModes: ["TRAIN", "SUBWAY", "RAIL", "BUS"],
      routingPreference: "LESS_WALKING",
    },
    languageCode: "ja",
    regionCode: "JP",
    units: "METRIC",
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(ROUTES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      kind: "failure",
      failure: { kind: "unavailable", message: "公共交通経路を取得できませんでした" },
    };
  }

  if (!response.ok) {
    if (response.status === 429) {
      return {
        ok: false,
        kind: "failure",
        failure: { kind: "quota", message: "公共交通経路検索の利用上限に達しました" },
      };
    }
    return {
      ok: false,
      kind: "failure",
      failure: {
        kind: "unavailable",
        message: `公共交通経路を取得できませんでした (${response.status})`,
      },
    };
  }

  let raw: GoogleRoutesRaw;
  try {
    raw = (await response.json()) as GoogleRoutesRaw;
  } catch {
    return {
      ok: false,
      kind: "failure",
      failure: { kind: "unavailable", message: "公共交通経路の応答を解釈できませんでした" },
    };
  }

  const fetchedAt = new Date().toISOString();
  const routes = transformGoogleRoutes(raw, fetchedAt);

  if (routes.length === 0) {
    // 経路が無い＝その日のダイヤをまだ取得できない、または経路が存在しない。
    // どちらにせよ時刻を捏造しない。
    return {
      ok: false,
      kind: "scheduleUnavailable",
      reason: "この日の公共交通ダイヤはまだ取得できません",
    };
  }

  return { ok: true, routes, fetchedAt };
}
