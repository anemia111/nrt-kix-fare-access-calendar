import { AIRLINES } from "@/domain/airlines";
import { AIRLINE_BOARDING_RULES, BOARDING_FALLBACKS } from "@/domain/boardingRules";

/**
 * 航空会社レジストリと搭乗ルールの公開（要件38）。
 *
 * ここで返す搭乗ルールは各航空会社の公式サイトを一次情報とした実データで、
 * 出典URL（officialSourceUrls）と最終確認日（checkedAt）を含む。
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json({
    note: "搭乗ルールは各航空会社の公式サイトを一次情報として調査した実データです。officialSourceUrls と checkedAt を確認してください。公式に確認できなかった項目は値を持ちません（推測していません）。",
    airlines: Object.values(AIRLINES),
    boardingRules: AIRLINE_BOARDING_RULES,
    fallbacks: {
      note: "航空会社固有の公式ルールを取得できなかった場合にのみ使う、安全側の目安です。公式値ではありません。",
      byCategory: BOARDING_FALLBACKS,
    },
  });
}
