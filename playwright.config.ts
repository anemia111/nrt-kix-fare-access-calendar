import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    // スマートフォン優先の要件のため iPhone を既定に含める
    { name: "iPhone 15", use: { ...devices["iPhone 15"] } },
    { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"] } },
  ],
  // 静的エクスポートの出力をそのまま配信して本番と同じ成果物を検証する
  webServer: {
    command: `npx serve out -l ${PORT} --no-clipboard`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
