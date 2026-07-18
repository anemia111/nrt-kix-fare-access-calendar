import { Suspense } from "react";
import Link from "next/link";
import { PlanView } from "@/components/production/PlanView";
import { Disclaimer } from "@/components/Disclaimer";

export const metadata = {
  title: "出発計画 | 成田⇄関空 フライト・空港アクセス計画",
};

/**
 * 実用モードの計画ページ。架空の便・価格・空席・列車時刻は表示しない。
 */
export default function CalendarPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm text-blue-700 underline underline-offset-2 dark:text-blue-400"
        >
          ← トップへ戻る
        </Link>
      </div>
      <Suspense fallback={<PlanFallback />}>
        <PlanView />
      </Suspense>
      <div className="mx-auto w-full max-w-2xl px-4 pb-8">
        <Disclaimer />
      </div>
    </main>
  );
}

function PlanFallback() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-5">
      <p className="text-sm text-[var(--foreground-muted)]">検索フォームを準備しています…</p>
      <div className="mt-4 space-y-3">
        <div className="skeleton h-64 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    </div>
  );
}
