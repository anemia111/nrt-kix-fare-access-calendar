import { expect, test } from "@playwright/test";

/**
 * E2E テスト。静的エクスポートの出力（out/）をそのまま配信して、
 * 本番と同じ成果物を検証する。
 */

test.describe("トップページ", () => {
  test("デモである旨を必ず表示する", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("現在はデモデータを表示しています。")).toBeVisible();
    await expect(
      page.getByText("実際の航空券価格、空席、列車時刻ではありません。"),
    ).toBeVisible();
  });

  test("大きなボタン1つでカレンダーへ進める（検索フォームを表示しない）", async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("link", { name: "最安値カレンダーを表示" });
    await expect(button).toBeVisible();

    // 細かな検索フォームを表示しない（要件3）
    await expect(page.locator("input[type=date]")).toHaveCount(0);
    await expect(page.locator("select")).toHaveCount(0);

    await button.click();
    await expect(page).toHaveURL(/\/calendar\/\?route=NRT-KIX/);
  });
});

test.describe("最安値カレンダー", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calendar/?route=NRT-KIX");
    await expect(page.getByRole("heading", { name: /2026年/ }).first()).toBeVisible();
  });

  test("既定で成田→関空・全時間帯が選択されている", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "成田 → 関空" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    for (const label of ["朝", "昼", "夜"]) {
      await expect(page.getByRole("button", { name: new RegExp(`^${label}`) })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
  });

  test("路線を切り替えるとURLが変わり、データだけが更新される", async ({ page }) => {
    await page.getByRole("tab", { name: "関空 → 成田" }).click();
    await expect(page).toHaveURL(/route=KIX-NRT/);
    await expect(page.getByRole("tab", { name: "関空 → 成田" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("heading", { name: /関西国際空港（KIX） → 成田国際空港（NRT）/ }),
    ).toBeVisible();
  });

  test("入替ボタンで出発地と到着地が入れ替わる", async ({ page }) => {
    await page.getByRole("button", { name: "出発地と到着地を入れ替える" }).click();
    await expect(page).toHaveURL(/route=KIX-NRT/);
    await page.getByRole("button", { name: "出発地と到着地を入れ替える" }).click();
    await expect(page).toHaveURL(/route=NRT-KIX/);
  });

  test("時間帯を切り替えるとURLに保存される", async ({ page }) => {
    await page.getByRole("button", { name: /^昼/ }).click();
    await expect(page).toHaveURL(/periods=morning%2Cevening|periods=morning,evening/);
    await expect(page.getByRole("button", { name: /^昼/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("すべての時間帯を未選択にはできない", async ({ page }) => {
    await page.getByRole("button", { name: /^昼/ }).click();
    await page.getByRole("button", { name: /^夜/ }).click();
    // 残り1つ（朝）を外そうとしても選択が維持される
    await page.getByRole("button", { name: /^朝/ }).click();
    await expect(page.getByRole("button", { name: /^朝/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("URLの条件を復元する", async ({ page }) => {
    await page.goto("/calendar/?route=KIX-NRT&periods=evening");
    await expect(page.getByRole("tab", { name: "関空 → 成田" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("button", { name: /^夜/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: /^朝/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("横スクロールが発生しない", async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});

test.describe("日付詳細", () => {
  test("日付をタップすると便の詳細と空港アクセスが表示される", async ({ page }) => {
    await page.goto("/calendar/?route=NRT-KIX");
    await page
      .getByRole("button", { name: /の便の詳細を表示$/ })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("空港アクセス").first()).toBeVisible();
    // 鎌取駅からの経路であることを明示している
    await expect(dialog.getByText(/鎌取駅/).first()).toBeVisible();
  });

  test("公式サイトのリンクが航空会社の公式ドメインを指し、安全な属性を持つ", async ({ page }) => {
    await page.goto("/calendar/?route=NRT-KIX");
    await page
      .getByRole("button", { name: /の便の詳細を表示$/ })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "最新価格を確認して公式サイトへ進む" })
      .first()
      .click();

    // 価格再検証のあと、公式サイトへ進むリンクが必ず出る
    await expect(
      dialog.getByRole("link", { name: /公式サイト|空席状況を確認|更新後の価格/ }).first(),
    ).toBeVisible();

    // アコーディオン内の出典リンクも含め、すべての外部リンクを検証する
    const externalLinks = dialog.locator('a[target="_blank"]');
    const count = await externalLinks.count();
    expect(count).toBeGreaterThan(0);
    const allowed = [
      "flypeach.com",
      "jetstar.com",
      "ana.co.jp",
      "jal.co.jp",
      "ch.com",
      "jreast.co.jp",
      "westjr.co.jp",
      "narita-airport.jp",
      "kansai-airport.or.jp",
    ];

    for (let index = 0; index < count; index += 1) {
      const link = externalLinks.nth(index);
      const href = await link.getAttribute("href");
      const rel = await link.getAttribute("rel");
      expect(href).toBeTruthy();
      // https のみ
      expect(href!.startsWith("https://")).toBe(true);
      expect(rel).toContain("noopener");
      expect(rel).toContain("noreferrer");
      // 許可済みドメインのみ
      const host = new URL(href!).hostname;
      expect(allowed.some((domain) => host === domain || host.endsWith(`.${domain}`))).toBe(true);
    }
  });

  test("予約確定と誤解させる表現を使わない", async ({ page }) => {
    await page.goto("/calendar/?route=NRT-KIX");
    await page
      .getByRole("button", { name: /の便の詳細を表示$/ })
      .first()
      .click();
    const text = await page.getByRole("dialog").innerText();
    for (const forbidden of ["この価格で予約", "予約確定", "席を確保", "最安値保証"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  test("Escapeで閉じられる", async ({ page }) => {
    await page.goto("/calendar/?route=NRT-KIX");
    await page
      .getByRole("button", { name: /の便の詳細を表示$/ })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("静的APIエンドポイント", () => {
  test("ヘルスチェックがデモモードを返す", async ({ request }) => {
    const response = await request.get("/api/health.json");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.dataMode).toBe("demo");
    expect(body.supportedRoutes).toEqual(["NRT-KIX", "KIX-NRT"]);
  });

  test("航空会社ルールが出典URLと最終確認日を含む", async ({ request }) => {
    const response = await request.get("/api/airlines.json");
    const body = await response.json();
    expect(body.boardingRules.length).toBeGreaterThan(0);
    for (const rule of body.boardingRules) {
      expect(rule.officialSourceUrls.length).toBeGreaterThan(0);
      expect(rule.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("APIキーなど秘密情報を含まない", async ({ request }) => {
    for (const path of ["/api/health.json", "/api/airlines.json", "/api/terminals.json"]) {
      const text = await (await request.get(path)).text();
      expect(text.toLowerCase()).not.toContain("api_key");
      expect(text.toLowerCase()).not.toContain("apikey");
      expect(text.toLowerCase()).not.toContain("secret");
    }
  });
});
