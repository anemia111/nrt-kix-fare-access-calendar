/**
 * バッジ類。
 *
 * 色だけで情報を伝えない（要件8・40・41）。すべてのバッジで
 * 「記号 + 文字」を必ず併記し、色覚特性や白黒印刷でも判別できるようにする。
 */

import { PRICE_BAND_LABELS, PRICE_BAND_SYMBOLS } from "@/lib/priceBand";
import { AVAILABILITY_SYMBOLS, describeAvailability, RISK_SYMBOLS } from "@/lib/format";
import { RISK_LABELS, type Availability, type PriceBand, type RiskLevel } from "@/domain/types";

const BADGE_BASE =
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold whitespace-nowrap";

const PRICE_BAND_STYLES: Readonly<Record<PriceBand, string>> = {
  cheapest: "bg-emerald-700 text-white dark:bg-emerald-600",
  cheap: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  average: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100",
  expensive: "bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-200",
  unknown: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function PriceBandBadge({ band }: { band: PriceBand }) {
  if (band === "unknown") return null;
  return (
    <span className={`${BADGE_BASE} ${PRICE_BAND_STYLES[band]}`}>
      <span aria-hidden="true">{PRICE_BAND_SYMBOLS[band]}</span>
      {PRICE_BAND_LABELS[band]}
    </span>
  );
}

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  const display = describeAvailability(availability);
  const style = display.isUnavailable
    ? "bg-red-100 text-red-950 dark:bg-red-950 dark:text-red-200"
    : display.isExactSeatCount
      ? "bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-200"
      : "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100";

  return (
    <span className={`${BADGE_BASE} ${style}`} title={display.description}>
      <span aria-hidden="true">{AVAILABILITY_SYMBOLS[availability.status]}</span>
      {display.label}
    </span>
  );
}

const RISK_STYLES: Readonly<Record<RiskLevel, string>> = {
  LOW: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200",
  HIGH: "bg-orange-200 text-orange-950 dark:bg-orange-900 dark:text-orange-100",
  UNAVAILABLE: "bg-red-200 text-red-950 dark:bg-red-900 dark:text-red-100",
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`${BADGE_BASE} ${RISK_STYLES[level]}`}>
      <span aria-hidden="true">{RISK_SYMBOLS[level]}</span>
      {RISK_LABELS[level]}
    </span>
  );
}

/** LCC/FSC などの補足ラベル。 */
export function InfoChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--foreground-muted)]">
      {children}
    </span>
  );
}
