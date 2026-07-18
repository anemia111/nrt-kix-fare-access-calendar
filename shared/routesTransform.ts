/**
 * Google Routes API（computeRoutes / TRANSIT）の生レスポンスを DTO へ変換する。
 *
 * 方針:
 *  - 架空の時刻を作らない。取得できない項目は null にする。
 *  - Routes が経路を返さない場合は「ダイヤ未取得」として扱い、勝手に補完しない。
 *  - 運賃は Routes が返す場合のみ採用（JPY 以外は換算しない）。
 */

import type { TransitLeg, TransitRoute } from "./dto";

export type GoogleRoutesRaw = {
  routes?: readonly GoogleRoute[];
  error?: { code?: number; message?: string; status?: string };
};

export type GoogleRoute = {
  duration?: string;
  legs?: readonly GoogleRouteLeg[];
  travelAdvisory?: {
    transitFare?: { currencyCode?: string; units?: string | number; nanos?: number };
  };
};

export type GoogleRouteLeg = {
  duration?: string;
  startLocation?: unknown;
  endLocation?: unknown;
  steps?: readonly GoogleRouteStep[];
};

export type GoogleRouteStep = {
  travelMode?: string;
  staticDuration?: string;
  transitDetails?: {
    stopDetails?: {
      departureStop?: { name?: string };
      arrivalStop?: { name?: string };
      departureTime?: string;
      arrivalTime?: string;
    };
    transitLine?: {
      name?: string;
      nameShort?: string;
      vehicle?: { type?: string };
    };
  };
};

/** "1234s" -> 分（切り上げ）。解釈できなければ null。 */
export function parseDurationSeconds(raw: string | undefined | null): number | null {
  if (typeof raw !== "string") return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(raw.trim());
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds)) return null;
  return Math.round(seconds / 60);
}

/** Google の vehicle type を DTO のモードへ写像する。 */
export function mapVehicleType(vehicleType: string | undefined): "TRAIN" | "BUS" | "OTHER" {
  if (!vehicleType) return "OTHER";
  const type = vehicleType.toUpperCase();
  if (
    type === "BUS" ||
    type === "INTERCITY_BUS" ||
    type === "TROLLEYBUS" ||
    type === "SHARE_TAXI"
  ) {
    return "BUS";
  }
  if (
    type === "RAIL" ||
    type === "METRO_RAIL" ||
    type === "SUBWAY" ||
    type === "TRAM" ||
    type === "MONORAIL" ||
    type === "HEAVY_RAIL" ||
    type === "COMMUTER_TRAIN" ||
    type === "HIGH_SPEED_TRAIN" ||
    type === "LONG_DISTANCE_TRAIN"
  ) {
    return "TRAIN";
  }
  return "OTHER";
}

export type GoogleTransitFare = {
  currencyCode?: string;
  units?: string | number;
  nanos?: number;
};

/** 運賃（units + nanos）を円に直す。JPY 以外は null（換算しない）。 */
export function parseFare(
  fare: GoogleTransitFare | undefined | null,
): { amount: number; currency: "JPY" } | null {
  if (!fare || typeof fare !== "object") return null;
  const record = fare;
  if (record.currencyCode !== "JPY") return null;
  const units =
    typeof record.units === "string"
      ? Number(record.units)
      : typeof record.units === "number"
        ? record.units
        : NaN;
  if (!Number.isFinite(units)) return null;
  const nanos = typeof record.nanos === "number" ? record.nanos : 0;
  const amount = Math.round(units + nanos / 1_000_000_000);
  return amount > 0 ? { amount, currency: "JPY" } : null;
}

function stepsOf(route: GoogleRoute): GoogleRouteStep[] {
  return (route.legs ?? []).flatMap((leg) => [...(leg.steps ?? [])]);
}

/** 1経路を DTO へ変換する。時刻が取れない経路は null（捏造しない）。 */
export function transformRoute(
  route: GoogleRoute,
  index: number,
  fetchedAt: string,
): TransitRoute | null {
  const steps = stepsOf(route);
  const legs: TransitLeg[] = [];
  let walkingMinutes = 0;
  let hasWalking = false;
  let transitCount = 0;
  let firstDepartureAt: string | null = null;
  let lastArrivalAt: string | null = null;

  for (const step of steps) {
    const mode = (step.travelMode ?? "").toUpperCase();

    if (mode === "WALK" || mode === "WALKING") {
      const minutes = parseDurationSeconds(step.staticDuration);
      if (minutes !== null && minutes > 0) {
        walkingMinutes += minutes;
        hasWalking = true;
        legs.push({ mode: "WALK", durationMinutes: minutes });
      }
      continue;
    }

    if (mode === "TRANSIT") {
      const details = step.transitDetails;
      const stops = details?.stopDetails;
      const departureAt = stops?.departureTime;
      const arrivalAt = stops?.arrivalTime;
      const departureStop = stops?.departureStop?.name;
      const arrivalStop = stops?.arrivalStop?.name;

      // 時刻や停留所が欠けている区間は、推測で埋めずスキップせず OTHER にする
      if (!departureAt || !arrivalAt || !departureStop || !arrivalStop) {
        legs.push({ mode: "OTHER", description: "詳細を取得できない区間があります" });
        continue;
      }

      const vehicleMode = mapVehicleType(details?.transitLine?.vehicle?.type);
      const lineName =
        details?.transitLine?.nameShort ?? details?.transitLine?.name ?? null;

      if (vehicleMode === "OTHER") {
        legs.push({ mode: "OTHER", description: lineName ?? "その他の交通機関" });
      } else {
        legs.push({
          mode: vehicleMode,
          lineName,
          departureStop,
          arrivalStop,
          departureAt,
          arrivalAt,
        });
      }

      transitCount += 1;
      if (!firstDepartureAt) firstDepartureAt = departureAt;
      lastArrivalAt = arrivalAt;
      continue;
    }

    legs.push({ mode: "OTHER", description: mode || "不明な移動手段" });
  }

  // 乗車区間が1つも無い（＝徒歩のみ等）経路は公共交通経路として扱わない
  if (!firstDepartureAt || !lastArrivalAt || transitCount === 0) return null;

  const durationMinutes =
    parseDurationSeconds(route.duration) ??
    Math.max(
      0,
      Math.round(
        (new Date(lastArrivalAt).getTime() - new Date(firstDepartureAt).getTime()) / 60000,
      ),
    );

  return {
    id: `google-routes:${index}:${firstDepartureAt}`,
    departureAt: firstDepartureAt,
    arrivalAt: lastArrivalAt,
    durationMinutes,
    // 乗換回数は乗車区間数 - 1
    transfers: Math.max(0, transitCount - 1),
    walkingMinutes: hasWalking ? walkingMinutes : null,
    fare: parseFare(route.travelAdvisory?.transitFare),
    legs,
    source: "google-routes",
    fetchedAt,
  };
}

export function transformGoogleRoutes(
  raw: GoogleRoutesRaw,
  fetchedAt: string,
): TransitRoute[] {
  const routes: TransitRoute[] = [];
  (raw.routes ?? []).forEach((route, index) => {
    const transformed = transformRoute(route, index, fetchedAt);
    if (transformed) routes.push(transformed);
  });
  // 到着時刻順（遅い到着＝ぎりぎり、が後ろに来るよう昇順）
  routes.sort((a, b) => a.arrivalAt.localeCompare(b.arrivalAt));
  return routes;
}
