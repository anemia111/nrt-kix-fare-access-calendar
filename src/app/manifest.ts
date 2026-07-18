import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/domain/siteConfig";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// 静的エクスポートでビルド時に生成する。
export const dynamic = "force-static";

/**
 * PWA マニフェスト。GitHub Pages の basePath 配下でも動くよう、
 * アイコンや起動URLに basePath を付ける。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "成田⇄関空計画",
    description: SITE_DESCRIPTION,
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#0d1117",
    theme_color: "#1d4ed8",
    lang: "ja",
    icons: [
      {
        src: `${basePath}/icon.svg`,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: `${basePath}/icon-maskable.svg`,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
