import { describe, expect, it } from "vitest";
import { MockFlightProvider, compareOffers } from "@/providers/flight/mockFlightProvider";
import {
  MockTransitProvider,
  TIMETABLE_PUBLISHED_DAYS,
} from "@/providers/transit/mockTransitProvider";
import { buildAirportAccess } from "@/services/airportAccess";
import { addDays, clockOfJstDateTime } from "@/lib/time";
import { makeOffer } from "./fixtures";

const TODAY = "2026-07-17";
const FETCHED_AT = "2026-07-17T09:00:00+09:00";

/**
 * デモデータでは一部の日を「運航便なし」にしているため、
 * 便が存在することを前提とするテストでは運航日を明示する。
 */
const FLIGHT_DAY = "2026-07-22"; // 水曜・運航あり
const WEEKDAY = "2026-07-21"; // 火曜
const HOLIDAY = "2026-07-20"; // 海の日

function flightProvider() {
  return new MockFlightProvider(FETCHED_AT);
}

describe("デモ航空券プロバイダー", () => {
  it("デモであることを必ず示す", async () => {
    const provider = flightProvider();
    expect(provider.isDemo).toBe(true);
    const offers = await provider.searchFlights({
      routeId: "NRT-KIX",
      date: FLIGHT_DAY,
      periods: ["morning", "daytime", "evening"],
      adults: 1,
    });
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(offer.source.isDemo).toBe(true);
    }
  });

  it("決定論的で、同じ条件なら同じ結果になる", async () => {
    const a = await flightProvider().searchFlights({
      routeId: "NRT-KIX",
      date: "2026-08-03",
      periods: ["morning"],
      adults: 1,
    });
    const b = await flightProvider().searchFlights({
      routeId: "NRT-KIX",
      date: "2026-08-03",
      periods: ["morning"],
      adults: 1,
    });
    expect(a.map((offer) => offer.totalPriceYen)).toEqual(b.map((offer) => offer.totalPriceYen));
  });

  it("選択中の時間帯の便だけを返す", async () => {
    const offers = await flightProvider().searchFlights({
      routeId: "NRT-KIX",
      date: FLIGHT_DAY,
      periods: ["evening"],
      adults: 1,
    });
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(offer.period).toBe("evening");
    }
  });

  it("両方向の路線を返す", async () => {
    for (const routeId of ["NRT-KIX", "KIX-NRT"] as const) {
      const offers = await flightProvider().searchFlights({
        routeId,
        date: FLIGHT_DAY,
        periods: ["morning", "daytime", "evening"],
        adults: 1,
      });
      expect(offers.length).toBeGreaterThan(0);
      expect(offers.every((offer) => offer.routeId === routeId)).toBe(true);
    }
  });

  it("架空の残席数を生成しない（数値は exact / max_pax のときだけ）", async () => {
    const provider = flightProvider();
    for (let day = 0; day < 60; day += 1) {
      const offers = await provider.searchFlights({
        routeId: "NRT-KIX",
        date: addDays(TODAY, day),
        periods: ["morning", "daytime", "evening"],
        adults: 1,
      });
      for (const offer of offers) {
        const availability = offer.availability;
        if (availability.status === "exact") {
          expect(availability.seatsRemaining).toBeGreaterThan(0);
        } else if (availability.status === "max_pax") {
          expect(availability.maxSearchablePax).toBeGreaterThan(0);
        } else {
          // exact / max_pax 以外の状態は席数を一切持たない
          expect("seatsRemaining" in availability).toBe(false);
          expect("maxSearchablePax" in availability).toBe(false);
        }
      }
    }
  });

  it("料金内訳が既知の場合は合計が総額と一致する", async () => {
    const provider = flightProvider();
    let checked = 0;
    for (let day = 0; day < 30; day += 1) {
      const offers = await provider.searchFlights({
        routeId: "NRT-KIX",
        date: addDays(TODAY, day),
        periods: ["morning", "daytime", "evening"],
        adults: 1,
      });
      for (const offer of offers) {
        if (!offer.fareBreakdown.known || offer.totalPriceYen === null) continue;
        const sum =
          offer.fareBreakdown.baseFareYen +
          offer.fareBreakdown.taxYen +
          offer.fareBreakdown.airportFacilityFeeYen +
          offer.fareBreakdown.mandatoryBookingFeeYen +
          offer.fareBreakdown.paymentFeeYen;
        expect(sum).toBe(offer.totalPriceYen);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("料金内訳が不明な場合は金額を一切持たず、確認を促す", async () => {
    const offers = await flightProvider().searchFlights({
      routeId: "NRT-KIX",
      date: FLIGHT_DAY,
      periods: ["morning", "daytime", "evening"],
      adults: 1,
    });
    const unknown = offers.find((offer) => !offer.fareBreakdown.known);
    expect(unknown).toBeDefined();
    if (!unknown || unknown.fareBreakdown.known) return;
    expect(unknown.fareBreakdown.notes.join()).toContain("料金内訳不明");
    // 内訳の金額プロパティを持たない
    expect("baseFareYen" in unknown.fareBreakdown).toBe(false);
  });

  it("預け荷物と座席指定の料金は取得していないため不明のままにする", async () => {
    const offers = await flightProvider().searchFlights({
      routeId: "NRT-KIX",
      date: FLIGHT_DAY,
      periods: ["morning"],
      adults: 1,
    });
    for (const offer of offers) {
      expect(offer.checkedBaggage.known).toBe(false);
      expect(offer.seatSelection.known).toBe(false);
    }
  });
});

describe("並び順", () => {
  it("手数料込み価格の安い順、同額なら出発時刻順で安定する", () => {
    const a = makeOffer({ id: "a", totalPriceYen: 8000, departureMinutes: 700 });
    const b = makeOffer({ id: "b", totalPriceYen: 8000, departureMinutes: 500 });
    const c = makeOffer({ id: "c", totalPriceYen: 6000, departureMinutes: 900 });
    const sorted = [a, b, c].sort(compareOffers).map((offer) => offer.id);
    expect(sorted).toEqual(["c", "b", "a"]);
  });

  it("価格を取得できない便は最後に並ぶ", () => {
    const withPrice = makeOffer({ id: "with", totalPriceYen: 20000 });
    const without = makeOffer({ id: "without", totalPriceYen: null });
    expect([without, withPrice].sort(compareOffers).map((offer) => offer.id)).toEqual([
      "with",
      "without",
    ]);
  });
});

describe("最安値カレンダー", () => {
  it("90日分を返し、各日に状態を持つ", async () => {
    const fares = await flightProvider().getLowestFareByDate({
      routeId: "NRT-KIX",
      startDate: TODAY,
      days: 90,
      periods: ["morning", "daytime", "evening"],
      adults: 1,
    });
    expect(fares).toHaveLength(90);
    expect(fares[0].date).toBe(TODAY);
    for (const fare of fares) {
      expect(fare.fetchedAt).toBe(FETCHED_AT);
      if (fare.status === "ok") {
        expect(fare.offer).toBeDefined();
        expect(fare.offer!.totalPriceYen).not.toBeNull();
      } else {
        // 表示できない日はオファーを持たず、価格帯も判定しない
        expect(fare.offer).toBeUndefined();
        expect(fare.band).toBe("unknown");
      }
    }
  });

  it("運航便がない日を区別して返す", async () => {
    const fares = await flightProvider().getLowestFareByDate({
      routeId: "NRT-KIX",
      startDate: TODAY,
      days: 90,
      periods: ["morning", "daytime", "evening"],
      adults: 1,
    });
    expect(fares.some((fare) => fare.status === "no_flights")).toBe(true);
  });

  it("時間帯を変えると最安値が再計算される", async () => {
    const all = await flightProvider().getLowestFareByDate({
      routeId: "NRT-KIX",
      startDate: TODAY,
      days: 30,
      periods: ["morning", "daytime", "evening"],
      adults: 1,
    });
    const eveningOnly = await flightProvider().getLowestFareByDate({
      routeId: "NRT-KIX",
      startDate: TODAY,
      days: 30,
      periods: ["evening"],
      adults: 1,
    });

    // 夜だけに絞ると、夜以外が最安だった日では価格が変わる
    const changed = all.some((fare, index) => {
      const other = eveningOnly[index];
      return (
        fare.status === "ok" &&
        other.status === "ok" &&
        fare.offer!.totalPriceYen !== other.offer!.totalPriceYen
      );
    });
    expect(changed).toBe(true);

    for (const fare of eveningOnly) {
      if (fare.status === "ok") expect(fare.offer!.period).toBe("evening");
    }
  });

  it("その日の最安便を選ぶ", async () => {
    const provider = flightProvider();
    const fares = await provider.getLowestFareByDate({
      routeId: "NRT-KIX",
      startDate: FLIGHT_DAY,
      days: 1,
      periods: ["morning", "daytime", "evening"],
      adults: 1,
    });
    const offers = await provider.searchFlights({
      routeId: "NRT-KIX",
      date: FLIGHT_DAY,
      periods: ["morning", "daytime", "evening"],
      adults: 1,
    });
    const bookable = offers.filter(
      (offer) =>
        offer.totalPriceYen !== null &&
        offer.availability.status !== "sold_out" &&
        offer.availability.status !== "unavailable",
    );
    const cheapest = Math.min(...bookable.map((offer) => offer.totalPriceYen!));
    expect(fares[0].offer?.totalPriceYen).toBe(cheapest);
  });

  it("満席・予約不可の便を最安値にしない", async () => {
    const fares = await flightProvider().getLowestFareByDate({
      routeId: "NRT-KIX",
      startDate: TODAY,
      days: 90,
      periods: ["morning", "daytime", "evening"],
      adults: 1,
    });
    for (const fare of fares) {
      if (fare.status !== "ok") continue;
      expect(["sold_out", "unavailable"]).not.toContain(fare.offer!.availability.status);
    }
  });

  it("最安の日にだけ最安バッジが付く", async () => {
    const fares = await flightProvider().getLowestFareByDate({
      routeId: "NRT-KIX",
      startDate: TODAY,
      days: 90,
      periods: ["morning", "daytime", "evening"],
      adults: 1,
    });
    const prices = fares
      .filter((fare) => fare.status === "ok")
      .map((fare) => fare.offer!.totalPriceYen!);
    const minimum = Math.min(...prices);
    expect(fares.filter((fare) => fare.band === "cheapest").length).toBeGreaterThanOrEqual(1);
    for (const fare of fares) {
      if (fare.band === "cheapest") expect(fare.offer!.totalPriceYen).toBe(minimum);
    }
  });
});

describe("価格再検証", () => {
  it("価格変更・売り切れ・変更なしを返し分ける", async () => {
    const provider = flightProvider();
    const statuses = new Set<string>();
    for (let day = 0; day < 60; day += 1) {
      const offers = await provider.searchFlights({
        routeId: "NRT-KIX",
        date: addDays(TODAY, day),
        periods: ["morning", "daytime", "evening"],
        adults: 1,
      });
      for (const offer of offers.slice(0, 2)) {
        const result = await provider.refreshOffer(offer.id);
        statuses.add(result.status);
      }
    }
    expect(statuses.has("price_changed")).toBe(true);
    expect(statuses.has("unavailable")).toBe(true);
    expect(statuses.has("unchanged")).toBe(true);
  });

  it("価格変更では変更前と変更後の両方を返す", async () => {
    const provider = flightProvider();
    for (let day = 0; day < 60; day += 1) {
      const offers = await provider.searchFlights({
        routeId: "NRT-KIX",
        date: addDays(TODAY, day),
        periods: ["morning", "daytime", "evening"],
        adults: 1,
      });
      for (const offer of offers) {
        const result = await provider.refreshOffer(offer.id);
        if (result.status === "price_changed") {
          expect(result.previousPriceYen).not.toBe(result.currentPriceYen);
          expect(result.offer.totalPriceYen).toBe(result.currentPriceYen);
          return;
        }
      }
    }
    throw new Error("価格変更のケースが見つかりませんでした");
  });

  it("存在しない便では not_found を返す", async () => {
    const result = await flightProvider().refreshOffer("demo:NRT-KIX:2026-07-21:XX999");
    expect(result.status).toBe("not_found");
  });

  it("不正な形式のIDを拒否する", async () => {
    for (const id of ["", "garbage", "demo:INVALID:2026-07-21:MM101", "demo:NRT-KIX:bad:MM101"]) {
      const result = await flightProvider().refreshOffer(id);
      expect(result.status).toBe("not_found");
    }
  });

  it("デモプロバイダーは公式の予約ディープリンクを持たないため null を返す", async () => {
    expect(await flightProvider().getBookingUrl()).toBeNull();
  });
});

describe("デモ鉄道プロバイダー", () => {
  const transit = () => new MockTransitProvider(TODAY);

  it("平日と土休日でダイヤが変わる", async () => {
    const weekday = await transit().searchRoutes({
      originStationCode: "KAMATORI",
      destinationStationCode: "NRT-AIRPORT",
      date: WEEKDAY,
      arriveBy: `${WEEKDAY}T09:00:00+09:00`,
    });
    const holiday = await transit().searchRoutes({
      originStationCode: "KAMATORI",
      destinationStationCode: "NRT-AIRPORT",
      date: HOLIDAY,
      arriveBy: `${HOLIDAY}T09:00:00+09:00`,
    });

    expect(weekday.status).toBe("ok");
    expect(holiday.status).toBe("ok");
    if (weekday.status !== "ok" || holiday.status !== "ok") return;
    expect(weekday.timetableKind).toBe("weekday");
    // 祝日は土休日ダイヤ
    expect(holiday.timetableKind).toBe("holiday");
    // 土休日は始発が遅い。日付が違うため時刻部分で比較する。
    expect(clockOfJstDateTime(holiday.routes[0].departureAt)).toBe("05:10");
    expect(clockOfJstDateTime(weekday.routes[0].departureAt)).toBe("04:52");
  });

  it("始発列車に印を付ける", async () => {
    const result = await transit().searchRoutes({
      originStationCode: "WAKAYAMA",
      destinationStationCode: "KIX-AIRPORT",
      date: WEEKDAY,
      arriveBy: `${WEEKDAY}T09:00:00+09:00`,
    });
    if (result.status !== "ok") throw new Error("経路を取得できませんでした");
    expect(result.routes[0].isFirstTrain).toBe(true);
    expect(result.routes.slice(1).every((route) => !route.isFirstTrain)).toBe(true);
  });

  it("成田空港駅は空港第2ビル駅より到着が遅い", async () => {
    const toAirport = await transit().searchRoutes({
      originStationCode: "KAMATORI",
      destinationStationCode: "NRT-AIRPORT",
      date: WEEKDAY,
      arriveBy: `${WEEKDAY}T09:00:00+09:00`,
    });
    const toT2 = await transit().searchRoutes({
      originStationCode: "KAMATORI",
      destinationStationCode: "NRT-T2BLDG",
      date: WEEKDAY,
      arriveBy: `${WEEKDAY}T09:00:00+09:00`,
    });
    if (toAirport.status !== "ok" || toT2.status !== "ok") throw new Error("経路なし");
    expect(toAirport.routes[0].durationMinutes).toBeGreaterThan(toT2.routes[0].durationMinutes);
  });

  it("対象日の時刻表が未公開なら経路を作らない", async () => {
    const result = await transit().searchRoutes({
      originStationCode: "KAMATORI",
      destinationStationCode: "NRT-AIRPORT",
      date: addDays(TODAY, TIMETABLE_PUBLISHED_DAYS + 1),
      arriveBy: "2026-10-01T09:00:00+09:00",
    });
    expect(result.status).toBe("timetable_unpublished");
    expect("routes" in result).toBe(false);
  });

  it("公開期間内なら経路を返す", async () => {
    const result = await transit().searchRoutes({
      originStationCode: "KAMATORI",
      destinationStationCode: "NRT-AIRPORT",
      date: addDays(TODAY, TIMETABLE_PUBLISHED_DAYS),
      arriveBy: "2026-09-15T09:00:00+09:00",
    });
    expect(result.status).toBe("ok");
  });

  it("対応していない駅を拒否する", async () => {
    const result = await transit().searchRoutes({
      originStationCode: "TOKYO",
      destinationStationCode: "NRT-AIRPORT",
      date: WEEKDAY,
      arriveBy: `${WEEKDAY}T09:00:00+09:00`,
    });
    expect(result.status).toBe("error");
  });

  it("運賃を取得できない経路では推測せず null にする", async () => {
    const result = await transit().searchRoutes({
      originStationCode: "KAMATORI",
      destinationStationCode: "NRT-AIRPORT",
      date: WEEKDAY,
      arriveBy: `${WEEKDAY}T23:00:00+09:00`,
    });
    if (result.status !== "ok") throw new Error("経路を取得できませんでした");
    for (const route of result.routes) {
      expect(route.fareYen === null || route.fareYen > 0).toBe(true);
    }
    expect(result.routes.some((route) => route.fareYen === null)).toBe(true);
  });

  it("リアルタイム運行情報を取得できないことを明示する", async () => {
    const provider = transit();
    expect(provider.supportsRealtime).toBe(false);
    const status = await provider.getServiceStatus("KAMATORI", WEEKDAY);
    expect(status.available).toBe(false);
  });
});

describe("空港アクセスの統合", () => {
  const transit = () => new MockTransitProvider(TODAY);

  async function access(offer = makeOffer()) {
    return buildAirportAccess({
      offer,
      hasCheckedBaggage: false,
      usesOnlineCheckIn: true,
      transitProvider: transit(),
      calculatedAt: FETCHED_AT,
    });
  }

  it("成田発では鎌取駅からの経路を返す", async () => {
    const result = await access(makeOffer({ routeId: "NRT-KIX", departureMinutes: 12 * 60 }));
    expect(result.originStationCode).toBe("KAMATORI");
    expect(result.originStationNameJa).toBe("鎌取駅");
  });

  it("関空発では和歌山駅からの経路を返す", async () => {
    const result = await access(
      makeOffer({
        routeId: "KIX-NRT",
        departureMinutes: 14 * 60,
        marketingAirlineCode: "GK",
        operatingAirlineCode: "GK",
      }),
    );
    expect(result.originStationCode).toBe("WAKAYAMA");
    expect(result.destinationStationCode).toBe("KIX-AIRPORT");
  });

  it("Peachは成田空港駅、ジェットスターは空港第2ビル駅を降車駅にする", async () => {
    const peach = await access(
      makeOffer({
        marketingAirlineCode: "MM",
        operatingAirlineCode: "MM",
        departureMinutes: 12 * 60,
      }),
    );
    const jetstar = await access(
      makeOffer({
        marketingAirlineCode: "GK",
        operatingAirlineCode: "GK",
        departureMinutes: 12 * 60,
      }),
    );
    expect(peach.destinationStationCode).toBe("NRT-AIRPORT");
    expect(jetstar.destinationStationCode).toBe("NRT-T2BLDG");
  });

  it("推奨列車は遅くとも乗るべき列車より早い", async () => {
    const result = await access(makeOffer({ departureMinutes: 14 * 60 }));
    expect(result.status).toBe("ok");
    expect(result.recommendedRoute).toBeDefined();
    expect(result.latestSafeRoute).toBeDefined();
    expect(result.recommendedRoute!.departureAt <= result.latestSafeRoute!.departureAt).toBe(true);
  });

  it("早朝便では始発でも間に合わないことを警告する", async () => {
    const result = await access(
      makeOffer({
        marketingAirlineCode: "MM",
        operatingAirlineCode: "MM",
        departureMinutes: 6 * 60,
      }),
    );
    expect(result.status).toBe("first_train_too_late");
    expect(result.riskLevel).toBe("UNAVAILABLE");
    expect(result.recommendedRoute).toBeUndefined();
    expect(result.warnings.join()).toContain("始発列車では、推奨時刻までに空港へ到着できません");
  });

  it("時刻表未公開の日では経路を作らず、その旨を伝える", async () => {
    const result = await access(
      makeOffer({ date: addDays(TODAY, TIMETABLE_PUBLISHED_DAYS + 5), departureMinutes: 12 * 60 }),
    );
    expect(result.status).toBe("timetable_unpublished");
    expect(result.recommendedRoute).toBeUndefined();
    expect(result.warnings.join()).toContain("正式な時刻表はまだ公開されていません");
  });

  it("リアルタイム運行情報がない旨を必ず添える", async () => {
    const result = await access(makeOffer({ departureMinutes: 14 * 60 }));
    expect(result.warnings.join()).toContain("通常ダイヤに基づく計算です");
  });

  it("飛行機の出発時刻が変わると推奨列車も再計算される", async () => {
    const early = await access(makeOffer({ departureMinutes: 12 * 60 }));
    const late = await access(makeOffer({ departureMinutes: 19 * 60 }));
    expect(early.recommendedRoute!.departureAt).not.toBe(late.recommendedRoute!.departureAt);
  });

  it("ターミナルが変わると計算が変わる", async () => {
    // 同じ時刻・同じ空港でも、Peach(第1)とジェットスター(第3)で移動時間が変わる
    const peach = await access(
      makeOffer({
        marketingAirlineCode: "MM",
        operatingAirlineCode: "MM",
        departureMinutes: 14 * 60,
      }),
    );
    const jetstar = await access(
      makeOffer({
        marketingAirlineCode: "GK",
        operatingAirlineCode: "GK",
        departureMinutes: 14 * 60,
      }),
    );
    expect(peach.boarding.terminalTransferMinutes).not.toBe(
      jetstar.boarding.terminalTransferMinutes,
    );
  });

  it("情報源と取得時刻を必ず保持する", async () => {
    const result = await access(makeOffer({ departureMinutes: 14 * 60 }));
    expect(result.boarding.officialSources.length).toBeGreaterThan(0);
    expect(result.timetableSource).toBeTruthy();
    expect(result.fetchedAt).toBeTruthy();
  });
});
