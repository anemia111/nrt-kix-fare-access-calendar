import { DEMO_NOTICE_BODY, DEMO_NOTICE_TITLE } from "@/providers";

/**
 * デモデータであることの表示（要件34）。
 *
 * デモデータを実データと誤認させてはいけないため、常に目立つ位置に表示し、
 * 閉じられないようにしている。
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
          <p className="font-bold">{DEMO_NOTICE_TITLE}</p>
          <p>{DEMO_NOTICE_BODY}</p>
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
                  これらを入力とする搭乗締切の計算も実際に行っています。
                </p>
                <p>
                  なお、成田⇄関空の直行便を実際に運航しているのは Peach と
                  ジェットスター・ジャパンのみです。ANA・JAL の便は、LCC と FSC で
                  計算が変わることを確認できるようにするためデモデータにのみ含めています。
                </p>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
