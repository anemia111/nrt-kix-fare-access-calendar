/**
 * Worker のエンドポイント統合テスト。
 * 実APIは叩かず、fetch と Cache API をスタブして fixture を返す。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/src/index";
import { resetRateLimits } from "../worker/src/http";
import {
  BOOKING_OPTIONS_RAW,
  SERPAPI_EMPTY,
  SERPAPI_NRT_KIX,
  SERPAPI_PRICE_UP,
  SERPAPI_QUOTA_ERROR,
} from "./fixtures/serpapi";
import { ROUTES_EMPTY, ROUTES_KAMATORI_NRT } from "./fixtures/googleRoutes";

const ENV = {
  SERPAPI_API_KEY: "test-serp-key",
  GOOGLE_MAPS_API_KEY: "test-google-key",
  ALLOWED_ORIGINS: "https://anemia111.github.io,http://localhost:3000",
  FLIGHT_CACHE_TTL_SECONDS: "3600",
  TRANSIT_CACHE_TTL_SECONDS: "86400",
};

/** Cache API の最小スタブ（毎テストで空にする）。 */
function installCacheStub() {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).caches = {
    default: {
      async match(request: Request) {
        const body = store.get(request.url);
        return body ? new Response(body) : undefined;
      },
      async put(request: Request, response: Response) {
        store.set(request.url, await response.text());
      },
    },
  };
  return store;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function post(path: string, body: unknown, origin = "https://anemia111.github.io"): Request {
  return new Request(`https://worker.example${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "CF-Connecting-IP": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}

const SEARCH = { origin: "NRT", destination: "KIX", date: "2026-08-10", adults: 1 };

beforeEach(() => {
  installCacheStub();
  resetRateLimits();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GET /api/health", () => {
  it("キーの値を返さず、設定有無だけを返す", async () => {
    const request = new Request("https://worker.example/api/health", {
      headers: { Origin: "https://anemia111.github.io" },
    });
    const response = await worker.fetch(request, ENV);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.flightProviderConfigured).toBe(true);
    expect(body.transitProviderConfigured).toBe(true);
    // キーそのものは絶対に含まれない
    expect(JSON.stringify(body)).not.toContain("test-serp-key");
    expect(JSON.stringify(body)).not.toContain("test-google-key");
  });
});

describe("CORS", () => {
  it("許可オリジンには Allow-Origin を返す", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/api/health", {
        headers: { Origin: "https://anemia111.github.io" },
      }),
      ENV,
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://anemia111.github.io",
    );
  });

  it("許可されていないオリジンを拒否する", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/api/health", {
        headers: { Origin: "https://evil.example" },
      }),
      ENV,
    );
    expect(response.status).toBe(403);
  });
});

describe("POST /api/flights/search", () => {
  it("SerpApi 成功時に DTO を返し、生レスポンスを漏らさない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(SERPAPI_NRT_KIX)));
    const response = await worker.fetch(post("/api/flights/search", SEARCH), ENV);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("serpapi-google-flights");
    expect(body.flights.length).toBeGreaterThan(0);
    // SerpApi 固有フィールドが漏れていない
    const text = JSON.stringify(body);
    expect(text).not.toContain("best_flights");
    expect(text).not.toContain("other_flights");
    expect(text).not.toContain("test-serp-key");
    // 対象航空会社のみ
    for (const flight of body.flights) {
      expect(["MM", "GK", "NH", "JL", "IJ"]).toContain(flight.airlineCode);
    }
  });

  it("結果0件でも 200 を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(SERPAPI_EMPTY)));
    const response = await worker.fetch(post("/api/flights/search", SEARCH), ENV);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.flights).toEqual([]);
  });

  it("2回目はキャッシュから返す（無料枠の節約）", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(SERPAPI_NRT_KIX));
    vi.stubGlobal("fetch", fetchMock);

    const first = await worker.fetch(post("/api/flights/search", SEARCH), ENV);
    expect((await first.json()).cache.isCached).toBe(false);

    const second = await worker.fetch(post("/api/flights/search", SEARCH), ENV);
    const body = await second.json();
    expect(body.cache.isCached).toBe(true);
    // 上流呼び出しは1回だけ
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("SerpApi 429 を上流エラーとして返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));
    const response = await worker.fetch(post("/api/flights/search", SEARCH), ENV);
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.error.code).toBe("upstream_quota");
  });

  it("SerpApi 5xx を上流エラーとして返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    const response = await worker.fetch(post("/api/flights/search", SEARCH), ENV);
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("upstream_unavailable");
  });

  it("枠切れ（200 + error）を quota として扱う", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(SERPAPI_QUOTA_ERROR)));
    const response = await worker.fetch(post("/api/flights/search", SEARCH), ENV);
    expect((await response.json()).error.code).toBe("upstream_quota");
  });

  it("タイムアウトでもデモへフォールバックしない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const response = await worker.fetch(post("/api/flights/search", SEARCH), ENV);
    const body = await response.json();
    expect(response.status).toBe(502);
    // 架空データを返していないこと
    expect(body.flights).toBeUndefined();
  });

  it("APIキー未設定なら not_configured を返す（デモへ切り替えない）", async () => {
    const response = await worker.fetch(post("/api/flights/search", SEARCH), {
      ...ENV,
      SERPAPI_API_KEY: undefined,
    });
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("not_configured");
  });

  it("不正な入力を拒否する", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const response = await worker.fetch(
      post("/api/flights/search", { origin: "XXX", destination: "KIX", date: "bad" }),
      ENV,
    );
    expect(response.status).toBe(400);
  });

  it("レート制限を超えると 429 を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(SERPAPI_NRT_KIX)));
    // 5回まで許可 → 6回目で 429（日付を変えてキャッシュを避ける）
    for (let index = 0; index < 5; index += 1) {
      await worker.fetch(post("/api/flights/search", { ...SEARCH, date: `2026-08-1${index}` }), ENV);
    }
    const blocked = await worker.fetch(
      post("/api/flights/search", { ...SEARCH, date: "2026-08-19" }),
      ENV,
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect((await blocked.json()).error.message).toContain("検索回数が多すぎます");
  });
});

describe("POST /api/flights/revalidate", () => {
  const identity = {
    airlineCode: "MM",
    flightNumber: "MM123",
    originAirport: "NRT",
    destinationAirport: "KIX",
    departureAt: "2026-08-10T07:30:00+09:00",
    arrivalAt: "2026-08-10T09:10:00+09:00",
  };

  it("価格が上がったら priceChanged と差額を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(SERPAPI_PRICE_UP)));
    const response = await worker.fetch(
      post("/api/flights/revalidate", {
        search: SEARCH,
        identity,
        previousPriceAmount: 8980,
      }),
      ENV,
    );
    const body = await response.json();
    expect(body.status).toBe("priceChanged");
    expect(body.previousAmount).toBe(8980);
    expect(body.currentAmount).toBe(10480);
    expect(body.deltaAmount).toBe(1500);
  });

  it("価格が下がった場合も検出する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          best_flights: [
            {
              flights: [
                {
                  departure_airport: { id: "NRT", time: "2026-08-10 07:30" },
                  arrival_airport: { id: "KIX", time: "2026-08-10 09:10" },
                  flight_number: "MM 123",
                },
              ],
              price: 7480,
            },
          ],
        }),
      ),
    );
    const response = await worker.fetch(
      post("/api/flights/revalidate", { search: SEARCH, identity, previousPriceAmount: 8980 }),
      ENV,
    );
    const body = await response.json();
    expect(body.status).toBe("priceChanged");
    expect(body.deltaAmount).toBe(-1500);
  });

  it("価格が同じなら unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(SERPAPI_NRT_KIX)));
    const response = await worker.fetch(
      post("/api/flights/revalidate", { search: SEARCH, identity, previousPriceAmount: 8980 }),
      ENV,
    );
    expect((await response.json()).status).toBe("unchanged");
  });

  it("結果が空なら soldOut を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(SERPAPI_EMPTY)));
    const response = await worker.fetch(
      post("/api/flights/revalidate", { search: SEARCH, identity, previousPriceAmount: 8980 }),
      ENV,
    );
    expect((await response.json()).status).toBe("soldOut");
  });

  it("同一便を特定できなければ notMatched を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(SERPAPI_NRT_KIX)));
    const response = await worker.fetch(
      post("/api/flights/revalidate", {
        search: SEARCH,
        identity: { ...identity, flightNumber: "MM999", departureAt: "2026-08-10T22:00:00+09:00" },
        previousPriceAmount: 8980,
      }),
      ENV,
    );
    const body = await response.json();
    expect(body.status).toBe("notMatched");
    expect(body.reason).toContain("再確認できませんでした");
  });

  it("再確認はキャッシュを使わず毎回ライブ取得する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(SERPAPI_NRT_KIX));
    vi.stubGlobal("fetch", fetchMock);
    const payload = { search: SEARCH, identity, previousPriceAmount: 8980 };
    await worker.fetch(post("/api/flights/revalidate", payload), ENV);
    await worker.fetch(post("/api/flights/revalidate", payload), ENV);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("POST /api/flights/booking-options", () => {
  it("Booking Options を DTO で返し、公式を先頭にする", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(BOOKING_OPTIONS_RAW)));
    const response = await worker.fetch(
      post("/api/flights/booking-options", { bookingToken: "token-mm123", search: SEARCH }),
      ENV,
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.options[0].isVerifiedOfficial).toBe(true);
    expect(JSON.stringify(body)).not.toContain("test-serp-key");
  });

  it("bookingToken が無ければ 400", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const response = await worker.fetch(
      post("/api/flights/booking-options", { search: SEARCH }),
      ENV,
    );
    expect(response.status).toBe(400);
  });

  it("0件なら理由を返す（公式ページへ誘導させる）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ booking_options: [] })));
    const response = await worker.fetch(
      post("/api/flights/booking-options", { bookingToken: "t", search: SEARCH }),
      ENV,
    );
    const body = await response.json();
    expect(body.options).toEqual([]);
    expect(body.unavailableReason).toContain("公式ページ");
  });
});

describe("POST /api/transit/search", () => {
  const transitInput = {
    originStationCode: "KAMATORI",
    destinationStationCode: "NRT-AIRPORT",
    arriveBy: "2026-08-10T06:20:00+09:00",
  };

  it("Google Routes 成功時に経路 DTO を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(ROUTES_KAMATORI_NRT)));
    const response = await worker.fetch(post("/api/transit/search", transitInput), ENV);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.availability.kind).toBe("available");
    expect(body.availability.routes.length).toBe(2);
    expect(JSON.stringify(body)).not.toContain("test-google-key");
  });

  it("経路0件はダイヤ未取得として返す（架空時刻を作らない）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(ROUTES_EMPTY)));
    const response = await worker.fetch(post("/api/transit/search", transitInput), ENV);
    const body = await response.json();
    expect(body.availability.kind).toBe("scheduleUnavailable");
    expect(body.availability.reason).toContain("まだ取得できません");
  });

  it("Routes 429 を上流エラーとして返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("quota", { status: 429 })));
    const response = await worker.fetch(post("/api/transit/search", transitInput), ENV);
    expect((await response.json()).error.code).toBe("upstream_quota");
  });

  it("Routes 5xx を上流エラーとして返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    const response = await worker.fetch(post("/api/transit/search", transitInput), ENV);
    expect((await response.json()).error.code).toBe("upstream_unavailable");
  });

  it("近い到着時刻はキャッシュを再利用する（15分バケット）", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(ROUTES_KAMATORI_NRT));
    vi.stubGlobal("fetch", fetchMock);
    await worker.fetch(post("/api/transit/search", transitInput), ENV);
    // 6分後の到着目標 → 同じ15分バケットなのでキャッシュヒット
    await worker.fetch(
      post("/api/transit/search", { ...transitInput, arriveBy: "2026-08-10T06:26:00+09:00" }),
      ENV,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("対応していない駅を拒否する", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const response = await worker.fetch(
      post("/api/transit/search", { ...transitInput, originStationCode: "TOKYO" }),
      ENV,
    );
    expect(response.status).toBe(400);
  });
});

describe("参照エンドポイント", () => {
  it("搭乗ルールを出典つきで返す", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/api/reference/boarding-rules", {
        headers: { Origin: "https://anemia111.github.io" },
      }),
      ENV,
    );
    const body = await response.json();
    expect(body.boardingRules.length).toBeGreaterThan(0);
    for (const rule of body.boardingRules) {
      expect(rule.officialSourceUrls.length).toBeGreaterThan(0);
      expect(rule.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("ターミナル情報を返す", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/api/reference/terminals", {
        headers: { Origin: "https://anemia111.github.io" },
      }),
      ENV,
    );
    const body = await response.json();
    expect(body.terminalAccess.length).toBeGreaterThan(0);
  });
});

describe("入力サイズ制限", () => {
  it("大きすぎるボディを拒否する", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const huge = { ...SEARCH, padding: "x".repeat(20000) };
    const response = await worker.fetch(post("/api/flights/search", huge), ENV);
    expect(response.status).toBe(413);
  });
});
