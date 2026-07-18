"use client";

/**
 * 実用モードの本体。検索条件フォームと、公式情報のみの結果を表示する。
 * 架空の便・価格・空席・列車時刻は扱わない。
 *
 * - 検索条件は URL クエリと LocalStorage に保存し、共有・復元できる
 * - Web Share API で条件付きURLを共有できる
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  parsePlanConditions,
  serializePlanConditions,
  type PlanSearchConditions,
} from "@/domain/planSearch";
import { ROUTES } from "@/domain/routes";
import { buildPlan } from "@/services/planInfo";
import {
  getRecentServerSnapshot,
  getRecentSnapshot,
  saveRecentSearch,
  subscribeRecent,
} from "@/lib/recentSearches";
import { shareUrl } from "@/lib/share";
import { formatMonthDay, todayInJst, weekdayLabel } from "@/lib/time";
import { holidayNameOf } from "@/domain/holidays";
import { PlanForm } from "./PlanForm";
import { CarrierPlanCard } from "./CarrierPlanCard";
import { useToast } from "@/components/Toast";

// セッション開始時刻（描画中に Date.now を呼ばないよう、モジュール評価時に一度だけ）。
const SESSION_CALCULATED_AT = `${new Date(Date.now() + 9 * 3600_000)
  .toISOString()
  .slice(0, 19)}+09:00`;

export function PlanView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const today = useMemo(() => todayInJst(), []);
  const conditions = useMemo(
    () => parsePlanConditions(new URLSearchParams(searchParams.toString()), today),
    [searchParams, today],
  );

  // 最近の検索条件は外部ストア（LocalStorage）として購読する
  const recent = useSyncExternalStore(
    subscribeRecent,
    getRecentSnapshot,
    getRecentServerSnapshot,
  );

  // 条件が変わるたびに LocalStorage へ保存（保存時にストアへ変更を通知）
  useEffect(() => {
    saveRecentSearch(conditions);
  }, [conditions]);

  const applyConditions = useCallback(
    (next: PlanSearchConditions) => {
      router.replace(`/calendar/?${serializePlanConditions(next)}`, { scroll: false });
    },
    [router],
  );

  const plan = useMemo(() => buildPlan(conditions, SESSION_CALCULATED_AT), [conditions]);

  const holiday = holidayNameOf(conditions.date);

  async function onShare() {
    const url = `${window.location.origin}${window.location.pathname}?${serializePlanConditions(conditions)}`;
    const result = await shareUrl({
      title: "成田⇄関空 フライト・空港アクセス計画",
      text: `${ROUTES[conditions.routeId].fullLabelJa} ${formatMonthDay(conditions.date)}の計画`,
      url,
    });
    if (result === "shared") showToast("共有しました");
    else if (result === "copied") showToast("URLをコピーしました");
    else showToast("共有できませんでした");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-5">
      <PlanForm conditions={conditions} onChange={applyConditions} />

      {recent.length > 1 ? (
        <details className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <summary className="cursor-pointer text-sm font-bold">最近の検索条件</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {recent.map((item) => (
              <li key={serializePlanConditions(item)}>
                <button
                  type="button"
                  onClick={() => applyConditions(item)}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--surface-muted)]"
                >
                  {ROUTES[item.routeId].labelJa}・{formatMonthDay(item.date)}・大人{item.adults}名
                  {item.checkedBaggage ? "・荷物あり" : ""}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-2" aria-live="polite">
        <h2 className="text-base font-bold">
          {ROUTES[conditions.routeId].fullLabelJa}
          <span className="ml-2 text-sm font-normal text-[var(--foreground-muted)]">
            {formatMonthDay(conditions.date)}（{weekdayLabel(conditions.date)}
            {holiday ? `・${holiday}` : ""}）
          </span>
        </h2>
        <button
          type="button"
          onClick={onShare}
          className="min-h-11 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-bold hover:bg-[var(--surface-muted)]"
        >
          共有
        </button>
      </div>

      <p className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--foreground-muted)]">
        この画面は公式に確認できる情報（対応航空会社・ターミナル・最寄り駅・移動時間・
        搭乗締切）のみを表示します。<strong>航空券の価格・空席・便の時刻は含みません。</strong>
        最新の価格・空席・便時刻は各航空会社の公式サイトで確認してください。
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {plan.carriers.map((carrierPlan) => (
          <CarrierPlanCard
            key={carrierPlan.airlineCode}
            plan={carrierPlan}
            originAirport={plan.originAirport}
            destinationAirport={plan.destinationAirport}
            date={plan.date}
            adults={plan.adults}
            checkedBaggage={plan.checkedBaggage}
            routeLabel={plan.routeLabel}
          />
        ))}
      </div>
    </div>
  );
}
