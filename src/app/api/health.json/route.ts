import { currentDataMode } from "@/providers";
import { CALENDAR_DAYS, ROUTE_IDS_LIST } from "@/app/api/_shared";

/**
 * ヘルスチェック（要件38）。
 *
 * 静的エクスポートではビルド時に評価され、静的な JSON として配信される。
 * 秘密情報を含めない（要件42）。
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json({
    status: "ok",
    dataMode: currentDataMode(),
    supportedRoutes: ROUTE_IDS_LIST,
    supportedAirports: ["NRT", "KIX"],
    supportedOriginStations: ["KAMATORI", "WAKAYAMA"],
    calendarDays: CALENDAR_DAYS,
    builtAt: new Date().toISOString(),
  });
}
