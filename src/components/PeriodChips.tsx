"use client";

/**
 * 出発時間帯の選択チップ（要件5）。
 *
 * チェックボックスではなく、スマートフォンで押しやすいチップ形式にする。
 * 選択中／未選択は色だけでなく、枠線・文字・チェックアイコンでも判別できる。
 * すべて未選択にはできない。
 */

import {
  SELECTABLE_TIME_PERIOD_DEFINITIONS,
  togglePeriod,
  type SelectableTimePeriod,
} from "@/domain/timePeriods";

type Props = {
  periods: readonly SelectableTimePeriod[];
  onChange: (periods: SelectableTimePeriod[]) => void;
};

export function PeriodChips({ periods, onChange }: Props) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold">出発時間帯</legend>
      <div className="flex flex-wrap gap-2">
        {SELECTABLE_TIME_PERIOD_DEFINITIONS.map((definition) => {
          const selected = periods.includes(definition.id);
          const isLastSelected = selected && periods.length === 1;

          return (
            <button
              key={definition.id}
              type="button"
              aria-pressed={selected}
              // 最後の1つは解除できない。理由を伝えるため title を付ける。
              title={
                isLastSelected ? "時間帯は1つ以上選択してください" : undefined
              }
              onClick={() => onChange(togglePeriod(periods, definition.id))}
              className={`flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-bold transition-colors ${
                selected
                  ? "border-blue-700 bg-blue-700 text-white dark:border-blue-500 dark:bg-blue-600"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
              } ${isLastSelected ? "cursor-not-allowed" : ""}`}
            >
              {/* 色以外でも選択状態が分かるようにアイコンを出し分ける */}
              <span aria-hidden="true" className="text-xs">
                {selected ? "✓" : "＋"}
              </span>
              <span>{definition.labelJa}</span>
              <span className="text-xs font-normal opacity-90">{definition.rangeLabel}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--foreground-muted)]">
        選択中の時間帯に該当する便だけを比較します。すべてを未選択にすることはできません。
      </p>
    </fieldset>
  );
}
