import type { NextConfig } from "next";

/**
 * GitHub Pages はプロジェクトサイトを /<repo>/ 配下で配信するため basePath が必要。
 * ローカル開発と Playwright では未設定にして / で動かす。
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // 静的エクスポート。GitHub Pages にはサーバーランタイムが無いため。
  output: "export",
  basePath,
  trailingSlash: true,
  images: {
    // 静的エクスポートでは既定の画像最適化ローダー（サーバー必須）を使えない。
    unoptimized: true,
  },
  reactStrictMode: true,
};

export default nextConfig;
