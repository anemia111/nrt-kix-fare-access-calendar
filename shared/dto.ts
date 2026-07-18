/**
 * フロントエンド（Next.js）と Cloudflare Worker が共有する DTO 定義。
 *
 * ここには DOM / Node / Next 固有の API を持ち込まない（両方でビルドできるように）。
 * SerpApi や Google Routes の生レスポンス構造を UI に漏らさないための境界でもある。
 */

export const TARGET_AIRLINE_CODES = ["MM", "GK", "NH", "JL", "IJ"] as const;
export type TargetAirlineCode = (typeof TARGET_AIRLINE_CODES)[number];

export type AirportCode = "NRT" | "KIX";

export function isTargetAirlineCode(value: unknown): value is TargetAirlineCode {
  return (
    typeof value === "string" && (TARGET_AIRLINE_CODES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// 航空券
// ---------------------------------------------------------------------------

export type FlightEndpoint = {
  readonly airport: AirportCode;
  readonly terminal: string | null;
  /** ISO8601（JST オフセット付き） */
  readonly scheduledAt: string;
};

export type FlightPrice = {
  readonly amount: number;
  readonly currency: "JPY";
};

/**
 * 残席情報。
 *
 * Google Flights / SerpApi は**正確な残席数を提供しない**。したがって通常は
 * `bookable` か `unknown` になる。`exact` は、提供元が実残席数を返した場合にのみ
 * 使う。「◯名まで検索可能」の類は残席数として扱わない。
 */
export type SeatAvailability =
  | {
      readonly kind: "exact";
      readonly remainingSeats: number;
      readonly source: string;
      readonly fetchedAt: string;
    }
  | {
      readonly kind: "bookable";
      readonly fetchedAt: string;
    }
  | {
      readonly kind: "unknown";
      readonly reason: string;
    }
  | {
      readonly kind: "soldOut";
      readonly fetchedAt: string;
    };

export type FlightSearchResult = {
  readonly id: string;
  readonly airlineCode: TargetAirlineCode;
  readonly airlineName: string;
  readonly flightNumber: string | null;

  readonly departure: FlightEndpoint;
  readonly arrival: FlightEndpoint;

  readonly durationMinutes: number | null;

  readonly price: FlightPrice | null;

  readonly bookingToken: string | null;

  readonly seatAvailability: SeatAvailability;

  readonly fetchedAt: string;
  readonly expiresAt: string | null;

  readonly source: "serpapi-google-flights";
};

export type FlightSearchInput = {
  readonly origin: AirportCode;
  readonly destination: AirportCode;
  /** YYYY-MM-DD */
  readonly date: string;
  readonly adults: number;
};

export type CacheInfo = {
  readonly isCached: boolean;
  readonly cacheAgeSeconds: number;
  readonly fetchedAt: string;
};

export type FlightSearchResponse = {
  readonly flights: readonly FlightSearchResult[];
  readonly cache: CacheInfo;
  readonly source: "serpapi-google-flights";
  /** 対象航空会社以外を除外した件数（表示の透明性のため） */
  readonly filteredOutCount: number;
};

// ---------------------------------------------------------------------------
// 再検索（価格・予約可否の再確認）
// ---------------------------------------------------------------------------

/** 同一便を照合するためのキー。配列インデックスでは特定しない。 */
export type FlightIdentity = {
  readonly airlineCode: TargetAirlineCode;
  readonly flightNumber: string | null;
  readonly originAirport: AirportCode;
  readonly destinationAirport: AirportCode;
  readonly departureAt: string;
  readonly arrivalAt: string;
};

export type RevalidateInput = {
  readonly search: FlightSearchInput;
  readonly identity: FlightIdentity;
  /** 検索時に表示していた価格。変化の検出に使う。 */
  readonly previousPriceAmount: number | null;
};

export type RevalidateResult =
  | {
      readonly status: "unchanged";
      readonly flight: FlightSearchResult;
      readonly checkedAt: string;
    }
  | {
      readonly status: "priceChanged";
      readonly flight: FlightSearchResult;
      readonly previousAmount: number;
      readonly currentAmount: number;
      readonly deltaAmount: number;
      readonly checkedAt: string;
    }
  | {
      readonly status: "soldOut";
      readonly checkedAt: string;
    }
  /** 同一便を確定できなかった。 */
  | {
      readonly status: "notMatched";
      readonly reason: string;
      readonly checkedAt: string;
    };

// ---------------------------------------------------------------------------
// Booking Options
// ---------------------------------------------------------------------------

export type BookingHandoff =
  | { readonly kind: "url"; readonly url: string }
  | {
      readonly kind: "post";
      readonly endpoint: string;
      readonly fields: Readonly<Record<string, string>>;
    }
  | { readonly kind: "unavailable" };

export type BookingOption = {
  readonly providerName: string;
  readonly providerType: "airline" | "ota" | "unknown";
  readonly price: { readonly amount: number; readonly currency: string } | null;
  readonly handoff: BookingHandoff;
  /** 公式ドメイン検証を通過したか（"公式" と表示してよいか）。 */
  readonly isVerifiedOfficial: boolean;
};

export type BookingOptionsResponse = {
  readonly options: readonly BookingOption[];
  readonly fetchedAt: string;
  /** Booking Options を取得できなかった場合の理由。 */
  readonly unavailableReason: string | null;
};

// ---------------------------------------------------------------------------
// 公共交通（Google Routes）
// ---------------------------------------------------------------------------

export type TransitLeg =
  | {
      readonly mode: "TRAIN";
      readonly lineName: string | null;
      readonly departureStop: string;
      readonly arrivalStop: string;
      readonly departureAt: string;
      readonly arrivalAt: string;
    }
  | {
      readonly mode: "BUS";
      readonly lineName: string | null;
      readonly departureStop: string;
      readonly arrivalStop: string;
      readonly departureAt: string;
      readonly arrivalAt: string;
    }
  | {
      readonly mode: "WALK";
      readonly durationMinutes: number;
    }
  | {
      readonly mode: "OTHER";
      readonly description: string;
    };

export type TransitRoute = {
  readonly id: string;
  readonly departureAt: string;
  readonly arrivalAt: string;
  readonly durationMinutes: number;
  readonly transfers: number;
  readonly walkingMinutes: number | null;
  readonly fare: { readonly amount: number; readonly currency: "JPY" } | null;
  readonly legs: readonly TransitLeg[];
  readonly source: "google-routes";
  readonly fetchedAt: string;
};

export type TransitAvailability =
  | { readonly kind: "available"; readonly routes: readonly TransitRoute[] }
  /** 対象日のダイヤをまだ取得できない（遠い将来など）。架空時刻は作らない。 */
  | { readonly kind: "scheduleUnavailable"; readonly reason: string }
  | { readonly kind: "apiError"; readonly reason: string };

export type TransitSearchInput = {
  readonly originStationCode: string;
  readonly destinationAirport: AirportCode;
  /** そのターミナルに適した空港側の駅コード。 */
  readonly destinationStationCode: string;
  /** この時刻までに到着したい（ISO8601）。 */
  readonly arriveBy: string;
};

export type TransitSearchResponse = {
  readonly availability: TransitAvailability;
  readonly cache: CacheInfo;
  readonly source: "google-routes";
};

// ---------------------------------------------------------------------------
// エラー
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | "rate_limited"
  | "upstream_unavailable"
  | "upstream_quota"
  | "invalid_request"
  | "not_configured"
  | "internal";

export type ApiErrorBody = {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
  };
};
