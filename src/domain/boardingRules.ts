/**
 * 航空会社ごとの国内線 搭乗ルール（実データ）。
 *
 * 実体は `shared/officialReference.ts` にある。Cloudflare Worker からも同じ値を
 * 参照するため、安全に関わるこのデータは共有ファイル1か所で管理している。
 * このファイルは既存の import パスを維持するための再エクスポート。
 */

export type {
  AirlineBoardingRule,
  BoardingFallback,
} from "@shared/officialReference";

export {
  AIRLINE_BOARDING_RULES,
  BOARDING_FALLBACKS,
  FALLBACK_NOTICE,
  RULE_UNAVAILABLE_NOTICE,
  boardingRulesOf,
  findBoardingRule,
} from "@shared/officialReference";
