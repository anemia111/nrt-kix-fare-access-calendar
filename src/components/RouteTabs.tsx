"use client";

/**
 * 路線切り替えタブと入替ボタン（要件4）。
 *
 * 切り替えてもページ全体を再読み込みせず、カレンダーのデータだけを更新する。
 */

import { ROUTES, swapRoute } from "@/domain/routes";
import { ROUTE_IDS, type RouteId } from "@/domain/types";

type Props = {
  routeId: RouteId;
  onChange: (routeId: RouteId) => void;
};

export function RouteTabs({ routeId, onChange }: Props) {
  return (
    <div className="flex items-stretch gap-2">
      <div
        role="tablist"
        aria-label="路線の選択"
        className="flex flex-1 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1"
      >
        {ROUTE_IDS.map((id) => {
          const selected = id === routeId;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(id)}
              className={`flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-bold transition-colors ${
                selected
                  ? "bg-blue-700 text-white dark:bg-blue-600"
                  : "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {ROUTES[id].labelJa}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange(swapRoute(routeId))}
        aria-label="出発地と到着地を入れ替える"
        title="出発地と到着地を入れ替える"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 transition-colors hover:bg-[var(--surface-muted)]"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 16H3m0 0 3-3m-3 3 3 3" />
          <path d="M17 8h4m0 0-3-3m3 3-3 3" />
          <path d="M7 16h14M3 8h14" />
        </svg>
      </button>
    </div>
  );
}
