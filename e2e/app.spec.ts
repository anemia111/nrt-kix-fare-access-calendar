import { expect, test } from "@playwright/test";

/**
 * E2E テスト。静的エクスポートの出力（out/）をそのまま配信して検証する。
 * 本番モード（/, /calendar/）とデモモード（/demo/, /demo/calendar/）を分けて確認する。
 */

test.describe("実用モード（トップ）", () => {
  test("名称に「最安値」を含まない", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/フライト・空港アクセス計画/);
    const heading = await page.getByRole("heading", { level: 1 }).innerText();
    expect(heading).not.toContain("最安値");
  });

  test("計画をはじめるボタンで実用モードへ進む", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "出発計画をはじめる" }).click();
    await expect(page).toHaveURL(/\/calendar\//);
  });
});

test.describe("実用モード（計画）", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calendar/?route=NRT-KIX");
    await expect(page.getByRole("heading", { name: /成田国際空港/ }).first()).toBeVisible();
  });

  test("架空の価格・空席・便時刻・便名を表示しない", async ({ page }) => {
    const body = await page.locator("main").innerText();
    // デモの価格・空席・便名の痕跡が無いこと
    expect(body).not.toMatch(/\d+,\d{3}円/); // 8,940円 のような価格
    expect(body).not.toMatch(/残り\d+席/);
    expect(body).not.toContain("空席あり");
    expect(body).not.toContain("満席");
    expect(body).not.toMatch(/GK\d{3}/); // 便名
    expect(body).not.toMatch(/MM\d{3}/);
  });

  test("対応航空会社（Peach・ジェットスター）を公式情報付きで表示する", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Peach Aviation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ジェットスター・ジャパン" })).toBeVisible();
    // 出所と最終確認日
    await expect(page.getByText(/最終確認日/).first()).toBeVisible();
  });

  test("出発時刻を入力すると空港到着目標が出る", async ({ page }) => {
    await page.locator('input[type="time"]').fill("08:15");
    await expect(page.getByText(/空港到着目標/).first()).toBeVisible();
    await expect(page.getByText(/までに成田空港駅/).first()).toBeVisible();
  });

  test("公式サイト確認は確認画面を経由し、条件引き継ぎ済みと偽らない", async ({ page }) => {
    await page.getByRole("button", { name: "公式サイトで価格・空席を確認" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // ディープリンク非対応の明示
    await expect(dialog.getByText(/ディープリンクを公開していないため/)).toBeVisible();
    // コピーボタン
    await expect(dialog.getByRole("button", { name: "検索条件をコピー" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "日付をコピー" })).toBeVisible();
    // 実データの便名が無いので便名コピーは出さない
    await expect(dialog.getByRole("button", { name: "便名をコピー" })).toHaveCount(0);
    // 公式サイトを開くリンクは安全属性つき
    const link = dialog.getByRole("link", { name: /公式サイトを開く/ });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toHaveAttribute("href", /^https:\/\/(www\.)?flypeach\.com/);
  });

  test("コピーでトーストが出る", async ({ page }) => {
    await page.getByRole("button", { name: "公式サイトで価格・空席を確認" }).first().click();
    await page.getByRole("button", { name: "検索条件をコピー" }).click();
    await expect(page.getByText(/コピーしました|コピーできませんでした/).first()).toBeVisible();
  });

  test("URLの条件を復元する", async ({ page }) => {
    await page.goto("/calendar/?route=KIX-NRT&adults=3&bag=1&dep=07:45");
    await expect(page.getByRole("tab", { name: "関空 → 成田" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator('input[type="number"]')).toHaveValue("3");
    await expect(page.locator('input[type="time"]')).toHaveValue("07:45");
  });

  test("横スクロールが発生しない（375px）", async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("キーボードで確認画面を開閉できる", async ({ page }) => {
    const button = page.getByRole("button", { name: "公式サイトで価格・空席を確認" }).first();
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("デモモード", () => {
  test("デモトップに常時警告と3つのデモボタンがある", async ({ page }) => {
    await page.goto("/demo/");
    await expect(
      page.getByText("機能確認用のデモです。価格・空席・列車時刻は実際の情報ではありません"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "デモの価格変動を確認" })).toBeVisible();
    await expect(page.getByRole("link", { name: "売り切れ時の表示を試す" })).toBeVisible();
    await expect(page.getByRole("link", { name: "デモの公式サイト遷移を確認" })).toBeVisible();
  });

  test("デモカレンダーは常時警告を表示し、価格を出す", async ({ page }) => {
    await page.goto("/demo/calendar/?route=NRT-KIX");
    await expect(
      page.getByText("機能確認用のデモです。価格・空席・列車時刻は実際の情報ではありません"),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /2026年/ }).first()).toBeVisible();
  });

  test("日付詳細から確認画面を開ける（デモ）", async ({ page }) => {
    await page.goto("/demo/calendar/?route=NRT-KIX");
    await page.getByRole("button", { name: /の便の詳細を表示$/ }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    // 最初の便カードに限定して操作する
    const firstCard = drawer.locator("article").first();
    // 初回CTA → デモの価格再検証
    await firstCard.getByRole("button", { name: "公式サイトで価格・空席を確認" }).click();
    await expect(firstCard.getByText(/（デモ）/).first()).toBeVisible();
    // 結果の「公式サイトへ進む」系ボタン → 確認画面
    await firstCard.getByRole("button", { name: /公式サイト/ }).last().click();
    await expect(page.getByText(/ディープリンクを公開していないため/)).toBeVisible();
  });

  test("予約確定と誤解させる表現を使わない", async ({ page }) => {
    await page.goto("/demo/calendar/?route=NRT-KIX");
    await page.getByRole("button", { name: /の便の詳細を表示$/ }).first().click();
    const text = await page.getByRole("dialog").innerText();
    for (const forbidden of ["この価格で予約", "予約確定", "席を確保", "最安値保証"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

test.describe("静的APIエンドポイント", () => {
  test("ヘルスチェックがデモモードを返す", async ({ request }) => {
    const response = await request.get("/api/health.json");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.supportedRoutes).toEqual(["NRT-KIX", "KIX-NRT"]);
  });

  test("秘密情報を含まない", async ({ request }) => {
    for (const path of ["/api/health.json", "/api/airlines.json", "/api/terminals.json"]) {
      const text = await (await request.get(path)).text();
      expect(text.toLowerCase()).not.toContain("api_key");
      expect(text.toLowerCase()).not.toContain("secret");
    }
  });

  test("PWA マニフェストが配信される", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.name).toContain("成田");
    expect(Array.isArray(body.icons)).toBe(true);
  });
});
