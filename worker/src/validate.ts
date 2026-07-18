/**
 * 入力検証（Worker 側）。外部から渡る値は必ずここを通す。
 * 対象空港・対象駅を限定し、想定外の値を早期に拒否する。
 */

import type { AirportCode, FlightIdentity, FlightSearchInput } from "../../shared/dto";
import { isTargetAirlineCode } from "../../shared/dto";
import { isAirportStationCode, isOriginStationCode } from "../../shared/stations";

export type Validated<T> = { ok: true; value: T } | { ok: false; reason: string };

function isAirport(value: unknown): value is AirportCode {
  return value === "NRT" || value === "KIX";
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

export function validateFlightSearch(input: unknown): Validated<FlightSearchInput> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, reason: "リクエスト形式が不正です" };
  }
  const record = input as Record<string, unknown>;

  if (!isAirport(record.origin)) return { ok: false, reason: "origin は NRT か KIX です" };
  if (!isAirport(record.destination)) {
    return { ok: false, reason: "destination は NRT か KIX です" };
  }
  if (record.origin === record.destination) {
    return { ok: false, reason: "出発地と到着地が同じです" };
  }
  if (!isIsoDate(record.date)) return { ok: false, reason: "date は YYYY-MM-DD です" };

  const adults = typeof record.adults === "number" ? record.adults : 1;
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) {
    return { ok: false, reason: "adults は 1〜9 です" };
  }

  return {
    ok: true,
    value: {
      origin: record.origin,
      destination: record.destination,
      date: record.date,
      adults,
    },
  };
}

export function validateIdentity(input: unknown): Validated<FlightIdentity> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, reason: "identity が不正です" };
  }
  const record = input as Record<string, unknown>;

  if (!isTargetAirlineCode(record.airlineCode)) {
    return { ok: false, reason: "対象外の航空会社です" };
  }
  if (!isAirport(record.originAirport) || !isAirport(record.destinationAirport)) {
    return { ok: false, reason: "空港コードが不正です" };
  }
  if (!isIsoDateTime(record.departureAt) || !isIsoDateTime(record.arrivalAt)) {
    return { ok: false, reason: "便の時刻が不正です" };
  }
  const flightNumber =
    typeof record.flightNumber === "string" && record.flightNumber.length <= 10
      ? record.flightNumber
      : null;

  return {
    ok: true,
    value: {
      airlineCode: record.airlineCode,
      flightNumber,
      originAirport: record.originAirport,
      destinationAirport: record.destinationAirport,
      departureAt: record.departureAt,
      arrivalAt: record.arrivalAt,
    },
  };
}

export type TransitRequest = {
  readonly originStationCode: string;
  readonly destinationStationCode: string;
  readonly arriveBy: string;
};

export function validateTransitSearch(input: unknown): Validated<TransitRequest> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, reason: "リクエスト形式が不正です" };
  }
  const record = input as Record<string, unknown>;

  if (!isOriginStationCode(record.originStationCode)) {
    return { ok: false, reason: "対応していない出発駅です" };
  }
  if (!isAirportStationCode(record.destinationStationCode)) {
    return { ok: false, reason: "対応していない到着駅です" };
  }
  if (!isIsoDateTime(record.arriveBy)) {
    return { ok: false, reason: "arriveBy が不正です" };
  }

  return {
    ok: true,
    value: {
      originStationCode: record.originStationCode,
      destinationStationCode: record.destinationStationCode,
      arriveBy: record.arriveBy,
    },
  };
}

export function validateBookingToken(input: unknown): Validated<string> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, reason: "リクエスト形式が不正です" };
  }
  const record = input as Record<string, unknown>;
  const token = record.bookingToken;
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) {
    return { ok: false, reason: "bookingToken が不正です" };
  }
  return { ok: true, value: token };
}
