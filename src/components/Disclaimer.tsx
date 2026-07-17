/**
 * 免責表示（要件47）。
 *
 * 搭乗や価格を保証する表現は使わない。利用者が公式情報を確認する必要があることを
 * 明確に伝える。
 */

const ITEMS: readonly string[] = [
  "航空券の価格は頻繁に変動します。表示価格は取得時点の参考価格です。",
  "予約が完了するまで価格は保証されません。",
  "空席表示は、航空会社の実在庫と完全に一致しない場合があります。",
  "手荷物料金や座席指定料金が別途発生する場合があります。",
  "最終的な価格は、必ず航空会社公式サイトで確認してください。",
  "列車時刻は取得時点の情報です。ダイヤ変更、遅延、運休が発生する場合があります。",
  "航空会社の搭乗締切は変更される場合があります。",
  "空港内の混雑状況は予測と異なる場合があります。",
  "推奨列車は搭乗を保証するものではありません。",
  "出発前に、航空会社・空港・鉄道会社の公式情報を必ず確認してください。",
  "十分な余裕を持って移動してください。",
];

export function Disclaimer({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <details
      open={defaultOpen}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <summary className="cursor-pointer text-sm font-bold">
        ご利用にあたっての注意（免責事項）
      </summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[var(--foreground-muted)]">
        {ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </details>
  );
}

export const DISCLAIMER_ITEMS = ITEMS;
