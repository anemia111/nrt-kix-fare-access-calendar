import { describe, expect, it } from "vitest";
import {
  mapVehicleType,
  parseDurationSeconds,
  parseFare,
  transformGoogleRoutes,
} from "@shared/routesTransform";
import {
  ROUTES_EMPTY,
  ROUTES_KAMATORI_NRT,
  ROUTES_PARTIAL,
  ROUTES_WALK_ONLY,
  ROUTES_WITH_BUS,
} from "./fixtures/googleRoutes";

const FETCHED_AT = "2026-07-18T10:24:00.000Z";

describe("補助関数", () => {
  it("秒表記を分に直す", () => {
    expect(parseDurationSeconds("5580s")).toBe(93);
    expect(parseDurationSeconds("240s")).toBe(4);
    expect(parseDurationSeconds("bad")).toBeNull();
    expect(parseDurationSeconds(undefined)).toBeNull();
  });

  it("車種を TRAIN / BUS / OTHER に写像する", () => {
    expect(mapVehicleType("HEAVY_RAIL")).toBe("TRAIN");
    expect(mapVehicleType("COMMUTER_TRAIN")).toBe("TRAIN");
    expect(mapVehicleType("SUBWAY")).toBe("TRAIN");
    expect(mapVehicleType("BUS")).toBe("BUS");
    expect(mapVehicleType("FERRY")).toBe("OTHER");
    expect(mapVehicleType(undefined)).toBe("OTHER");
  });

  it("JPY の運賃だけを取り込む（換算しない）", () => {
    expect(parseFare({ currencyCode: "JPY", units: "1340" })).toEqual({
      amount: 1340,
      currency: "JPY",
    });
    expect(parseFare({ currencyCode: "USD", units: "10" })).toBeNull();
    expect(parseFare(undefined)).toBeNull();
  });
});

describe("Google Routes の変換", () => {
  const routes = transformGoogleRoutes(ROUTES_KAMATORI_NRT, FETCHED_AT);

  it("経路を DTO へ変換する", () => {
    expect(routes.length).toBe(2);
    expect(routes[0].source).toBe("google-routes");
    expect(routes[0].fetchedAt).toBe(FETCHED_AT);
  });

  it("出発・到着時刻を乗車区間から取る", () => {
    const first = routes.find((route) => route.departureAt.includes("04:58"));
    expect(first?.departureAt).toBe("2026-08-10T04:58:00+09:00");
    expect(first?.arrivalAt).toBe("2026-08-10T06:05:00+09:00");
  });

  it("乗換回数を乗車区間数-1で数える", () => {
    const twoLegs = routes.find((route) => route.departureAt.includes("04:58"));
    expect(twoLegs?.transfers).toBe(1);
    const direct = routes.find((route) => route.departureAt.includes("05:20"));
    expect(direct?.transfers).toBe(0);
  });

  it("徒歩時間を合計する", () => {
    const withWalk = routes.find((route) => route.departureAt.includes("04:58"));
    // 240s(4分) + 300s(5分)
    expect(withWalk?.walkingMinutes).toBe(9);
  });

  it("徒歩が無ければ null", () => {
    const direct = routes.find((route) => route.departureAt.includes("05:20"));
    expect(direct?.walkingMinutes).toBeNull();
  });

  it("運賃を取り込み、無ければ null（推測しない）", () => {
    const withFare = routes.find((route) => route.departureAt.includes("04:58"));
    expect(withFare?.fare).toEqual({ amount: 1340, currency: "JPY" });
    const noFare = routes.find((route) => route.departureAt.includes("05:20"));
    expect(noFare?.fare).toBeNull();
  });

  it("到着時刻順に並べる", () => {
    const arrivals = routes.map((route) => route.arrivalAt);
    expect(arrivals).toEqual([...arrivals].sort());
  });

  it("区間の種別を保持する", () => {
    const withWalk = routes.find((route) => route.departureAt.includes("04:58"))!;
    const modes = withWalk.legs.map((leg) => leg.mode);
    expect(modes).toContain("WALK");
    expect(modes).toContain("TRAIN");
  });
});

describe("バス区間", () => {
  it("BUS を区別して保持する", () => {
    const routes = transformGoogleRoutes(ROUTES_WITH_BUS, FETCHED_AT);
    const modes = routes[0].legs.map((leg) => leg.mode);
    expect(modes).toContain("BUS");
    expect(routes[0].transfers).toBe(1);
  });
});

describe("欠損データの扱い", () => {
  it("経路0件なら空配列（架空時刻を作らない）", () => {
    expect(transformGoogleRoutes(ROUTES_EMPTY, FETCHED_AT)).toEqual([]);
  });

  it("時刻が欠けた区間は OTHER として残し、推測で埋めない", () => {
    const routes = transformGoogleRoutes(ROUTES_PARTIAL, FETCHED_AT);
    expect(routes.length).toBe(1);
    const other = routes[0].legs.find((leg) => leg.mode === "OTHER");
    expect(other).toBeDefined();
  });

  it("徒歩のみの経路は公共交通経路として扱わない", () => {
    expect(transformGoogleRoutes(ROUTES_WALK_ONLY, FETCHED_AT)).toEqual([]);
  });
});
