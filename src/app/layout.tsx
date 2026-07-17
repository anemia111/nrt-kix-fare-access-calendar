import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "成田⇄関空 最安値・空港アクセスカレンダー",
  description:
    "成田空港と関西国際空港を結ぶ航空便の日付ごとの最安値、空席状況、航空会社公式サイトへの導線、出発空港までの推奨列車を確認できます。デモデータで動作しています。",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 拡大を禁止しない（アクセシビリティ）
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
