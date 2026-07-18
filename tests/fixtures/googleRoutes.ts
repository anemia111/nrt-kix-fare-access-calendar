/**
 * Google Routes API (computeRoutes / TRANSIT) の fixture。
 */

import type { GoogleRoutesRaw } from "@shared/routesTransform";

/** 鎌取 → 成田空港（乗換1回・徒歩あり・運賃あり）。 */
export const ROUTES_KAMATORI_NRT: GoogleRoutesRaw = {
  routes: [
    {
      duration: "5580s",
      travelAdvisory: {
        transitFare: { currencyCode: "JPY", units: "1340", nanos: 0 },
      },
      legs: [
        {
          steps: [
            { travelMode: "WALK", staticDuration: "240s" },
            {
              travelMode: "TRANSIT",
              transitDetails: {
                stopDetails: {
                  departureStop: { name: "鎌取" },
                  arrivalStop: { name: "千葉" },
                  departureTime: "2026-08-10T04:58:00+09:00",
                  arrivalTime: "2026-08-10T05:16:00+09:00",
                },
                transitLine: {
                  name: "JR外房線",
                  nameShort: "外房線",
                  vehicle: { type: "HEAVY_RAIL" },
                },
              },
            },
            { travelMode: "WALK", staticDuration: "300s" },
            {
              travelMode: "TRANSIT",
              transitDetails: {
                stopDetails: {
                  departureStop: { name: "千葉" },
                  arrivalStop: { name: "成田空港" },
                  departureTime: "2026-08-10T05:25:00+09:00",
                  arrivalTime: "2026-08-10T06:05:00+09:00",
                },
                transitLine: {
                  name: "JR成田線",
                  nameShort: "成田線",
                  vehicle: { type: "COMMUTER_TRAIN" },
                },
              },
            },
          ],
        },
      ],
    },
    {
      // より遅い経路（到着ぎりぎり）
      duration: "4800s",
      legs: [
        {
          steps: [
            {
              travelMode: "TRANSIT",
              transitDetails: {
                stopDetails: {
                  departureStop: { name: "鎌取" },
                  arrivalStop: { name: "成田空港" },
                  departureTime: "2026-08-10T05:20:00+09:00",
                  arrivalTime: "2026-08-10T06:15:00+09:00",
                },
                transitLine: { nameShort: "直通", vehicle: { type: "HEAVY_RAIL" } },
              },
            },
          ],
        },
      ],
    },
  ],
};

/** バス区間を含む経路（関空第2ターミナル想定）。 */
export const ROUTES_WITH_BUS: GoogleRoutesRaw = {
  routes: [
    {
      duration: "3600s",
      legs: [
        {
          steps: [
            {
              travelMode: "TRANSIT",
              transitDetails: {
                stopDetails: {
                  departureStop: { name: "和歌山" },
                  arrivalStop: { name: "関西空港" },
                  departureTime: "2026-08-10T05:05:00+09:00",
                  arrivalTime: "2026-08-10T05:50:00+09:00",
                },
                transitLine: { nameShort: "関空快速", vehicle: { type: "COMMUTER_TRAIN" } },
              },
            },
            {
              travelMode: "TRANSIT",
              transitDetails: {
                stopDetails: {
                  departureStop: { name: "関西空港" },
                  arrivalStop: { name: "第2ターミナル" },
                  departureTime: "2026-08-10T05:55:00+09:00",
                  arrivalTime: "2026-08-10T06:04:00+09:00",
                },
                transitLine: { nameShort: "連絡バス", vehicle: { type: "BUS" } },
              },
            },
          ],
        },
      ],
    },
  ],
};

/** 経路0件（ダイヤ未取得）。 */
export const ROUTES_EMPTY: GoogleRoutesRaw = { routes: [] };

/** 時刻が欠けた区間を含む（推測で埋めないことの確認用）。 */
export const ROUTES_PARTIAL: GoogleRoutesRaw = {
  routes: [
    {
      duration: "3000s",
      legs: [
        {
          steps: [
            {
              travelMode: "TRANSIT",
              transitDetails: {
                stopDetails: {
                  departureStop: { name: "鎌取" },
                  arrivalStop: { name: "千葉" },
                  departureTime: "2026-08-10T04:58:00+09:00",
                  arrivalTime: "2026-08-10T05:16:00+09:00",
                },
                transitLine: { nameShort: "外房線", vehicle: { type: "HEAVY_RAIL" } },
              },
            },
            {
              // 停留所・時刻が欠けている区間
              travelMode: "TRANSIT",
              transitDetails: { transitLine: { nameShort: "不明", vehicle: { type: "HEAVY_RAIL" } } },
            },
          ],
        },
      ],
    },
  ],
};

/** 徒歩のみ（公共交通経路として扱わない）。 */
export const ROUTES_WALK_ONLY: GoogleRoutesRaw = {
  routes: [{ duration: "900s", legs: [{ steps: [{ travelMode: "WALK", staticDuration: "900s" }] }] }],
};
