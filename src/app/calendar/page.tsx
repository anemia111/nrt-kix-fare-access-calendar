import { Suspense } from "react";
import Link from "next/link";
import { CalendarView } from "@/components/CalendarView";
import { DemoBanner } from "@/components/DemoBanner";
import { Disclaimer } from "@/components/Disclaimer";

export const metadata = {
  title: "最安値カレンダー | 成田⇄関空",
};

/**
 * 最安値カレンダーのページ。
 *
 * `useSearchParams` を使う部分は静的エクスポートでプリレンダリングできないため、
 * Suspense で包んでクライアント側で解決させる。
 */
export default function CalendarPage() {
  return (
    <>
      <DemoBanner />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 pt-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm text-blue-700 underline underline-offset-2 dark:text-blue-400"
          >
            ← トップへ戻る
          </Link>
        </div>
        <Suspense fallback={<CalendarFallback />}>
          <CalendarView />
        </Suspense>
        <div className="mx-auto w-full max-w-4xl px-4 pb-8">
          <Disclaimer />
        </div>
      </main>
    </>
  );
}

function CalendarFallback() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5">
      <p className="text-sm text-[var(--foreground-muted)]">カレンダーを準備しています…</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="skeleton min-h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
