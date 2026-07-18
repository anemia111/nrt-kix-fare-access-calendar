/**
 * SerpApi Booking Options の生レスポンスを DTO へ変換する。
 *
 * 方針:
 *  - 「公式」と表示してよいのは、遷移先ホストが対象航空会社の公式ドメインに
 *    厳密一致（またはその正式なサブドメイン）する場合だけ。
 *  - https 以外・userinfo 偽装・非既定ポートは遷移先として採用しない。
 *  - 正式な購入URLが得られない場合は `unavailable` を返し、呼び出し側が
 *    公式検索ページへ安全にフォールバックする。URLの推測はしない。
 */

import type { BookingHandoff, BookingOption } from "./dto";
import { officialAirlineOfHost } from "./airlineDomains";
import { isSafeHttpsUrl } from "./urlSafety";

export type SerpApiBookingRaw = {
  booking_options?: readonly SerpApiBookingOption[];
  error?: string;
};

export type SerpApiBookingOption = {
  together?: SerpApiBookingDetail;
  departing?: SerpApiBookingDetail;
};

export type SerpApiBookingDetail = {
  book_with?: string;
  airline_logos?: readonly string[];
  marketed_as?: readonly string[];
  price?: number;
  local_prices?: readonly { currency?: string; price?: number }[];
  booking_request?: { url?: string; post_data?: string };
  booking_phone?: string;
  option_title?: string;
};

/** "a=1&b=2" 形式の post_data をフィールドへ分解する。 */
export function parsePostData(postData: string | undefined | null): Record<string, string> {
  const fields: Record<string, string> = {};
  if (typeof postData !== "string" || postData.length === 0) return fields;
  for (const pair of postData.split("&")) {
    if (!pair) continue;
    const index = pair.indexOf("=");
    if (index === -1) continue;
    const key = decodeURIComponent(pair.slice(0, index));
    const value = decodeURIComponent(pair.slice(index + 1));
    if (key) fields[key] = value;
  }
  return fields;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** 遷移方法を決める。安全でないURLは採用しない。 */
export function buildHandoff(detail: SerpApiBookingDetail): BookingHandoff {
  const request = detail.booking_request;
  const url = request?.url;
  if (!url || !isSafeHttpsUrl(url)) {
    return { kind: "unavailable" };
  }
  const postData = request?.post_data;
  if (typeof postData === "string" && postData.length > 0) {
    return { kind: "post", endpoint: url, fields: parsePostData(postData) };
  }
  return { kind: "url", url };
}

function detailOf(option: SerpApiBookingOption): SerpApiBookingDetail | null {
  return option.together ?? option.departing ?? null;
}

/** 提供元の種別を判定する。公式判定はホストのドメイン検証に基づく。 */
export function classifyProvider(
  detail: SerpApiBookingDetail,
  handoff: BookingHandoff,
): { providerType: BookingOption["providerType"]; isVerifiedOfficial: boolean } {
  const targetUrl =
    handoff.kind === "url" ? handoff.url : handoff.kind === "post" ? handoff.endpoint : null;
  const host = targetUrl ? hostOf(targetUrl) : null;
  const officialAirline = host ? officialAirlineOfHost(host) : null;

  if (officialAirline) {
    return { providerType: "airline", isVerifiedOfficial: true };
  }
  // 名前だけでは公式と断定しない（ドメイン検証を通らなければ ota / unknown）
  const name = (detail.book_with ?? "").trim();
  if (name.length === 0) {
    return { providerType: "unknown", isVerifiedOfficial: false };
  }
  return { providerType: "ota", isVerifiedOfficial: false };
}

function priceOf(detail: SerpApiBookingDetail): BookingOption["price"] {
  if (typeof detail.price === "number" && Number.isFinite(detail.price) && detail.price > 0) {
    return { amount: Math.round(detail.price), currency: "JPY" };
  }
  const local = detail.local_prices?.find(
    (entry) => typeof entry?.price === "number" && entry.price > 0,
  );
  if (local && typeof local.price === "number") {
    return { amount: Math.round(local.price), currency: local.currency ?? "JPY" };
  }
  return null;
}

/**
 * Booking Options を DTO 配列へ変換する。
 * 並び順: 検証済み公式 → その他販売元 → 不明。
 */
export function transformBookingOptions(raw: SerpApiBookingRaw): BookingOption[] {
  const options: BookingOption[] = [];

  for (const rawOption of raw.booking_options ?? []) {
    const detail = detailOf(rawOption);
    if (!detail) continue;

    const handoff = buildHandoff(detail);
    const { providerType, isVerifiedOfficial } = classifyProvider(detail, handoff);

    options.push({
      providerName: (detail.book_with ?? detail.option_title ?? "不明な販売元").trim(),
      providerType,
      price: priceOf(detail),
      handoff,
      isVerifiedOfficial,
    });
  }

  const rank = (option: BookingOption): number => {
    if (option.isVerifiedOfficial) return 0;
    if (option.providerType === "ota") return 1;
    return 2;
  };

  options.sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    const priceA = a.price?.amount ?? Number.POSITIVE_INFINITY;
    const priceB = b.price?.amount ?? Number.POSITIVE_INFINITY;
    return priceA - priceB;
  });

  return options;
}
