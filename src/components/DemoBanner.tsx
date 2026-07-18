import { DEMO_PERSISTENT_NOTICE } from "@/domain/siteConfig";

/**
 * デモデータであることの常時表示（要件34）。
 *
 * デモモードのすべての画面上部に常時表示する。閉じられない。
 */
export function DemoBanner({ detailed = false }: { detailed?: boolean }) {
  return (
    <div
      role="status"
      className="border-b-2 border-amber-500 bg-amber-100 px-4 py-3 text-amber-950 dark:bg-amber-950 dark:text-amber-100"
    >
      <div className="mx-auto flex max-w-4xl items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 text-lg leading-none">
          ⚠
        </span>
        <div className="text-sm leading-relaxed">
          <p className="font-bold">{DEMO_PERSISTENT_NOTICE}</p>
          {detailed ? (
            <details className="mt-2">
              <summary className="cursor-pointer underline underline-offset-2">
                どこがデモで、どこが実データか
              </summary>
              <div className="mt-2 space-y-2">
                <p>
                  <strong>デモ（架空）:</strong>{" "}
                  航空券の価格・料金内訳・空席数、列車の個別の発車／到着時刻・運賃。
                  無料で取得できる提供元が存在しないためです。
                </p>
                <p>
                  <strong>実データ:</strong>{" "}
                  航空会社の搭乗締切・チェックイン条件、ターミナルと最寄駅の対応、
                  駅からの移動時間、航空会社公式サイトのURL。いずれも各社・各空港の
                  公式サイトを情報源とし、出典と最終確認日を保持しています。
                </p>
                <p>
                  実際の計画には、上部メニューの「実用モード」をご利用ください。
                  実用モードでは架空データを一切表示しません。
                </p>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
