import { describe, expect, it } from "vitest";
import { isAllowedHost, validateExternalUrl } from "@/lib/externalUrl";
import { AIRLINES } from "@/domain/airlines";
import { resolveOfficialLink } from "@/lib/officialLink";
import { makeOffer } from "./fixtures";

const PEACH_DOMAINS = AIRLINES.MM.officialDomains;
const JETSTAR_DOMAINS = AIRLINES.GK.officialDomains;

describe("ドメイン判定", () => {
  it("公式ドメインそのものと正式なサブドメインを許可する", () => {
    expect(isAllowedHost("flypeach.com", PEACH_DOMAINS)).toBe(true);
    expect(isAllowedHost("www.flypeach.com", PEACH_DOMAINS)).toBe(true);
    expect(isAllowedHost("WWW.FLYPEACH.COM", PEACH_DOMAINS)).toBe(true);
  });

  it("偽ドメインを拒否する（部分一致で通してはいけない）", () => {
    // 要件15で明示的に挙げられている偽ドメイン
    expect(isAllowedHost("fake-peach.com", PEACH_DOMAINS)).toBe(false);
    expect(isAllowedHost("flypeach.example.com", PEACH_DOMAINS)).toBe(false);
    expect(isAllowedHost("jetstar-login.example.net", JETSTAR_DOMAINS)).toBe(false);
  });

  it("サフィックスを悪用したドメインを拒否する", () => {
    expect(isAllowedHost("flypeach.com.evil.com", PEACH_DOMAINS)).toBe(false);
    expect(isAllowedHost("notflypeach.com", PEACH_DOMAINS)).toBe(false);
    expect(isAllowedHost("evil-flypeach.com", PEACH_DOMAINS)).toBe(false);
  });
});

describe("外部URLの検証", () => {
  it("https の公式URLを許可する", () => {
    const result = validateExternalUrl("https://www.flypeach.com/jp/ja", PEACH_DOMAINS);
    expect(result.ok).toBe(true);
  });

  it("http を拒否する", () => {
    const result = validateExternalUrl("http://www.flypeach.com/", PEACH_DOMAINS);
    expect(result.ok).toBe(false);
  });

  it("javascript: を拒否する", () => {
    const result = validateExternalUrl("javascript:alert(1)", PEACH_DOMAINS);
    expect(result.ok).toBe(false);
  });

  it("data: を拒否する", () => {
    expect(validateExternalUrl("data:text/html,<script>alert(1)</script>", PEACH_DOMAINS).ok).toBe(
      false,
    );
  });

  it("userinfo による偽装を拒否する", () => {
    // ホストは evil.com になるため、素朴な文字列判定だと騙される形
    const result = validateExternalUrl("https://www.flypeach.com@evil.com/", PEACH_DOMAINS);
    expect(result.ok).toBe(false);
  });

  it("許可されていないドメインを拒否する", () => {
    expect(validateExternalUrl("https://www.jetstar.com/", PEACH_DOMAINS).ok).toBe(false);
  });

  it("旅行代理店・比較サイトのURLを拒否する", () => {
    for (const url of [
      "https://www.expedia.co.jp/flights",
      "https://travel.rakuten.co.jp/",
      "https://skyticket.jp/",
      "https://www.google.com/search?q=peach",
    ]) {
      expect(validateExternalUrl(url, PEACH_DOMAINS).ok).toBe(false);
    }
  });

  it("既定以外のポートを拒否する", () => {
    expect(validateExternalUrl("https://www.flypeach.com:8443/", PEACH_DOMAINS).ok).toBe(false);
  });

  it("URLとして解析できない値を拒否する", () => {
    expect(validateExternalUrl("not a url", PEACH_DOMAINS).ok).toBe(false);
    expect(validateExternalUrl(null, PEACH_DOMAINS).ok).toBe(false);
    expect(validateExternalUrl("", PEACH_DOMAINS).ok).toBe(false);
  });
});

describe("公式リンクの解決", () => {
  it("登録済み航空会社の公式予約ページへ案内する", () => {
    const link = resolveOfficialLink(makeOffer({ marketingAirlineCode: "MM" }));
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    expect(link.host).toContain("flypeach.com");
    expect(link.label).toBe("Peach Aviation公式サイトで確認");
    expect(link.level).toBe("official_booking");
    // 公式のディープリンク仕様を確認できていないため条件は引き継げない
    expect(link.carriesSearchConditions).toBe(false);
  });

  it.each([
    ["GK", "jetstar.com"],
    ["NH", "ana.co.jp"],
    ["JL", "jal.co.jp"],
    ["IJ", "ch.com"],
  ])("%s は %s の公式サイトへ案内する", (code, host) => {
    const link = resolveOfficialLink(makeOffer({ marketingAirlineCode: code }));
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    expect(link.host).toContain(host);
  });

  it("未対応の航空会社では公式サイトを特定できないと返す", () => {
    const link = resolveOfficialLink(makeOffer({ marketingAirlineCode: "ZZ" }));
    expect(link.ok).toBe(false);
    if (link.ok) return;
    expect(link.reason).toContain("公式サイトを特定できませんでした");
  });

  it("APIが公式ドメイン上のディープリンクを返した場合はそれを優先する", () => {
    const link = resolveOfficialLink(
      makeOffer({
        marketingAirlineCode: "MM",
        officialDeepLinkUrl: "https://www.flypeach.com/booking?flight=MM101",
      }),
    );
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    expect(link.level).toBe("api_deep_link");
    expect(link.carriesSearchConditions).toBe(true);
  });

  it("APIが旅行代理店のURLを返しても公式として採用しない", () => {
    const link = resolveOfficialLink(
      makeOffer({
        marketingAirlineCode: "MM",
        officialDeepLinkUrl: "https://www.expedia.co.jp/flights?x=1",
      }),
    );
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    // 代理店URLは弾かれ、公式予約ページにフォールバックする
    expect(link.level).toBe("official_booking");
    expect(link.host).toContain("flypeach.com");
  });

  it("コードシェア便では販売航空会社の公式サイトを優先する", () => {
    const link = resolveOfficialLink(
      makeOffer({ marketingAirlineCode: "JL", operatingAirlineCode: "GK" }),
    );
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    expect(link.host).toContain("jal.co.jp");
  });
});

describe("航空会社レジストリ", () => {
  it("登録済みの公式URLがすべて自身の許可ドメイン上にある", () => {
    for (const airline of Object.values(AIRLINES)) {
      expect(validateExternalUrl(airline.bookingUrl, airline.officialDomains).ok).toBe(true);
      expect(validateExternalUrl(airline.homeUrl, airline.officialDomains).ok).toBe(true);
    }
  });

  it("公式ドメインに旅行代理店・比較サイトが含まれていない", () => {
    const forbidden = ["expedia", "rakuten", "skyticket", "google", "yahoo", "airtrip", "travelist"];
    for (const airline of Object.values(AIRLINES)) {
      for (const domain of airline.officialDomains) {
        expect(forbidden.some((word) => domain.includes(word))).toBe(false);
      }
    }
  });
});
