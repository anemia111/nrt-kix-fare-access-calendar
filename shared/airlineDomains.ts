/**
 * 対象航空会社の公式ドメインと公式検索ページ（フロントと Worker で共有）。
 *
 * 「公式」と表示してよいドメインの唯一の情報源。旅行代理店・価格比較サイトは
 * 絶対に含めない。Booking Options の提供元が公式かどうかの判定にも使う。
 *
 * 最終確認日: 2026-07-17
 */

import type { TargetAirlineCode } from "./dto";

export const OFFICIAL_DOMAINS: Readonly<Record<TargetAirlineCode, readonly string[]>> = {
  MM: ["flypeach.com"],
  GK: ["jetstar.com"],
  NH: ["ana.co.jp"],
  JL: ["jal.co.jp"],
  IJ: ["ch.com"],
};

/**
 * 正式な購入URLが得られない場合に案内する公式ページ。
 * 便指定のディープリンク仕様は公開されていないため、URLを推測して
 * 便や日付のクエリを組み立てることはしない。
 */
export const OFFICIAL_BOOKING_PAGES: Readonly<Record<TargetAirlineCode, string>> = {
  MM: "https://www.flypeach.com/jp/ja",
  GK: "https://www.jetstar.com/jp/ja/home",
  NH: "https://www.ana.co.jp/ja/jp/domestic/",
  JL: "https://www.jal.co.jp/jp/ja/dom/",
  IJ: "https://jp.ch.com/",
};

/** 全対象航空会社の公式ドメインを平坦化したもの。 */
export const ALL_OFFICIAL_DOMAINS: readonly string[] = Object.values(OFFICIAL_DOMAINS).flat();

/** そのホストがどの航空会社の公式か（該当なしなら null）。 */
export function officialAirlineOfHost(host: string): TargetAirlineCode | null {
  const normalized = host.trim().toLowerCase().replace(/\.$/, "");
  for (const [code, domains] of Object.entries(OFFICIAL_DOMAINS)) {
    for (const domain of domains) {
      if (normalized === domain || normalized.endsWith(`.${domain}`)) {
        return code as TargetAirlineCode;
      }
    }
  }
  return null;
}
