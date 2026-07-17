/**
 * 出発時間帯の定義。
 *
 * この定義がアプリ全体の唯一の情報源。フロントエンド・ロジック・テストで
 * 重複定義しないこと（要件5）。
 */

export const TIME_PERIODS = ["morning", "daytime", "evening", "late_night"] as const;
export type TimePeriod = (typeof TIME_PERIODS)[number];

/** 初期リリースでユーザーが選択できる時間帯。late_night は表示対象外。 */
export const SELECTABLE_TIME_PERIODS = ["morning", "daytime", "evening"] as const;
export type SelectableTimePeriod = (typeof SELECTABLE_TIME_PERIODS)[number];

export type TimePeriodDefinition = {
  readonly id: TimePeriod;
  readonly labelJa: string;
  /** 00:00 からの経過分。境界を含む。 */
  readonly startMinutes: number;
  /** 00:00 からの経過分。境界を含む。 */
  readonly endMinutes: number;
  readonly rangeLabel: string;
  readonly selectable: boolean;
};

export const TIME_PERIOD_DEFINITIONS: Readonly<Record<TimePeriod, TimePeriodDefinition>> = {
  morning: {
    id: "morning",
    labelJa: "朝",
    startMinutes: 5 * 60, // 05:00
    endMinutes: 10 * 60 + 59, // 10:59
    rangeLabel: "05:00〜10:59",
    selectable: true,
  },
  daytime: {
    id: "daytime",
    labelJa: "昼",
    startMinutes: 11 * 60, // 11:00
    endMinutes: 16 * 60 + 59, // 16:59
    rangeLabel: "11:00〜16:59",
    selectable: true,
  },
  evening: {
    id: "evening",
    labelJa: "夜",
    startMinutes: 17 * 60, // 17:00
    endMinutes: 23 * 60 + 59, // 23:59
    rangeLabel: "17:00〜23:59",
    selectable: true,
  },
  late_night: {
    id: "late_night",
    labelJa: "深夜",
    startMinutes: 0, // 00:00
    endMinutes: 4 * 60 + 59, // 04:59
    rangeLabel: "00:00〜04:59",
    selectable: false,
  },
};

/** 選択可能な時間帯の定義。id が SelectableTimePeriod に絞られている。 */
export type SelectableTimePeriodDefinition = Omit<TimePeriodDefinition, "id"> & {
  readonly id: SelectableTimePeriod;
};

export const SELECTABLE_TIME_PERIOD_DEFINITIONS: readonly SelectableTimePeriodDefinition[] =
  SELECTABLE_TIME_PERIODS.map((id) => ({ ...TIME_PERIOD_DEFINITIONS[id], id }));

export function isTimePeriod(value: unknown): value is TimePeriod {
  return typeof value === "string" && (TIME_PERIODS as readonly string[]).includes(value);
}

export function isSelectableTimePeriod(value: unknown): value is SelectableTimePeriod {
  return (
    typeof value === "string" && (SELECTABLE_TIME_PERIODS as readonly string[]).includes(value)
  );
}

/**
 * 00:00 からの経過分が属する時間帯を返す。
 * 境界値: 05:00→morning, 10:59→morning, 11:00→daytime, 16:59→daytime,
 *        17:00→evening, 23:59→evening, 00:00〜04:59→late_night
 */
export function timePeriodOfMinutes(minutesFromMidnight: number): TimePeriod {
  const minutes = ((minutesFromMidnight % 1440) + 1440) % 1440;
  for (const definition of Object.values(TIME_PERIOD_DEFINITIONS)) {
    if (minutes >= definition.startMinutes && minutes <= definition.endMinutes) {
      return definition.id;
    }
  }
  // 上の4区分で 0..1439 を隙間なく覆っているため到達しない。
  throw new Error(`時間帯を判定できませんでした: ${minutesFromMidnight}`);
}

/** "HH:mm" が属する時間帯を返す。 */
export function timePeriodOfClock(clock: string): TimePeriod {
  return timePeriodOfMinutes(clockToMinutes(clock));
}

/** "HH:mm" -> 00:00 からの経過分 */
export function clockToMinutes(clock: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock);
  if (!match) {
    throw new Error(`時刻の形式が不正です: ${clock}`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error(`時刻の値が不正です: ${clock}`);
  }
  return hours * 60 + minutes;
}

/**
 * URL クエリの periods を解釈する。
 * 不正値・空・全未選択はすべて「全選択」にフォールバックする（要件5: 全未選択は不可）。
 */
export function parsePeriodsParam(raw: string | null | undefined): SelectableTimePeriod[] {
  if (!raw) return [...SELECTABLE_TIME_PERIODS];
  const parsed = raw
    .split(",")
    .map((part) => part.trim())
    .filter(isSelectableTimePeriod);
  const unique = SELECTABLE_TIME_PERIODS.filter((period) => parsed.includes(period));
  return unique.length > 0 ? unique : [...SELECTABLE_TIME_PERIODS];
}

/** 選択中の時間帯を URL クエリ用の文字列にする。並び順は定義順で安定させる。 */
export function serializePeriods(periods: readonly SelectableTimePeriod[]): string {
  return SELECTABLE_TIME_PERIODS.filter((period) => periods.includes(period)).join(",");
}

/**
 * チップの選択切り替え。全未選択にはできないため、最後の1つを外す操作は無視する。
 */
export function togglePeriod(
  current: readonly SelectableTimePeriod[],
  target: SelectableTimePeriod,
): SelectableTimePeriod[] {
  const isSelected = current.includes(target);
  if (isSelected && current.length === 1) {
    return [...current];
  }
  const next = isSelected
    ? current.filter((period) => period !== target)
    : [...current, target];
  return SELECTABLE_TIME_PERIODS.filter((period) => next.includes(period));
}
