/**
 * デモ用の航空券プロバイダー。
 *
 * ここが返す価格・空席・料金内訳はすべて架空のデモデータであり、実際の航空券の
 * 情報ではない。`isDemo: true` を必ず持ち回り、画面には常にデモである旨を表示する。
 *
 * 決定論的（日付・路線・便名をシードにする）にしてある。リロードしても同じ結果に
 * なるため、デモだと分かったうえで挙動を確認できる。
 *
 * 注意: 便の構成は実在のダイヤではない。NRT–KIX を実際に直行便で運航しているのは
 * Peach（MM）とジェットスター・ジャパン（GK）のみで、ANA（NH）・JAL（JL）は
 * この路線の国内線を運航していない。LCC と FSC で搭乗締切の計算が変わることと
 * コードシェア便の表示を確認できるようにするため、デモデータにのみ FSC 便を
 * 含めている。この点は README にも明記している。
 */

import { timePeriodOfMinutes, type SelectableTimePeriod } from "@/domain/timePeriods";
import { terminalOfAirline } from "@/domain/terminals";
import type {
  Availability,
  DailyFareStatus,
  DailyLowestFare,
  DataSource,
  FareBreakdown,
  FlightOffer,
  RouteId,
} from "@/domain/types";
import { dayTypeOf } from "@/domain/holidays";
import { createPriceBandCalculator } from "@/lib/priceBand";
import { randomInt, seededRandom } from "@/lib/random";
import { addDays, toJstDateTime, type JstDate, type JstDateTime } from "@/lib/time";
import type {
  AvailabilityResult,
  CalendarSearchInput,
  FlightOfferRefreshResult,
  FlightProvider,
  FlightSearchInput,
} from "./FlightProvider";

const PROVIDER_ID = "demo-flight";
const PROVIDER_NAME_JA = "デモデータ（実際の航空券情報ではありません）";

type DemoFlight = {
  readonly flightNumber: string;
  readonly marketingAirlineCode: string;
  readonly operatingAirlineCode: string;
  readonly departureClockMinutes: number;
  readonly durationMinutes: number;
};

function at(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

/** デモ用の便構成。実在のダイヤではない。 */
const DEMO_TIMETABLE: Readonly<Record<RouteId, readonly DemoFlight[]>> = {
  "NRT-KIX": [
    // 早朝便。鎌取駅の始発でも間に合わないケースを再現するために置いている。
    { flightNumber: "GK201", marketingAirlineCode: "GK", operatingAirlineCode: "GK", departureClockMinutes: at(6, 10), durationMinutes: 95 },
    { flightNumber: "MM101", marketingAirlineCode: "MM", operatingAirlineCode: "MM", departureClockMinutes: at(8, 15), durationMinutes: 100 },
    { flightNumber: "JL231", marketingAirlineCode: "JL", operatingAirlineCode: "JL", departureClockMinutes: at(9, 0), durationMinutes: 90 },
    { flightNumber: "GK203", marketingAirlineCode: "GK", operatingAirlineCode: "GK", departureClockMinutes: at(10, 30), durationMinutes: 95 },
    { flightNumber: "MM103", marketingAirlineCode: "MM", operatingAirlineCode: "MM", departureClockMinutes: at(12, 40), durationMinutes: 100 },
    { flightNumber: "GK205", marketingAirlineCode: "GK", operatingAirlineCode: "GK", departureClockMinutes: at(15, 20), durationMinutes: 95 },
    // 同一便をジェットスターが運航し、JALが販売するコードシェアのデモ。
    { flightNumber: "GK207", marketingAirlineCode: "GK", operatingAirlineCode: "GK", departureClockMinutes: at(17, 35), durationMinutes: 95 },
    { flightNumber: "JL8801", marketingAirlineCode: "JL", operatingAirlineCode: "GK", departureClockMinutes: at(17, 35), durationMinutes: 95 },
    { flightNumber: "MM105", marketingAirlineCode: "MM", operatingAirlineCode: "MM", departureClockMinutes: at(19, 10), durationMinutes: 100 },
    { flightNumber: "NH987", marketingAirlineCode: "NH", operatingAirlineCode: "NH", departureClockMinutes: at(21, 0), durationMinutes: 90 },
  ],
  "KIX-NRT": [
    // 早朝便。関空第2ターミナル（Peach）は連絡バス移動が必要なため、
    // 和歌山駅の始発でも間に合わないケースになる。
    { flightNumber: "MM102", marketingAirlineCode: "MM", operatingAirlineCode: "MM", departureClockMinutes: at(6, 45), durationMinutes: 100 },
    { flightNumber: "GK202", marketingAirlineCode: "GK", operatingAirlineCode: "GK", departureClockMinutes: at(8, 0), durationMinutes: 95 },
    { flightNumber: "MM104", marketingAirlineCode: "MM", operatingAirlineCode: "MM", departureClockMinutes: at(11, 20), durationMinutes: 100 },
    { flightNumber: "JL232", marketingAirlineCode: "JL", operatingAirlineCode: "JL", departureClockMinutes: at(13, 10), durationMinutes: 90 },
    { flightNumber: "GK204", marketingAirlineCode: "GK", operatingAirlineCode: "GK", departureClockMinutes: at(14, 40), durationMinutes: 95 },
    { flightNumber: "MM106", marketingAirlineCode: "MM", operatingAirlineCode: "MM", departureClockMinutes: at(17, 50), durationMinutes: 100 },
    { flightNumber: "NH988", marketingAirlineCode: "NH", operatingAirlineCode: "NH", departureClockMinutes: at(19, 30), durationMinutes: 90 },
    { flightNumber: "GK206", marketingAirlineCode: "GK", operatingAirlineCode: "GK", departureClockMinutes: at(20, 25), durationMinutes: 95 },
  ],
};

const BASE_PRICE_YEN: Readonly<Record<string, number>> = {
  MM: 6500,
  GK: 6000,
  JL: 14000,
  NH: 15000,
};

export function makeOfferId(routeId: RouteId, date: JstDate, flightNumber: string): string {
  return `demo:${routeId}:${date}:${flightNumber}`;
}

function parseOfferId(
  offerId: string,
): { routeId: RouteId; date: JstDate; flightNumber: string } | null {
  const parts = offerId.split(":");
  if (parts.length !== 4 || parts[0] !== "demo") return null;
  const [, routeId, date, flightNumber] = parts;
  if (routeId !== "NRT-KIX" && routeId !== "KIX-NRT") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { routeId, date, flightNumber };
}

function dataSource(fetchedAt: JstDateTime): DataSource {
  return {
    providerId: PROVIDER_ID,
    providerNameJa: PROVIDER_NAME_JA,
    isDemo: true,
    fetchedAt,
  };
}

/** その日にその路線の便が運航されているか（デモ用に一部の日を運休にする）。 */
function hasFlightsOn(routeId: RouteId, date: JstDate): boolean {
  const random = seededRandom(`no-flights:${routeId}:${date}`);
  return random() > 0.03;
}

function buildFareBreakdown(
  airlineCode: string,
  totalPriceYen: number,
  random: () => number,
): FareBreakdown {
  // FSC のデモ便と、一部の LCC 便では「総額のみ取得可能」を再現する。
  // 実際の API でも内訳を返さないことがあり、その場合は推測してはいけない。
  const breakdownUnavailable = airlineCode === "JL" || airlineCode === "NH" || random() < 0.15;
  if (breakdownUnavailable) {
    return {
      known: false,
      notes: [
        "総額のみ取得可能",
        "料金内訳不明",
        "決済手数料は公式サイトで確認してください",
        "手荷物料金は含まれていません",
        "座席指定料金は含まれていません",
      ],
    };
  }

  // デモ用の内訳。合計が総額に一致するように組み立てる。
  const airportFacilityFeeYen = 440;
  const paymentFeeYen = 660;
  const mandatoryBookingFeeYen = 0;
  const remainder = totalPriceYen - airportFacilityFeeYen - paymentFeeYen - mandatoryBookingFeeYen;
  const taxYen = Math.round(remainder * 0.05);
  const baseFareYen = remainder - taxYen;

  return {
    known: true,
    baseFareYen,
    taxYen,
    airportFacilityFeeYen,
    mandatoryBookingFeeYen,
    paymentFeeYen,
    paymentMethodNote: "クレジットカード払いを基準にした金額です",
    notes: [
      "手荷物料金は含まれていません",
      "座席指定料金は含まれていません",
    ],
  };
}

function buildAvailability(random: () => number): Availability {
  const roll = random();
  if (roll < 0.07) return { status: "sold_out" };
  if (roll < 0.12) return { status: "exact", seatsRemaining: randomInt(random, 1, 3) };
  if (roll < 0.24) return { status: "few" };
  if (roll < 0.42) return { status: "exact", seatsRemaining: randomInt(random, 4, 9) };
  if (roll < 0.54) return { status: "undisclosed" };
  // API が返すのが実残席数ではなく「一度に予約可能な最大人数」であるケース。
  if (roll < 0.64) return { status: "max_pax", maxSearchablePax: randomInt(random, 2, 6) };
  if (roll < 0.72) return { status: "unknown" };
  if (roll < 0.78) return { status: "recheck" };
  if (roll < 0.82) return { status: "unavailable" };
  return { status: "available" };
}

function buildOffer(
  routeId: RouteId,
  date: JstDate,
  flight: DemoFlight,
  fetchedAt: JstDateTime,
): FlightOffer {
  const random = seededRandom(`offer:${routeId}:${date}:${flight.flightNumber}`);
  const origin = routeId === "NRT-KIX" ? "NRT" : "KIX";
  const destination = routeId === "NRT-KIX" ? "KIX" : "NRT";
  const departureMinutes = flight.departureClockMinutes;
  const period = timePeriodOfMinutes(departureMinutes);

  // 価格: 航空会社の基準額 × 時間帯 × 曜日 × 変動
  const base = BASE_PRICE_YEN[flight.marketingAirlineCode] ?? 9000;
  const periodFactor = period === "evening" ? 1.12 : period === "daytime" ? 0.95 : 1.0;
  const dayType = dayTypeOf(date);
  const dayFactor = dayType === "weekday" ? 1.0 : 1.3;
  const variation = 0.7 + random() * 0.8;
  const rawPrice = base * periodFactor * dayFactor * variation;
  const totalPriceYen = Math.round(rawPrice / 10) * 10;

  // 価格取得エラーを再現する。推測値で埋めず null にする。
  const priceFailed = random() < 0.02;
  const availability = buildAvailability(random);

  return {
    id: makeOfferId(routeId, date, flight.flightNumber),
    routeId,
    date,
    period,
    marketingAirlineCode: flight.marketingAirlineCode,
    operatingAirlineCode: flight.operatingAirlineCode,
    flightNumber: flight.flightNumber,
    isCodeshare: flight.marketingAirlineCode !== flight.operatingAirlineCode,
    originAirport: origin,
    destinationAirport: destination,
    originTerminal: terminalOfAirline(flight.operatingAirlineCode, origin),
    destinationTerminal: terminalOfAirline(flight.operatingAirlineCode, destination),
    departureAt: toJstDateTime(date, departureMinutes),
    arrivalAt: toJstDateTime(date, departureMinutes + flight.durationMinutes),
    departureMinutes,
    durationMinutes: flight.durationMinutes,
    isDirect: true,
    totalPriceYen: priceFailed ? null : totalPriceYen,
    priceErrorReason: priceFailed ? "提供元から価格を取得できませんでした" : undefined,
    fareBreakdown: buildFareBreakdown(
      flight.marketingAirlineCode,
      totalPriceYen,
      seededRandom(`fare:${routeId}:${date}:${flight.flightNumber}`),
    ),
    carryOnBaggage:
      flight.marketingAirlineCode === "MM" || flight.marketingAirlineCode === "GK"
        ? { known: true, description: "合計7kgまで無料（各社の条件に従う）" }
        : { known: true, description: "合計10kgまで無料（各社の条件に従う）" },
    // 預け荷物・座席指定は既定の検索条件（なし）のため料金を取得していない。
    checkedBaggage: { known: false },
    seatSelection: { known: false },
    availability,
    source: dataSource(fetchedAt),
  };
}

/** デモ用に、その日の便を組み立てる。 */
function buildOffersForDate(
  routeId: RouteId,
  date: JstDate,
  fetchedAt: JstDateTime,
): FlightOffer[] {
  if (!hasFlightsOn(routeId, date)) return [];
  return DEMO_TIMETABLE[routeId].map((flight) => buildOffer(routeId, date, flight, fetchedAt));
}

function isBookable(offer: FlightOffer): boolean {
  return offer.availability.status !== "sold_out" && offer.availability.status !== "unavailable";
}

/** 手数料込み価格の安い順。同額のときは出発時刻順で安定させる（要件43）。 */
export function compareOffers(a: FlightOffer, b: FlightOffer): number {
  const priceA = a.totalPriceYen ?? Number.POSITIVE_INFINITY;
  const priceB = b.totalPriceYen ?? Number.POSITIVE_INFINITY;
  if (priceA !== priceB) return priceA - priceB;
  if (a.departureMinutes !== b.departureMinutes) return a.departureMinutes - b.departureMinutes;
  return a.flightNumber.localeCompare(b.flightNumber);
}

function nowJst(): JstDateTime {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const date = jst.toISOString().slice(0, 10);
  const clock = jst.toISOString().slice(11, 16);
  return `${date}T${clock}:00+09:00`;
}

export class MockFlightProvider implements FlightProvider {
  readonly id = PROVIDER_ID;
  readonly nameJa = PROVIDER_NAME_JA;
  readonly isDemo = true;
  readonly supportsPriceRefresh = true;

  private readonly fetchedAt: JstDateTime;

  constructor(fetchedAt: JstDateTime = nowJst()) {
    this.fetchedAt = fetchedAt;
  }

  async searchFlights(input: FlightSearchInput): Promise<FlightOffer[]> {
    const offers = buildOffersForDate(input.routeId, input.date, this.fetchedAt);
    return offers
      .filter((offer) => input.periods.includes(offer.period as SelectableTimePeriod))
      .sort(compareOffers);
  }

  async getLowestFareByDate(input: CalendarSearchInput): Promise<DailyLowestFare[]> {
    const days = Array.from({ length: input.days }, (_, index) =>
      addDays(input.startDate, index),
    );

    const perDay = days.map((date) => {
      const all = buildOffersForDate(input.routeId, date, this.fetchedAt);
      const inPeriod = all.filter((offer) =>
        input.periods.includes(offer.period as SelectableTimePeriod),
      );
      const bookable = inPeriod.filter(isBookable);
      const withPrice = bookable.filter((offer) => offer.totalPriceYen !== null);
      const cheapest = [...withPrice].sort(compareOffers)[0];

      const status = decideStatus({ all, inPeriod, bookable, withPrice });
      return { date, status, offer: cheapest };
    });

    const calculator = createPriceBandCalculator(
      perDay.map((day) => day.offer?.totalPriceYen ?? null),
    );

    return perDay.map(({ date, status, offer }) => ({
      date,
      status,
      offer: status === "ok" ? offer : undefined,
      band: status === "ok" ? calculator.bandOf(offer?.totalPriceYen ?? null) : "unknown",
      fetchedAt: this.fetchedAt,
    }));
  }

  async refreshOffer(offerId: string): Promise<FlightOfferRefreshResult> {
    const parsed = parseOfferId(offerId);
    if (!parsed) return { status: "not_found", offerId };

    const flight = DEMO_TIMETABLE[parsed.routeId].find(
      (candidate) => candidate.flightNumber === parsed.flightNumber,
    );
    if (!flight) return { status: "not_found", offerId };

    const offer = buildOffer(parsed.routeId, parsed.date, flight, nowJst());
    const random = seededRandom(`refresh:${offerId}`);
    const roll = random();

    // デモとして、価格変更・売り切れを再現する。
    if (roll < 0.15) {
      return { status: "unavailable", offerId };
    }
    if (roll < 0.45 && offer.totalPriceYen !== null) {
      const previousPriceYen = offer.totalPriceYen;
      const delta = 1 + (random() * 0.5 - 0.15);
      const currentPriceYen = Math.round((previousPriceYen * delta) / 10) * 10;
      if (currentPriceYen !== previousPriceYen) {
        return {
          status: "price_changed",
          offer: { ...offer, totalPriceYen: currentPriceYen },
          previousPriceYen,
          currentPriceYen,
        };
      }
    }
    return { status: "unchanged", offer };
  }

  async getAvailability(offerId: string): Promise<AvailabilityResult> {
    const parsed = parseOfferId(offerId);
    const fetchedAt = nowJst();
    if (!parsed) {
      return { offerId, availability: { status: "unknown" }, fetchedAt };
    }
    const flight = DEMO_TIMETABLE[parsed.routeId].find(
      (candidate) => candidate.flightNumber === parsed.flightNumber,
    );
    if (!flight) {
      return { offerId, availability: { status: "unknown" }, fetchedAt };
    }
    const offer = buildOffer(parsed.routeId, parsed.date, flight, fetchedAt);
    return { offerId, availability: offer.availability, fetchedAt };
  }

  async getBookingUrl(): Promise<string | null> {
    // デモプロバイダーは公式の予約ディープリンクを持たない。
    // 推測でURLを組み立てず null を返し、公式の予約ページへ案内させる。
    return null;
  }
}

function decideStatus(params: {
  all: FlightOffer[];
  inPeriod: FlightOffer[];
  bookable: FlightOffer[];
  withPrice: FlightOffer[];
}): DailyFareStatus {
  const { all, inPeriod, bookable, withPrice } = params;
  if (all.length === 0) return "no_flights";
  if (inPeriod.length === 0) return "no_matching_period";
  if (bookable.length === 0) return "sold_out";
  if (withPrice.length === 0) return "price_error";
  return "ok";
}
