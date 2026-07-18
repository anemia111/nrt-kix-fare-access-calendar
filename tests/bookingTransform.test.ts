import { describe, expect, it } from "vitest";
import {
  buildHandoff,
  parsePostData,
  transformBookingOptions,
} from "@shared/bookingTransform";
import { BOOKING_OPTIONS_EMPTY, BOOKING_OPTIONS_RAW } from "./fixtures/serpapi";

describe("Booking Options の変換", () => {
  const options = transformBookingOptions(BOOKING_OPTIONS_RAW);

  it("航空会社公式をドメイン検証したうえで先頭に並べる", () => {
    expect(options[0].providerName).toBe("Peach");
    expect(options[0].providerType).toBe("airline");
    expect(options[0].isVerifiedOfficial).toBe(true);
  });

  it("post_data があれば post 遷移として扱う", () => {
    expect(options[0].handoff).toEqual({
      kind: "post",
      endpoint: "https://www.flypeach.com/booking/start",
      fields: { flight: "MM123", date: "2026-08-10" },
    });
  });

  it("OTA を公式と表示しない", () => {
    const ota = options.find((option) => option.providerName === "Some OTA");
    expect(ota?.providerType).toBe("ota");
    expect(ota?.isVerifiedOfficial).toBe(false);
  });

  it("公式ドメインを装ったホストを公式と判定しない", () => {
    const fake = options.find((option) => option.providerName === "Fake Peach");
    // flypeach.com.evil.example は flypeach.com の正式なサブドメインではない
    expect(fake?.isVerifiedOfficial).toBe(false);
    expect(fake?.providerType).not.toBe("airline");
  });

  it("https でない遷移先は採用しない", () => {
    const insecure = options.find((option) => option.providerName === "Insecure Agency");
    expect(insecure?.handoff.kind).toBe("unavailable");
  });

  it("遷移先URLが無い場合は unavailable にする", () => {
    const phone = options.find((option) => option.providerName === "Phone Only Agency");
    expect(phone?.handoff.kind).toBe("unavailable");
  });

  it("価格を取り込む", () => {
    expect(options[0].price).toEqual({ amount: 8980, currency: "JPY" });
  });

  it("0件でも壊れない", () => {
    expect(transformBookingOptions(BOOKING_OPTIONS_EMPTY)).toEqual([]);
  });
});

describe("post_data の分解", () => {
  it("キーと値へ分解する", () => {
    expect(parsePostData("a=1&b=2")).toEqual({ a: "1", b: "2" });
  });
  it("URLエンコードを戻す", () => {
    expect(parsePostData("q=%E6%88%90%E7%94%B0")).toEqual({ q: "成田" });
  });
  it("空・不正入力を安全に扱う", () => {
    expect(parsePostData("")).toEqual({});
    expect(parsePostData(undefined)).toEqual({});
    expect(parsePostData("novalue")).toEqual({});
  });
});

describe("遷移方法の判定", () => {
  it("javascript: を拒否する", () => {
    expect(
      buildHandoff({ booking_request: { url: "javascript:alert(1)" } }).kind,
    ).toBe("unavailable");
  });

  it("userinfo 偽装を拒否する", () => {
    // 一見 flypeach.com に見えるが実際のホストは evil.example
    expect(
      buildHandoff({ booking_request: { url: "https://www.flypeach.com@evil.example/" } }).kind,
    ).toBe("unavailable");
  });

  it("URLのみなら url 遷移", () => {
    expect(buildHandoff({ booking_request: { url: "https://example.com/x" } })).toEqual({
      kind: "url",
      url: "https://example.com/x",
    });
  });
});
