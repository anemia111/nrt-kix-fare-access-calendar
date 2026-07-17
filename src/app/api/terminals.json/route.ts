import { AIRLINE_TERMINALS, AIRPORT_STATIONS, TERMINAL_ACCESS } from "@/domain/terminals";
import { AIRPORTS, ORIGIN_STATIONS } from "@/domain/routes";

/**
 * ターミナル情報と空港アクセスの前提（要件38）。
 *
 * components の official フラグで、公式サイトに明示された数値か、
 * アプリ側の安全側の仮定かを区別できる。
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json({
    note: "移動時間の components は official:true が公式サイトに明示された数値、official:false がアプリ側で安全側に置いた仮定です。",
    airports: AIRPORTS,
    airportStations: AIRPORT_STATIONS,
    originStations: ORIGIN_STATIONS,
    terminalAccess: TERMINAL_ACCESS,
    airlineTerminals: AIRLINE_TERMINALS,
  });
}
