import { expect, test, type Page } from "@playwright/test";

/**
 * 実データモードの E2E。
 *
 * 実APIは叩かず、Worker のエンドポイントを Playwright の route で差し替える。
 * ビルド時に NEXT_PUBLIC_API_BASE_URL が設定されている場合のみ実行する。
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const liveConfigured = API_BASE.length > 0;

test.skip(!liveConfigured, "NEXT_PUBLIC_API_BASE_URL 未設定のためスキップ");

const FLIGHTS_RESPONSE = {
  flights: [
    {
      id: "MM|MM123|NRT|KIX|2026-08-10T07:30:00+09:00|2026-08-10T09:10:00+09:00",
      airlineCode: "MM",
      airlineName: "Peach Aviation",
      flightNumber: "MM123",
      departure: { airport: "NRT", terminal: null, scheduledAt: "2026-08-10T07:30:00+09:00" },
      arrival: { airport: "KIX", terminal: null, scheduledAt: "2026-08-10T09:10:00+09:00" },
      durationMinutes: 100,
      price: { amount: 8980, currency: "JPY" },
      bookingToken: "token-mm123",
      seatAvailability: { kind: "bookable", fetchedAt: "2026-08-01T10:24:00.000Z" },
      fetchedAt: "2026-08-01T10:24:00.000Z",
      expiresAt: null,
      source: "serpapi-google-flights",
    },
  ],
  cache: { isCached: false, cacheAgeSeconds: 0, fetchedAt: "2026-08-01T10:24:00.000Z" },
  source: "serpapi-google-flights",
  filteredOutCount: 2,
};

const TRANSIT_RESPONSE = {
  availability: {
    kind: "available",
    routes: [
      {
        id: "google-routes:0",
        departureAt: "2026-08-10T04:58:00+09:00",
        arrivalAt: "2026-08-10T06:05:00+09:00",
        durationMinutes: 67,
        transfers: 1,
        walkingMinutes: 9,
        fare: { amount: 1340, currency: "JPY" },
        legs: [
          {
            mode: "TRAIN",
            lineName: "外房線",
            departureStop: "鎌取",
            arrivalStop: "千葉",
            departureAt: "2026-08-10T04:58:00+09:00",
            arrivalAt: "2026-08-10T05:16:00+09:00",
          },
          {
            mode: "TRAIN",
            lineName: "成田線",
            departureStop: "千葉",
            arrivalStop: "成田空港",
            departureAt: "2026-08-10T05:25:00+09:00",
            arrivalAt: "2026-08-10T06:05:00+09:00",
          },
        ],
        source: "google-routes",
        fetchedAt: "2026-08-01T10:24:00.000Z",
      },
    ],
  },
  cache: { isCached: false, cacheAgeSeconds: 0, fetchedAt: "2026-08-01T10:24:00.000Z" },
  source: "google-routes",
};

type MockResponse = { status: number; body: unknown; delayMs?: number };
type MockMap = Record<string, MockResponse>;

/**
 * ページ内の window.fetch を差し替えてモックする。
 *
 * Playwright の route 差し替えはブラウザごとにクロスオリジンの扱いが異なり、
 * WebKit で安定しなかったため、ページ内で fetch を包む方式にした。
 * アプリ側のコード（apiClient → UI）はそのまま実行されるため、
 * 検証したい経路は変わらない。
 */
async function installFetchMock(page: Page, mocks: MockMap) {
  await page.addInitScript((serialized: string) => {
    const table = JSON.parse(serialized) as Record<
      string,
      { status: number; body: unknown; delayMs?: number }
    >;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const match = Object.keys(table).find((path) => url.includes(path));
      if (!match) return originalFetch(input as RequestInfo, init);

      const entry = table[match];
      if (entry.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, entry.delayMs));
      }
      return new Response(JSON.stringify(entry.body), {
        status: entry.status,
        headers: { "Content-Type": "application/json" },
      });
    };
  }, JSON.stringify(mocks));
}

const DEFAULT_REVALIDATE = {
  status: "unchanged",
  flight: FLIGHTS_RESPONSE.flights[0],
  checkedAt: "2026-08-01T10:30:00.000Z",
};

const DEFAULT_BOOKING = {
  options: [
    {
      providerName: "Peach",
      providerType: "airline",
      price: { amount: 8980, currency: "JPY" },
      handoff: { kind: "url", url: "https://www.flypeach.com/booking" },
      isVerifiedOfficial: true,
    },
  ],
  fetchedAt: "2026-08-01T10:30:00.000Z",
  unavailableReason: null,
};

async function mockApi(
  page: Page,
  overrides: {
    flights?: MockResponse;
    transit?: MockResponse;
    revalidate?: MockResponse;
    booking?: MockResponse;
  } = {},
) {
  await installFetchMock(page, {
    "/api/flights/search": overrides.flights ?? { status: 200, body: FLIGHTS_RESPONSE },
    "/api/transit/search": overrides.transit ?? { status: 200, body: TRANSIT_RESPONSE },
    "/api/flights/revalidate": overrides.revalidate ?? { status: 200, body: DEFAULT_REVALIDATE },
    "/api/flights/booking-options": overrides.booking ?? { status: 200, body: DEFAULT_BOOKING },
  });
}

async function search(page: Page, route = "NRT-KIX") {
  await page.goto(`/calendar/?route=${route}&date=2026-08-10&adults=1`);
  await page.getByRole("button", { name: "この条件で航空券を検索" }).click();
}

test.describe("実データ検索", () => {
  test("NRT→KIX の便と価格を表示する", async ({ page }) => {
    await mockApi(page);
    await search(page);
    // 便名と価格は実データ検索結果にしか出ない（公式情報セクションには無い）
    await expect(page.getByText("MM123").first()).toBeVisible();
    await expect(page.getByText("¥8,980").first()).toBeVisible();
    await expect(page.getByText(/実データ検索/)).toBeVisible();
  });

  test("KIX→NRT でも検索できる", async ({ page }) => {
    await mockApi(page);
    await search(page, "KIX-NRT");
    await expect(page.getByText("MM123").first()).toBeVisible();
  });

  test("空港到着目標と公共交通経路を表示する", async ({ page }) => {
    await mockApi(page);
    await search(page);
    await expect(page.getByText(/空港駅到着目標/).first()).toBeVisible();
    await expect(page.getByText(/推奨アクセス/).first()).toBeVisible();
    await expect(page.getByText(/04:58発/).first()).toBeVisible();
  });

  test("正確な残席数を表示しない", async ({ page }) => {
    await mockApi(page);
    await search(page);
    const body = await page.locator("main").innerText();
    expect(body).not.toMatch(/残り\d+席/);
    expect(body).toContain("現在予約候補あり");
  });

  test("再確認で価格変更を検知し、確認ダイアログを出す", async ({ page }) => {
    await mockApi(page, {
      revalidate: {
        status: 200,
        body: {
          status: "priceChanged",
          flight: FLIGHTS_RESPONSE.flights[0],
          previousAmount: 8980,
          currentAmount: 10480,
          deltaAmount: 1500,
          checkedAt: "2026-08-01T10:30:00.000Z",
        },
      },
    });
    await search(page);
    await page.getByRole("button", { name: "最新価格・予約可否を確認" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("価格が変更されました")).toBeVisible();
    await expect(dialog.getByText("¥10,480")).toBeVisible();
    await expect(dialog.getByText(/\+1,500円/)).toBeVisible();
    // 即座に外部サイトへ移動していないこと
    expect(page.url()).toContain("/calendar/");
  });

  test("新しい価格で続けると Booking Options を表示する", async ({ page }) => {
    await mockApi(page, {
      revalidate: {
        status: 200,
        body: {
          status: "priceChanged",
          flight: FLIGHTS_RESPONSE.flights[0],
          previousAmount: 8980,
          currentAmount: 10480,
          deltaAmount: 1500,
          checkedAt: "2026-08-01T10:30:00.000Z",
        },
      },
    });
    await search(page);
    await page.getByRole("button", { name: "最新価格・予約可否を確認" }).first().click();
    await page.getByRole("button", { name: "新しい価格で続ける" }).click();

    await expect(page.getByText("航空会社公式").first()).toBeVisible();
    const link = page.getByRole("link", { name: /購入手続きへ進む/ }).first();
    await expect(link).toHaveAttribute("href", /^https:\/\/www\.flypeach\.com/);
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("再確認ボタンは二重送信できない", async ({ page }) => {
    // 再確認だけ遅延させ、ローディング状態を観測できるようにする
    await mockApi(page, {
      revalidate: { status: 200, body: DEFAULT_REVALIDATE, delayMs: 800 },
    });
    await search(page);
    const button = page.getByRole("button", { name: "最新価格・予約可否を確認" }).first();
    await button.click();
    // 押下直後はボタンが消えてローディングになる（＝重ねて押せない）
    await expect(page.getByText("最新価格を確認しています…")).toBeVisible();
    await expect(button).toHaveCount(0);
  });

  test("航空券APIの障害でエラーを表示する（デモへ切り替えない）", async ({ page }) => {
    await mockApi(page, {
      flights: {
        status: 502,
        body: { error: { code: "upstream_unavailable", message: "接続できません" } },
      },
    });
    await search(page);
    await expect(page.getByText(/航空券検索サービスへ接続できませんでした/)).toBeVisible();
    // 架空の価格が出ていないこと
    const body = await page.locator("main").innerText();
    expect(body).not.toContain("¥8,980");
  });

  test("鉄道APIが失敗しても航空券結果は残る", async ({ page }) => {
    await mockApi(page, {
      transit: {
        status: 502,
        body: { error: { code: "upstream_unavailable", message: "取得不可" } },
      },
    });
    await search(page);
    await expect(page.getByText("Peach Aviation").first()).toBeVisible();
    await expect(page.getByText(/公共交通経路を取得できませんでした/).first()).toBeVisible();
  });

  test("429 のときは待機を促す", async ({ page }) => {
    await mockApi(page, {
      flights: {
        status: 429,
        body: { error: { code: "rate_limited", message: "多すぎます" } },
      },
    });
    await search(page);
    await expect(page.getByText(/検索回数が多すぎます/)).toBeVisible();
  });

  test("ダイヤ未取得なら架空時刻を出さない", async ({ page }) => {
    await mockApi(page, {
      transit: {
        status: 200,
        body: {
          availability: {
            kind: "scheduleUnavailable",
            reason: "この日の公共交通ダイヤはまだ取得できません",
          },
          cache: { isCached: false, cacheAgeSeconds: 0, fetchedAt: "2026-08-01T10:24:00.000Z" },
          source: "google-routes",
        },
      },
    });
    await search(page);
    await expect(page.getByText(/まだ取得できません/).first()).toBeVisible();
    const body = await page.locator("main").innerText();
    expect(body).not.toContain("04:58発");
  });

  test("375px で横スクロールが発生しない", async ({ page }) => {
    await mockApi(page);
    await search(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("コンソールエラーが出ない", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await mockApi(page);
    await search(page);
    await expect(page.getByText("Peach Aviation").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});
