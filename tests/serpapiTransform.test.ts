import { describe, expect, it } from "vitest";
import {
  identityOf,
  matchFlight,
  parseFlightNumber,
  parseSerpTime,
  transformSerpApiFlights,
} from "@shared/serpapiTransform";
import {
  SERPAPI_EMPTY,
  SERPAPI_NRT_KIX,
  SERPAPI_PRICE_DOWN,
  SERPAPI_PRICE_UP,
} from "./fixtures/serpapi";

const CONTEXT = {
  origin: "NRT" as const,
  destination: "KIX" as const,
  fetchedAt: "2026-07-18T10:24:00.000Z",
  expiresAt: null,
};

describe("便名・時刻の解釈", () => {
  it("便名から航空会社コードを取り出す", () => {
    expect(parseFlightNumber("MM 123")).toEqual({ code: "MM", number: "MM123" });
    expect(parseFlightNumber("GK205")).toEqual({ code: "GK", number: "GK205" });
    expect(parseFlightNumber("")).toBeNull();
    expect(parseFlightNumber(undefined)).toBeNull();
    expect(parseFlightNumber("不正")).toBeNull();
  });

  it("SerpApi の時刻を JST の ISO8601 にする", () => {
    expect(parseSerpTime("2026-08-10 07:30")).toBe("2026-08-10T07:30:00+09:00");
    expect(parseSerpTime("bad")).toBeNull();
    expect(parseSerpTime(null)).toBeNull();
  });
});

describe("SerpApi レスポンスの変換", () => {
  const result = transformSerpApiFlights(SERPAPI_NRT_KIX, CONTEXT);

  it("対象航空会社（MM/GK/NH/JL/IJ）だけを残す", () => {
    const codes = result.flights.map((flight) => flight.airlineCode);
    expect(codes).toContain("MM");
    expect(codes).toContain("GK");
    // 対象外の XX は除外される
    expect(codes.every((code) => ["MM", "GK", "NH", "JL", "IJ"].includes(code))).toBe(true);
  });

  it("乗継便と対象外航空会社を除外し、件数を数える", () => {
    // XX999（対象外）と NH乗継（2区間）が除外される
    expect(result.filteredOutCount).toBeGreaterThanOrEqual(2);
  });

  it("価格を JPY として取り込む", () => {
    const peach = result.flights.find((flight) => flight.flightNumber === "MM123");
    expect(peach?.price).toEqual({ amount: 8980, currency: "JPY" });
  });

  it("価格が無い便は price=null にし、推測しない", () => {
    const noPrice = result.flights.find((flight) => flight.flightNumber === "GK209");
    expect(noPrice?.price).toBeNull();
  });

  it("booking_token を保持する", () => {
    const peach = result.flights.find((flight) => flight.flightNumber === "MM123");
    expect(peach?.bookingToken).toBe("token-mm123");
    const noToken = result.flights.find((flight) => flight.flightNumber === "GK209");
    expect(noToken?.bookingToken).toBeNull();
  });

  it("残席数を作らない（exact にしない）", () => {
    for (const flight of result.flights) {
      expect(flight.seatAvailability.kind).not.toBe("exact");
      expect(JSON.stringify(flight.seatAvailability)).not.toContain("remainingSeats");
    }
    const peach = result.flights.find((flight) => flight.flightNumber === "MM123");
    // 価格がある＝予約候補あり
    expect(peach?.seatAvailability.kind).toBe("bookable");
    const noPrice = result.flights.find((flight) => flight.flightNumber === "GK209");
    expect(noPrice?.seatAvailability.kind).toBe("unknown");
  });

  it("ターミナルは SerpApi から取得できないため null にする", () => {
    for (const flight of result.flights) {
      expect(flight.departure.terminal).toBeNull();
      expect(flight.arrival.terminal).toBeNull();
    }
  });

  it("価格の安い順に並べる（価格なしは最後）", () => {
    const amounts = result.flights.map((flight) => flight.price?.amount ?? Infinity);
    const sorted = [...amounts].sort((a, b) => a - b);
    expect(amounts).toEqual(sorted);
  });

  it("出典を明示する", () => {
    for (const flight of result.flights) {
      expect(flight.source).toBe("serpapi-google-flights");
      expect(flight.fetchedAt).toBe(CONTEXT.fetchedAt);
    }
  });

  it("結果0件でも壊れない", () => {
    const empty = transformSerpApiFlights(SERPAPI_EMPTY, CONTEXT);
    expect(empty.flights).toEqual([]);
  });
});

describe("同一便の再照合", () => {
  const { flights } = transformSerpApiFlights(SERPAPI_NRT_KIX, CONTEXT);
  const peach = flights.find((flight) => flight.flightNumber === "MM123")!;

  it("航空会社・便名・空港・時刻で同一便を特定する", () => {
    const { flights: refreshed } = transformSerpApiFlights(SERPAPI_PRICE_UP, CONTEXT);
    const matched = matchFlight(identityOf(peach), refreshed);
    expect(matched?.price?.amount).toBe(10480);
  });

  it("値下がりも同じ仕組みで検出できる", () => {
    const { flights: refreshed } = transformSerpApiFlights(SERPAPI_PRICE_DOWN, CONTEXT);
    const matched = matchFlight(identityOf(peach), refreshed);
    expect(matched?.price?.amount).toBe(7480);
  });

  it("候補に無ければ null（配列インデックスで誤特定しない）", () => {
    const { flights: refreshed } = transformSerpApiFlights(SERPAPI_PRICE_UP, CONTEXT);
    const other = flights.find((flight) => flight.flightNumber === "GK205")!;
    expect(matchFlight(identityOf(other), refreshed)).toBeNull();
  });

  it("出発時刻が違えば別便として扱う", () => {
    const shifted = { ...identityOf(peach), departureAt: "2026-08-10T08:30:00+09:00" };
    const { flights: refreshed } = transformSerpApiFlights(SERPAPI_PRICE_UP, CONTEXT);
    expect(matchFlight(shifted, refreshed)).toBeNull();
  });

  it("便名が無い場合は時刻と航空会社で照合する", () => {
    const withoutNumber = { ...identityOf(peach), flightNumber: null };
    const { flights: refreshed } = transformSerpApiFlights(SERPAPI_PRICE_UP, CONTEXT);
    expect(matchFlight(withoutNumber, refreshed)?.price?.amount).toBe(10480);
  });
});
