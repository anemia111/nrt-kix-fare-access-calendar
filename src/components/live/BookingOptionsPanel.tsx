"use client";

/**
 * 予約導線（Booking Options）の表示。
 *
 * - 検証済みの航空会社公式を最優先で示す
 * - ドメイン検証を通らない販売元を「公式」と表示しない
 * - 正式な購入URLが無い場合は、公式検索ページへ安全にフォールバックする
 *   （URLを推測して便指定リンクを作らない）
 */

import type { BookingOption, TargetAirlineCode } from "@shared/dto";
import { OFFICIAL_BOOKING_PAGES } from "@shared/airlineDomains";
import { EXTERNAL_LINK_ATTRIBUTES } from "@/lib/externalUrl";
import { ExternalIcon } from "@/components/ExternalLinkButton";

type Props = {
  airlineCode: TargetAirlineCode;
  airlineName: string;
  options: readonly BookingOption[];
  unavailableReason: string | null;
  fetchedAt: string;
};

function formatYen(amount: number, currency: string): string {
  return currency === "JPY" ? `¥${amount.toLocaleString("ja-JP")}` : `${amount} ${currency}`;
}

export function BookingOptionsPanel({
  airlineCode,
  airlineName,
  options,
  unavailableReason,
  fetchedAt,
}: Props) {
  const usable = options.filter((option) => option.handoff.kind !== "unavailable");
  const officialPage = OFFICIAL_BOOKING_PAGES[airlineCode];

  return (
    <section className="mt-3 rounded-lg border border-[var(--border)] p-3">
      <h4 className="text-sm font-bold">購入・予約</h4>

      {usable.length === 0 ? (
        <div className="mt-2">
          <p className="text-sm text-[var(--foreground-muted)]">
            {unavailableReason ??
              "この便の購入オプションを取得できませんでした。"}
          </p>
          {/* 便指定リンクは作らず、公式ページへ安全に案内する */}
          <a
            href={officialPage}
            target={EXTERNAL_LINK_ATTRIBUTES.target}
            rel={EXTERNAL_LINK_ATTRIBUTES.rel}
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-[var(--border)] px-4 text-sm font-bold hover:bg-[var(--surface-muted)]"
          >
            {airlineName}公式サイトで検索
            <ExternalIcon />
          </a>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">
            公式サイトで搭乗日・便・人数を入力し直してください。
          </p>
        </div>
      ) : (
        <ul className="mt-2 space-y-2">
          {usable.map((option, index) => (
            <li
              key={`${option.providerName}-${index}`}
              className="rounded-lg border border-[var(--border)] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{option.providerName}</span>
                {option.isVerifiedOfficial ? (
                  <span className="rounded-md bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white dark:bg-emerald-600">
                    <span aria-hidden="true">✔</span> 航空会社公式
                  </span>
                ) : (
                  <span className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--foreground-muted)]">
                    販売代理店
                  </span>
                )}
              </div>

              {option.price ? (
                <p className="mt-1 text-lg font-bold tabular-nums">
                  {formatYen(option.price.amount, option.price.currency)}
                </p>
              ) : (
                <p className="mt-1 text-sm text-[var(--foreground-muted)]">価格は遷移先で確認</p>
              )}

              {option.handoff.kind === "url" ? (
                <a
                  href={option.handoff.url}
                  target={EXTERNAL_LINK_ATTRIBUTES.target}
                  rel={EXTERNAL_LINK_ATTRIBUTES.rel}
                  className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800 dark:bg-blue-600"
                >
                  購入手続きへ進む
                  <ExternalIcon />
                </a>
              ) : null}

              {option.handoff.kind === "post" ? (
                // POST 遷移は form で送る（提供元が指定した方式）
                <form
                  action={option.handoff.endpoint}
                  method="POST"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2"
                >
                  {Object.entries(option.handoff.fields).map(([name, value]) => (
                    <input key={name} type="hidden" name={name} value={value} />
                  ))}
                  <button
                    type="submit"
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800 dark:bg-blue-600"
                  >
                    購入手続きへ進む
                    <ExternalIcon />
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-[var(--foreground-muted)]">
        購入オプション取得: {fetchedAt.slice(11, 16)} ／ 提供元: SerpApi / Google Flights
        <br />
        最終的な価格・空席・条件は遷移先の画面で必ず確認してください。
      </p>
    </section>
  );
}
