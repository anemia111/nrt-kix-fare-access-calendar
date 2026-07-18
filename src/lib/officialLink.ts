/**
 * 航空会社公式サイトへのリンク解決（要件11・12・14）。
 *
 * 旅行代理店・価格比較サイト・広告サイトを「航空会社公式サイト」として
 * 表示してはいけない。航空券APIが返した予約URLであっても、その航空会社の
 * 公式ドメイン上にあることを検証してから採用する。検証に通らない場合は
 * リンクを出さず「公式サイトを特定できませんでした」と表示する。
 *
 * 検索エンジンの検索結果ページへ誘導することは絶対にしない。
 */

import { findAirline, type AirlineOfficialSite } from "@/domain/airlines";
import type { FlightOffer } from "@/domain/types";
import { validateExternalUrl } from "./externalUrl";

/** 要件12の優先順位のうち、どの段階のリンクを採用したか。 */
export type OfficialLinkLevel =
  /** 1. 航空券APIが返した公式の予約ディープリンク */
  | "api_deep_link"
  /** 2. 航空会社が正式に提供する予約ディープリンク */
  | "airline_deep_link"
  /** 3. 日付と路線を引き継げる公式検索ページ */
  | "official_search"
  /** 4. 航空会社公式の国内線予約ページ */
  | "official_booking"
  /** 5. 航空会社公式トップページ */
  | "official_home";

export type OfficialLink =
  | {
      readonly ok: true;
      readonly url: string;
      readonly host: string;
      readonly airline: AirlineOfficialSite;
      readonly level: OfficialLinkLevel;
      /** ボタン文言（例: 「Peach公式サイトで確認」）。 */
      readonly label: string;
      /** 条件を引き継げたか。引き継げない場合は画面で注意を促す。 */
      readonly carriesSearchConditions: boolean;
    }
  | { readonly ok: false; readonly reason: string };

export const OFFICIAL_SITE_UNKNOWN_MESSAGE = "公式サイトを特定できませんでした";

export const OFFICIAL_SITE_REMINDER =
  "公式サイトで搭乗日、路線、便、空席、手荷物条件、最終価格を再確認してください。";

/**
 * その便の公式リンクを決める。
 *
 * コードシェア便では原則として販売航空会社を優先する。ただし航空券APIが
 * 正式な予約URLを返している場合はそれを優先する（要件14）。
 */
export function resolveOfficialLink(offer: FlightOffer): OfficialLink {
  return resolveOfficialLinkByAirline(offer.marketingAirlineCode, offer.officialDeepLinkUrl);
}

/**
 * 航空会社コードから公式リンクを決める。実用モード（便情報なし）でも使える。
 * `apiDeepLinkUrl` は航空券APIが返した予約URL（あれば）。
 */
export function resolveOfficialLinkByAirline(
  airlineCode: string,
  apiDeepLinkUrl?: string,
): OfficialLink {
  const airline = findAirline(airlineCode);
  if (!airline) {
    return {
      ok: false,
      reason: `${OFFICIAL_SITE_UNKNOWN_MESSAGE}（航空会社コード: ${airlineCode}）`,
    };
  }

  // 優先順位1: APIが返したディープリンク。公式ドメイン上にある場合のみ採用する。
  // OTA や比較サイトのURLが返ってきた場合はここで弾かれる。
  if (apiDeepLinkUrl) {
    const validation = validateExternalUrl(apiDeepLinkUrl, airline.officialDomains);
    if (validation.ok) {
      return {
        ok: true,
        url: validation.url,
        host: validation.host,
        airline,
        level: "api_deep_link",
        label: labelFor(airline),
        carriesSearchConditions: true,
      };
    }
    // 公式ドメインでないディープリンクは採用せず、公式予約ページへ切り替える。
  }

  // 優先順位2〜3: 航空会社が正式に公開しているディープリンク仕様が確認できた場合のみ。
  // 未公開のURL仕様を推測して独自のクエリパラメータを作ってはいけないため、
  // supportsDeepLink が false の現状ではここを通らない。
  if (airline.supportsDeepLink) {
    const validation = validateExternalUrl(airline.bookingUrl, airline.officialDomains);
    if (validation.ok) {
      return {
        ok: true,
        url: validation.url,
        host: validation.host,
        airline,
        level: "airline_deep_link",
        label: labelFor(airline),
        carriesSearchConditions: true,
      };
    }
  }

  // 優先順位4: 公式の国内線予約ページ（条件は引き継げない）。
  const booking = validateExternalUrl(airline.bookingUrl, airline.officialDomains);
  if (booking.ok) {
    return {
      ok: true,
      url: booking.url,
      host: booking.host,
      airline,
      level: "official_booking",
      label: labelFor(airline),
      carriesSearchConditions: false,
    };
  }

  // 優先順位5: 公式トップページ。
  const home = validateExternalUrl(airline.homeUrl, airline.officialDomains);
  if (home.ok) {
    return {
      ok: true,
      url: home.url,
      host: home.host,
      airline,
      level: "official_home",
      label: labelFor(airline),
      carriesSearchConditions: false,
    };
  }

  return { ok: false, reason: OFFICIAL_SITE_UNKNOWN_MESSAGE };
}

function labelFor(airline: AirlineOfficialSite): string {
  return `${airline.airlineNameJa}公式サイトで確認`;
}

export const OFFICIAL_LINK_LEVEL_LABELS: Readonly<Record<OfficialLinkLevel, string>> = {
  api_deep_link: "航空券APIが提供する公式予約リンク",
  airline_deep_link: "航空会社公式の予約ディープリンク",
  official_search: "航空会社公式の検索ページ",
  official_booking: "航空会社公式の予約ページ",
  official_home: "航空会社公式トップページ",
};
