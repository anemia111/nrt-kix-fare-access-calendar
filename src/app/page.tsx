import Link from "next/link";
import { DemoBanner } from "@/components/DemoBanner";
import { Disclaimer } from "@/components/Disclaimer";
import { DEFAULT_ROUTE_ID, ROUTES, CALENDAR_DAYS } from "@/domain/routes";
import { SELECTABLE_TIME_PERIOD_DEFINITIONS } from "@/domain/timePeriods";

/**
 * トップページ（要件3）。
 *
 * 細かな検索フォームは表示しない。大きなボタン1つで、既定条件のまま
 * 最安値カレンダーへ進める。
 */
export default function Home() {
  return (
    <>
      <DemoBanner detailed />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
        <header className="text-center">
          <h1 className="text-2xl font-bold leading-snug sm:text-3xl">
            成田⇄関空
            <br />
            最安値・空港アクセスカレンダー
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
            日付ごとの最安値と空席状況を確認し、航空会社公式サイトへ進めます。
            出発空港へ向かう推奨列車と、遅くとも乗る必要がある列車も表示します。
          </p>
        </header>

        {/* 要件3: 大きく目立つボタン1つ。押すとすぐカレンダーを表示する。 */}
        <Link
          href={`/calendar/?route=${DEFAULT_ROUTE_ID}`}
          className="flex min-h-16 items-center justify-center rounded-2xl bg-blue-700 px-6 py-5 text-center text-xl font-bold text-white shadow-lg transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          最安値カレンダーを表示
        </Link>

        <section
          aria-labelledby="conditions-heading"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <h2 id="conditions-heading" className="text-sm font-bold">
            初期表示の条件
          </h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-[var(--foreground-muted)]">路線</dt>
            <dd>{ROUTES[DEFAULT_ROUTE_ID].fullLabelJa}</dd>
            <dt className="text-[var(--foreground-muted)]">人数</dt>
            <dd>大人1名</dd>
            <dt className="text-[var(--foreground-muted)]">旅程</dt>
            <dd>片道・エコノミークラス・直行便を優先</dd>
            <dt className="text-[var(--foreground-muted)]">オプション</dt>
            <dd>座席指定なし・預け荷物なし</dd>
            <dt className="text-[var(--foreground-muted)]">時間帯</dt>
            <dd>
              {SELECTABLE_TIME_PERIOD_DEFINITIONS.map((definition) => definition.labelJa).join(
                "・",
              )}
              （すべて対象）
            </dd>
            <dt className="text-[var(--foreground-muted)]">期間</dt>
            <dd>本日から{CALENDAR_DAYS}日先まで</dd>
            <dt className="text-[var(--foreground-muted)]">通貨</dt>
            <dd>日本円</dd>
          </dl>
        </section>

        <section
          aria-labelledby="access-heading"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <h2 id="access-heading" className="text-sm font-bold">
            空港アクセスの前提
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-[var(--foreground-muted)]">
            <li>成田発の便: 鎌取駅から成田空港までの列車を表示します。</li>
            <li>関空発の便: 和歌山駅から関西空港までの列車を表示します。</li>
          </ul>
        </section>

        <p className="text-center text-sm text-[var(--foreground-muted)]">
          このアプリでは航空券の決済や予約確定は行いません。
        </p>

        <Disclaimer />
      </main>
    </>
  );
}
