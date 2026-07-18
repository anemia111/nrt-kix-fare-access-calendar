import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { AppChrome } from "@/components/AppChrome";
import { SITE_DESCRIPTION, SITE_NAME } from "@/domain/siteConfig";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  // <link rel="manifest"> は app/manifest.ts から自動で挿入される（basePath込み）。
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1d4ed8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <AppChrome />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
