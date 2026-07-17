/**
 * README 用のスクリーンショットを撮り直すスクリプト。
 *
 * 使い方:
 *   npm run dev            # 別ターミナルで起動しておく
 *   node scripts/screenshots.mjs
 *
 * 既定では http://localhost:3000 を見る。ポートを変える場合は BASE_URL を指定する。
 */

import { chromium, devices } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../docs");

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
// iPhone のビューポートで撮る（スマートフォン優先のUIのため）。
// エンジンは chromium のままでよい（見た目の確認が目的）。
const iphone = devices["iPhone 15"];
const context = await browser.newContext({
  viewport: iphone.viewport,
  deviceScaleFactor: iphone.deviceScaleFactor,
  isMobile: iphone.isMobile,
  hasTouch: iphone.hasTouch,
  userAgent: iphone.userAgent,
});
const page = await context.newPage();

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(OUT, "screenshot-top.png") });
console.log("撮影: screenshot-top.png");

await page.goto(`${BASE}/calendar/?route=NRT-KIX`, { waitUntil: "networkidle" });
await page.waitForSelector("section button[aria-label]");
await page.screenshot({ path: path.join(OUT, "screenshot-calendar.png") });
console.log("撮影: screenshot-calendar.png");

await page.locator('button[aria-label*="の便の詳細を表示"]').nth(3).click();
await page.waitForSelector('[role="dialog"] article');
await page.waitForTimeout(800);
const dialog = page.locator('[role="dialog"]');
// このアプリの中心は「推奨列車」なので、それが見える位置を撮る。
await dialog.locator("h5", { hasText: "推奨列車" }).first().scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, "screenshot-detail.png") });
console.log("撮影: screenshot-detail.png");

await browser.close();
