import Link from "next/link";
import { DemoBanner } from "@/components/DemoBanner";
import { Disclaimer } from "@/components/Disclaimer";
import { DEFAULT_ROUTE_ID } from "@/domain/routes";

/**
 * デモモードのトップページ。
 * すべての画面上部にデモの常時警告を表示する（DemoBanner）。
 */
export const metadata = {
  title: "デモ | 成田⇄関空 フライト・空港アクセス計画",
};

const DEMO_BUTTONS = [
  {
    label: "デモの価格変動を確認",
    scenario: "price",
    description: "「公式サイトで価格・空席を確認」を押したときの価格再検証の動きを再現します。",
  },
  {
    label: "売り切れ時の表示を試す",
    scenario: "soldout",
    description: "満席・予約不可の便がカレンダーでどう表示されるかを確認できます。",
  },
  {
    label: "デモの公式サイト遷移を確認",
    scenario: "official",
    description: "公式サイトへ進む前の確認画面と、条件コピーの動きを確認できます。",
  },
] as const;

export default function DemoHome() {
  return (
    <>
      <DemoBanner detailed />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <header className="text-center">
          <h1 className="text-2xl font-bold leading-snug">デモモード</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
            機能の動きを確認するためのデモです。価格・空席・列車時刻は実際の情報ではありません。
            実際の計画には
            <Link href="/" className="text-blue-700 underline underline-offset-2 dark:text-blue-400">
              実用モード
            </Link>
            をご利用ください。
          </p>
        </header>

        <div className="flex flex-col gap-3">
          {DEMO_BUTTONS.map((button) => (
            <Link
              key={button.scenario}
              href={`/demo/calendar/?route=${DEFAULT_ROUTE_ID}&scenario=${button.scenario}`}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-blue-600"
            >
              <span className="block text-lg font-bold">{button.label}</span>
              <span className="mt-1 block text-sm text-[var(--foreground-muted)]">
                {button.description}
              </span>
            </Link>
          ))}
        </div>

        <Link
          href={`/demo/calendar/?route=${DEFAULT_ROUTE_ID}`}
          className="flex min-h-14 items-center justify-center rounded-2xl bg-blue-700 px-6 py-4 text-center text-lg font-bold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          デモの最安値カレンダーを開く
        </Link>

        <Disclaimer />
      </main>
    </>
  );
}
