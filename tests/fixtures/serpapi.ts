/**
 * SerpApi Google Flights のレスポンス fixture。
 * テストでは実APIを叩かず、これを使う。
 */

import type { SerpApiRaw } from "@shared/serpapiTransform";
import type { SerpApiBookingRaw } from "@shared/bookingTransform";

/** NRT→KIX の典型的な応答（Peach・ジェットスター・対象外航空会社・乗継便を含む）。 */
export const SERPAPI_NRT_KIX: SerpApiRaw = {
  best_flights: [
    {
      flights: [
        {
          departure_airport: { id: "NRT", name: "成田国際空港", time: "2026-08-10 07:30" },
          arrival_airport: { id: "KIX", name: "関西国際空港", time: "2026-08-10 09:10" },
          duration: 100,
          airline: "Peach",
          flight_number: "MM 123",
          travel_class: "Economy",
        },
      ],
      total_duration: 100,
      price: 8980,
      booking_token: "token-mm123",
      type: "One way",
    },
  ],
  other_flights: [
    {
      flights: [
        {
          departure_airport: { id: "NRT", name: "成田国際空港", time: "2026-08-10 10:15" },
          arrival_airport: { id: "KIX", name: "関西国際空港", time: "2026-08-10 11:50" },
          duration: 95,
          airline: "Jetstar",
          flight_number: "GK 205",
          travel_class: "Economy",
        },
      ],
      total_duration: 95,
      price: 6480,
      booking_token: "token-gk205",
      type: "One way",
    },
    {
      // 対象外の航空会社（表示してはいけない）
      flights: [
        {
          departure_airport: { id: "NRT", name: "成田国際空港", time: "2026-08-10 12:00" },
          arrival_airport: { id: "KIX", name: "関西国際空港", time: "2026-08-10 13:35" },
          duration: 95,
          airline: "Some Other Air",
          flight_number: "XX 999",
          travel_class: "Economy",
        },
      ],
      total_duration: 95,
      price: 5000,
      type: "One way",
    },
    {
      // 乗継便（直行のみ対象なので除外される）
      flights: [
        {
          departure_airport: { id: "NRT", name: "成田国際空港", time: "2026-08-10 14:00" },
          arrival_airport: { id: "HND", name: "羽田空港", time: "2026-08-10 15:00" },
          duration: 60,
          airline: "ANA",
          flight_number: "NH 100",
        },
        {
          departure_airport: { id: "HND", name: "羽田空港", time: "2026-08-10 16:00" },
          arrival_airport: { id: "KIX", name: "関西国際空港", time: "2026-08-10 17:10" },
          duration: 70,
          airline: "ANA",
          flight_number: "NH 200",
        },
      ],
      total_duration: 190,
      price: 22000,
      type: "One way",
    },
    {
      // 価格が取得できない便
      flights: [
        {
          departure_airport: { id: "NRT", name: "成田国際空港", time: "2026-08-10 19:20" },
          arrival_airport: { id: "KIX", name: "関西国際空港", time: "2026-08-10 20:55" },
          duration: 95,
          airline: "Jetstar",
          flight_number: "GK 209",
        },
      ],
      total_duration: 95,
      type: "One way",
    },
  ],
};

/** 結果0件。 */
export const SERPAPI_EMPTY: SerpApiRaw = { best_flights: [], other_flights: [] };

/** 枠切れ（200 だが error フィールドあり）。 */
export const SERPAPI_QUOTA_ERROR: SerpApiRaw = {
  error: "Your account has run out of searches.",
};

/** 再検索時に価格が上がった応答。 */
export const SERPAPI_PRICE_UP: SerpApiRaw = {
  best_flights: [
    {
      flights: [
        {
          departure_airport: { id: "NRT", time: "2026-08-10 07:30" },
          arrival_airport: { id: "KIX", time: "2026-08-10 09:10" },
          duration: 100,
          flight_number: "MM 123",
        },
      ],
      price: 10480,
      booking_token: "token-mm123",
    },
  ],
};

/** 再検索時に価格が下がった応答。 */
export const SERPAPI_PRICE_DOWN: SerpApiRaw = {
  best_flights: [
    {
      flights: [
        {
          departure_airport: { id: "NRT", time: "2026-08-10 07:30" },
          arrival_airport: { id: "KIX", time: "2026-08-10 09:10" },
          duration: 100,
          flight_number: "MM 123",
        },
      ],
      price: 7480,
      booking_token: "token-mm123",
    },
  ],
};

/** Booking Options: 航空会社公式・OTA・遷移不可を含む。 */
export const BOOKING_OPTIONS_RAW: SerpApiBookingRaw = {
  booking_options: [
    {
      together: {
        book_with: "Peach",
        price: 8980,
        booking_request: {
          url: "https://www.flypeach.com/booking/start",
          post_data: "flight=MM123&date=2026-08-10",
        },
      },
    },
    {
      together: {
        book_with: "Some OTA",
        price: 9200,
        booking_request: { url: "https://ota.example.com/checkout" },
      },
    },
    {
      together: {
        // 電話予約のみ（遷移先URLなし）
        book_with: "Phone Only Agency",
        price: 9900,
        booking_phone: "+81-3-0000-0000",
      },
    },
    {
      together: {
        // 危険なURL（https でない）は採用しない
        book_with: "Insecure Agency",
        price: 8000,
        booking_request: { url: "http://insecure.example.com/pay" },
      },
    },
    {
      together: {
        // 公式ドメインを装ったサブドメイン（公式と判定してはいけない）
        book_with: "Fake Peach",
        price: 7000,
        booking_request: { url: "https://flypeach.com.evil.example/pay" },
      },
    },
  ],
};

export const BOOKING_OPTIONS_EMPTY: SerpApiBookingRaw = { booking_options: [] };
