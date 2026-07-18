"use client";

/**
 * 実用モードの検索フォーム（要件）。
 * 入力: 路線・搭乗日・大人人数・預け荷物・朝昼夜・出発駅・（任意）出発時刻。
 */

import { ORIGIN_STATIONS, ROUTES, originStationOfRoute } from "@/domain/routes";
import { MAX_ADULTS, type PlanSearchConditions } from "@/domain/planSearch";
import type { SelectableTimePeriod } from "@/domain/timePeriods";
import type { RouteId } from "@/domain/types";
import { RouteTabs } from "@/components/RouteTabs";
import { PeriodChips } from "@/components/PeriodChips";
import { todayInJst } from "@/lib/time";

type Props = {
  conditions: PlanSearchConditions;
  onChange: (next: PlanSearchConditions) => void;
};

export function PlanForm({ conditions, onChange }: Props) {
  const today = todayInJst();
  const originStation = originStationOfRoute(conditions.routeId);

  function update(patch: Partial<PlanSearchConditions>) {
    const next = { ...conditions, ...patch };
    // 路線が変わったら出発駅も路線に合わせる
    if (patch.routeId) {
      next.originStationCode = ORIGIN_STATIONS[ROUTES[patch.routeId].origin].stationCode;
    }
    onChange(next);
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
      onSubmit={(event) => event.preventDefault()}
      aria-label="検索条件"
    >
      <RouteTabs routeId={conditions.routeId} onChange={(routeId: RouteId) => update({ routeId })} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          搭乗日
          <input
            type="date"
            value={conditions.date}
            min={today}
            onChange={(event) => update({ date: event.target.value })}
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-base font-normal"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-bold">
          大人人数
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_ADULTS}
            value={conditions.adults}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isInteger(value) && value >= 1 && value <= MAX_ADULTS) {
                update({ adults: value });
              }
            }}
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-base font-normal"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-bold">
          出発駅
          <select
            value={conditions.originStationCode}
            onChange={(event) => update({ originStationCode: event.target.value })}
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-base font-normal"
          >
            <option value={originStation.stationCode}>{originStation.stationNameJa}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-bold">
          出発時刻（任意・公式サイトで確認した値）
          <input
            type="time"
            value={conditions.departureTime ?? ""}
            onChange={(event) =>
              update({ departureTime: event.target.value === "" ? null : event.target.value })
            }
            className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-base font-normal"
          />
          <span className="text-xs font-normal text-[var(--foreground-muted)]">
            入力すると空港到着目標を計算します。便時刻はこちらでは生成しません。
          </span>
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-bold">預け荷物</legend>
        <div className="flex gap-2">
          {[
            { value: false, label: "なし" },
            { value: true, label: "あり" },
          ].map((option) => {
            const selected = conditions.checkedBaggage === option.value;
            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={selected}
                onClick={() => update({ checkedBaggage: option.value })}
                className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border-2 px-4 text-sm font-bold ${
                  selected
                    ? "border-blue-700 bg-blue-700 text-white dark:border-blue-500 dark:bg-blue-600"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground-muted)]"
                }`}
              >
                <span aria-hidden="true" className="text-xs">
                  {selected ? "✓" : "＋"}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <PeriodChips
        periods={conditions.periods}
        onChange={(periods: SelectableTimePeriod[]) => update({ periods })}
      />
    </form>
  );
}
