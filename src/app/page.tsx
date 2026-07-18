import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import { SITE_NAME } from "@/domain/siteConfig";
import { DEFAULT_ROUTE_ID, ROUTES } from "@/domain/routes";

/**
 * 実用モードのトップページ。
 *
 * 実価格APIが無いため名称に「最安値」は含めない。架空の価格・便時刻は扱わず、
 * 公式に確認できる情報（対応航空会社・ターミナル・搭乗締切・空港到着目標）で
 * 出発計画を立てるためのツールとして案内する。
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-bold leading-snug sm:text-3xl">{SITE_NAME}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
          成田空港と関西国際空港を結ぶ便について、対応航空会社の公式予約サイト、
          出発空港のターミナルと最寄り駅、公式の搭乗締切、空港到着目標を確認できます。
        </p>
      </header>

      <div
        role="note"
        className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm"
      >
        <p className="font-bold">このアプリで分かること・分からないこと</p>
        <ul className="mt-2 space-y-1 text-[var(--foreground-muted)]">
          <li>◎ 対応航空会社の公式予約サイトへの導線</li>
          <li>◎ ターミナル・最寄り空港駅・駅からの移動時間</li>
          <li>◎ 公式の搭乗締切と、それに基づく空港到着目標</li>
          <li>△ 価格・空席・便の時刻は表示しません（公式サイトでご確認ください）</li>
        </ul>
      </div>

      <Link
        href={`/calendar/?route=${DEFAULT_ROUTE_ID}`}
        className="flex min-h-16 items-center justify-center rounded-2xl bg-blue-700 px-6 py-5 text-center text-xl font-bold text-white shadow-lg hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
      >
        出発計画をはじめる
      </Link>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-bold">対応路線</h2>
        <ul className="mt-2 space-y-1 text-sm text-[var(--foreground-muted)]">
          <li>{ROUTES["NRT-KIX"].fullLabelJa}（鎌取駅から成田空港）</li>
          <li>{ROUTES["KIX-NRT"].fullLabelJa}（和歌山駅から関西空港）</li>
        </ul>
      </section>

      <section className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm">
        <h2 className="font-bold">機能を試したい方へ</h2>
        <p className="mt-1 text-[var(--foreground-muted)]">
          価格変動・売り切れ表示・公式サイト遷移などの動きは、デモモードで確認できます。
          デモの価格・空席・列車時刻は実際の情報ではありません。
        </p>
        <Link
          href="/demo/"
          className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-bold hover:bg-[var(--surface-muted)]"
        >
          デモモードを見る
        </Link>
      </section>

      <p className="text-center text-sm text-[var(--foreground-muted)]">
        このアプリでは航空券の決済や予約確定は行いません。
      </p>

      <Disclaimer />
    </main>
  );
}
