import { terminalOfAirline } from "@/domain/terminals";
import { timePeriodOfMinutes } from "@/domain/timePeriods";
import type {
  Availability,
  FareBreakdown,
  FlightOffer,
  RouteId,
  TransitLeg,
  TransitRoute,
} from "@/domain/types";
import { clockToMinutes } from "@/domain/timePeriods";
import { toJstDateTime } from "@/lib/time";

const DEMO_SOURCE = {
  providerId: "test",
  providerNameJa: "テスト",
  isDemo: true,
  fetchedAt: "2026-07-17T09:00:00+09:00",
} as const;

export const KNOWN_BREAKDOWN: FareBreakdown = {
  known: true,
  baseFareYen: 6000,
  taxYen: 480,
  airportFacilityFeeYen: 440,
  mandatoryBookingFeeYen: 0,
  paymentFeeYen: 660,
  paymentMethodNote: "クレジットカード払いを基準",
  notes: [],
};

export const UNKNOWN_BREAKDOWN: FareBreakdown = {
  known: false,
  notes: ["総額のみ取得可能"],
};

export function makeOffer(overrides: Partial<FlightOffer> = {}): FlightOffer {
  const date = overrides.date ?? "2026-07-21"; // 火曜（平日）
  const departureClock = "08:15";
  const departureMinutes = overrides.departureMinutes ?? clockToMinutes(departureClock);
  const marketing = overrides.marketingAirlineCode ?? "MM";
  const operating = overrides.operatingAirlineCode ?? marketing;
  const routeId: RouteId = overrides.routeId ?? "NRT-KIX";
  const origin = routeId === "NRT-KIX" ? "NRT" : "KIX";
  const destination = routeId === "NRT-KIX" ? "KIX" : "NRT";

  const base: FlightOffer = {
    id: `test-${routeId}-${date}-${marketing}`,
    routeId,
    date,
    period: timePeriodOfMinutes(departureMinutes),
    marketingAirlineCode: marketing,
    operatingAirlineCode: operating,
    flightNumber: `${marketing}101`,
    isCodeshare: marketing !== operating,
    originAirport: origin,
    destinationAirport: destination,
    originTerminal: terminalOfAirline(operating, origin),
    destinationTerminal: terminalOfAirline(operating, destination),
    departureAt: toJstDateTime(date, departureMinutes),
    arrivalAt: toJstDateTime(date, departureMinutes + 100),
    departureMinutes,
    durationMinutes: 100,
    isDirect: true,
    totalPriceYen: 8940,
    fareBreakdown: KNOWN_BREAKDOWN,
    carryOnBaggage: { known: true, description: "7kgまで無料" },
    checkedBaggage: { known: false },
    seatSelection: { known: false },
    availability: { status: "available" },
    source: DEMO_SOURCE,
  };

  return { ...base, ...overrides };
}

export function makeAvailability(status: Availability["status"], value?: number): Availability {
  if (status === "exact") return { status: "exact", seatsRemaining: value ?? 3 };
  if (status === "max_pax") return { status: "max_pax", maxSearchablePax: value ?? 4 };
  return { status } as Availability;
}

type RouteSpec = {
  id?: string;
  date?: string;
  departure: string;
  arrival: string;
  transferCount?: number;
  transferMargins?: number[];
  fareYen?: number | null;
  isFirstTrain?: boolean;
};

export function makeTransitRoute(spec: RouteSpec): TransitRoute {
  const date = spec.date ?? "2026-07-21";
  const departureMinutes = clockToMinutes(spec.departure);
  const arrivalMinutes = clockToMinutes(spec.arrival);
  const legs: TransitLeg[] = [
    {
      lineNameJa: "テスト線",
      fromStationNameJa: "出発駅",
      toStationNameJa: "到着駅",
      departureAt: toJstDateTime(date, departureMinutes),
      arrivalAt: toJstDateTime(date, arrivalMinutes),
      transferMarginMinutes: spec.transferMargins?.[0],
    },
  ];

  return {
    id: spec.id ?? `${spec.departure}-${spec.arrival}`,
    legs,
    departureAt: toJstDateTime(date, departureMinutes),
    arrivalAt: toJstDateTime(date, arrivalMinutes),
    transferCount: spec.transferCount ?? 1,
    durationMinutes: arrivalMinutes - departureMinutes,
    fareYen: spec.fareYen === undefined ? 1340 : spec.fareYen,
    isFirstTrain: spec.isFirstTrain ?? false,
    source: DEMO_SOURCE,
  };
}
