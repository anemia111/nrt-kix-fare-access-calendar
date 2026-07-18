/**
 * SerpApi Google Flights の生レスポンスを、アプリ独自の DTO へ変換する。
 *
 * ここが「SerpApi の内部構造を UI に漏らさない」境界。純粋関数のみで、
 * fetch などの副作用は持たない（fixture でテストできるようにするため）。
 *
 * 重要な制約:
 *  - Google Flights / SerpApi は**正確な残席数を提供しない**。したがって
 *    `seatAvailability` は `bookable` か `unknown` になり、`exact` は作らない。
 *  - ターミナル情報もレスポンスに含まれないため null にする（公式データ側で補う）。
 *  - 対象航空会社（MM/GK/NH/JL/IJ）以外は除外する。存在しない便は作らない。
 */

import {
  isTargetAirlineCode,
  type AirportCode,
  type FlightIdentity,
  type FlightSearchResult,
  type SeatAvailability,
  type TargetAirlineCode,
} from "./dto";

/** SerpApi のレスポンス（必要な部分だけを緩く型付けする）。 */
export type SerpApiRaw = {
  best_flights?: readonly SerpApiItinerary[];
  other_flights?: readonly SerpApiItinerary[];
  error?: string;
};

export type SerpApiItinerary = {
  flights?: readonly SerpApiSegment[];
  total_duration?: number;
  price?: number;
  booking_token?: string;
  type?: string;
};

export type SerpApiSegment = {
  departure_airport?: { id?: string; name?: string; time?: string };
  arrival_airport?: { id?: string; name?: string; time?: string };
  duration?: number;
  airline?: string;
  flight_number?: string;
  travel_class?: string;
};

export const AIRLINE_NAMES: Readonly<Record<TargetAirlineCode, string>> = {
  MM: "Peach Aviation",
  GK: "ジェットスター・ジャパン",
  NH: "ANA（全日本空輸）",
  JL: "JAL（日本航空）",
  IJ: "SPRING JAPAN",
};

/** "MM 123" -> { code: "MM", number: "MM123" }。判別できなければ null。 */
export function parseFlightNumber(
  raw: string | undefined | null,
): { code: string; number: string } | null {
  if (typeof raw !== "string") return null;
  const match = /^\s*([A-Z0-9]{2})\s*([0-9]{1,4})\s*$/i.exec(raw.trim());
  if (!match) return null;
  const code = match[1].toUpperCase();
  return { code, number: `${code}${match[2]}` };
}

/**
 * SerpApi の時刻 "2026-08-10 07:30" を JST の ISO8601 へ変換する。
 * NRT/KIX はいずれも JST のため +09:00 を付与する。
 */
export function parseSerpTime(raw: string | undefined | null): string | null {
  if (typeof raw !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(raw.trim());
  if (!match) return null;
  return `${match[1]}T${match[2]}:00+09:00`;
}

function isAirportCode(value: unknown): value is AirportCode {
  return value === "NRT" || value === "KIX";
}

export type TransformContext = {
  readonly origin: AirportCode;
  readonly destination: AirportCode;
  readonly fetchedAt: string;
  /** 結果の有効期限（null 可）。 */
  readonly expiresAt: string | null;
};

export type TransformResult = {
  readonly flights: FlightSearchResult[];
  /** 対象航空会社でない・直行便でない等で除外した件数。 */
  readonly filteredOutCount: number;
};

/**
 * 生レスポンス → DTO 配列。
 * 直行便（区間が1つ）かつ対象航空会社のもののみ採用する。
 */
export function transformSerpApiFlights(
  raw: SerpApiRaw,
  context: TransformContext,
): TransformResult {
  const itineraries = [...(raw.best_flights ?? []), ...(raw.other_flights ?? [])];
  const flights: FlightSearchResult[] = [];
  let filteredOutCount = 0;

  for (const itinerary of itineraries) {
    const segments = itinerary.flights ?? [];
    // 直行便のみ（乗り継ぎは対象外）
    if (segments.length !== 1) {
      filteredOutCount += 1;
      continue;
    }
    const segment = segments[0];

    const departureAirport = segment.departure_airport?.id;
    const arrivalAirport = segment.arrival_airport?.id;
    if (!isAirportCode(departureAirport) || !isAirportCode(arrivalAirport)) {
      filteredOutCount += 1;
      continue;
    }
    if (departureAirport !== context.origin || arrivalAirport !== context.destination) {
      filteredOutCount += 1;
      continue;
    }

    const parsedNumber = parseFlightNumber(segment.flight_number);
    const airlineCode = parsedNumber?.code;
    if (!isTargetAirlineCode(airlineCode)) {
      // 対象航空会社以外は表示しない
      filteredOutCount += 1;
      continue;
    }

    const departureAt = parseSerpTime(segment.departure_airport?.time);
    const arrivalAt = parseSerpTime(segment.arrival_airport?.time);
    if (!departureAt || !arrivalAt) {
      filteredOutCount += 1;
      continue;
    }

    const priceAmount =
      typeof itinerary.price === "number" && Number.isFinite(itinerary.price) && itinerary.price > 0
        ? Math.round(itinerary.price)
        : null;

    const durationMinutes =
      typeof segment.duration === "number" && segment.duration > 0
        ? segment.duration
        : typeof itinerary.total_duration === "number" && itinerary.total_duration > 0
          ? itinerary.total_duration
          : null;

    const seatAvailability: SeatAvailability =
      priceAmount === null
        ? {
            kind: "unknown",
            reason: "価格が取得できないため予約可否を判断できません",
          }
        : {
            // Google Flights は残席数を返さないため exact にはしない
            kind: "bookable",
            fetchedAt: context.fetchedAt,
          };

    flights.push({
      id: buildFlightId({
        airlineCode,
        flightNumber: parsedNumber?.number ?? null,
        originAirport: departureAirport,
        destinationAirport: arrivalAirport,
        departureAt,
        arrivalAt,
      }),
      airlineCode,
      airlineName: AIRLINE_NAMES[airlineCode],
      flightNumber: parsedNumber?.number ?? null,
      departure: {
        airport: departureAirport,
        // SerpApi はターミナルを返さないため null（公式データ側で補完する）
        terminal: null,
        scheduledAt: departureAt,
      },
      arrival: {
        airport: arrivalAirport,
        terminal: null,
        scheduledAt: arrivalAt,
      },
      durationMinutes,
      price: priceAmount === null ? null : { amount: priceAmount, currency: "JPY" },
      bookingToken:
        typeof itinerary.booking_token === "string" && itinerary.booking_token.length > 0
          ? itinerary.booking_token
          : null,
      seatAvailability,
      fetchedAt: context.fetchedAt,
      expiresAt: context.expiresAt,
      source: "serpapi-google-flights",
    });
  }

  // 価格の安い順（価格なしは後ろ）、同額なら出発時刻順で安定させる
  flights.sort((a, b) => {
    const priceA = a.price?.amount ?? Number.POSITIVE_INFINITY;
    const priceB = b.price?.amount ?? Number.POSITIVE_INFINITY;
    if (priceA !== priceB) return priceA - priceB;
    return a.departure.scheduledAt.localeCompare(b.departure.scheduledAt);
  });

  return { flights, filteredOutCount };
}

/** 便を一意に表すID（配列インデックスに依存しないため）。 */
export function buildFlightId(identity: FlightIdentity): string {
  return [
    identity.airlineCode,
    identity.flightNumber ?? "NA",
    identity.originAirport,
    identity.destinationAirport,
    identity.departureAt,
    identity.arrivalAt,
  ].join("|");
}

export function identityOf(flight: FlightSearchResult): FlightIdentity {
  return {
    airlineCode: flight.airlineCode,
    flightNumber: flight.flightNumber,
    originAirport: flight.departure.airport,
    destinationAirport: flight.arrival.airport,
    departureAt: flight.departure.scheduledAt,
    arrivalAt: flight.arrival.scheduledAt,
  };
}

/**
 * 同一便の照合。配列インデックスは使わず、複数条件で判定する。
 *
 *  1. 便名が両方あるなら、航空会社＋便名＋空港＋出発時刻で厳密一致
 *  2. 便名が無い場合は、航空会社＋空港＋出発時刻＋到着時刻で照合
 *  3. それでも決まらない場合は null（呼び出し側が「再確認できません」と表示）
 */
export function matchFlight(
  identity: FlightIdentity,
  candidates: readonly FlightSearchResult[],
): FlightSearchResult | null {
  const sameRoute = candidates.filter(
    (candidate) =>
      candidate.airlineCode === identity.airlineCode &&
      candidate.departure.airport === identity.originAirport &&
      candidate.arrival.airport === identity.destinationAirport,
  );

  if (identity.flightNumber) {
    const byNumber = sameRoute.filter(
      (candidate) =>
        candidate.flightNumber === identity.flightNumber &&
        candidate.departure.scheduledAt === identity.departureAt,
    );
    if (byNumber.length === 1) return byNumber[0];
    if (byNumber.length > 1) {
      // 便名と出発時刻が同じものが複数ある場合は到着時刻でさらに絞る
      const exact = byNumber.filter(
        (candidate) => candidate.arrival.scheduledAt === identity.arrivalAt,
      );
      return exact.length === 1 ? exact[0] : null;
    }
  }

  const byTime = sameRoute.filter(
    (candidate) =>
      candidate.departure.scheduledAt === identity.departureAt &&
      candidate.arrival.scheduledAt === identity.arrivalAt,
  );
  return byTime.length === 1 ? byTime[0] : null;
}
