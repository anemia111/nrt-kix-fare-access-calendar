import { Suspense } from "react";
import Link from "next/link";
import { CalendarView } from "@/components/CalendarView";
import { DemoBanner } from "@/components/DemoBanner";
import { Disclaimer } from "@/components/Disclaimer";

export const metadata = {
  title: "デモ最安値カレンダー | 成田⇄関空",
};

/**
 * デモモードの最安値カレンダー。
 * ここで表示する価格・空席・列車時刻はすべて架空のデモデータ。
 */
export default function DemoCalendarPage() {
  return (
    <>
      <DemoBanner />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 pt-4">
          <Link
            href="/demo/"
            className="inline-flex min-h-11 items-center text-sm text-blue-700 underline underline-offset-2 dark:text-blue-400"
          >
            ← デモトップへ戻る
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
