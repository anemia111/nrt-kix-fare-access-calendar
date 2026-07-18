/**
 * 空港ターミナルと最寄駅の対応、駅からカウンターまでの移動時間。
 *
 * 実体は `shared/officialReference.ts` にある（Worker と共有）。
 * このファイルは既存の import パスを維持するための再エクスポート。
 *
 * 「関西空港駅に着いた＝空港に着いた」ではない、という前提はそのまま維持している。
 */

export type {
  AirportStation,
  TerminalAccess,
  TimingComponent,
} from "@shared/officialReference";

export {
  AIRLINE_TERMINALS,
  AIRPORT_STATIONS,
  TERMINAL_ACCESS,
  findTerminalAccess,
  terminalAccessesOf,
  terminalOfAirline,
  totalTransferMinutes,
  worstCaseTransferMinutes,
} from "@shared/officialReference";
