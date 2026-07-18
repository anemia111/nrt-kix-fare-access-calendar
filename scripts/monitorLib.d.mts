// scripts/monitorLib.mjs の型定義（テスト・型チェック用）。

export type MonitoredSource = {
  id: string;
  name: string;
  url: string;
  manualCheckItems?: string[];
};

export type SourceState = {
  hash?: string;
  etag?: string | null;
  lastModified?: string | null;
  checkedAt?: string;
  lastCheckedAt?: string;
};

export type CurrentResult = {
  status: "ok" | "fetch-failed" | "skipped-by-robots";
  hash?: string;
  etag?: string | null;
  lastModified?: string | null;
  httpStatus?: number | string;
  checkedAt: string;
};

export type IssueReport = { title: string; body: string };

export type SourceDiff = {
  id: string;
  outcome: "changed" | "unchanged" | "baseline" | "fetch-failed" | "skipped";
  keepPrevious: boolean;
  reason?: string;
  needsManualCheck?: boolean;
  report?: IssueReport;
};

export function hashBody(text: string): string;

export type RobotsGroup = {
  agents: string[];
  rules: { type: "allow" | "disallow"; path: string }[];
  hasRules: boolean;
};

export function parseRobots(text: string): RobotsGroup[];

export function isPathAllowed(
  groups: RobotsGroup[],
  userAgent: string,
  path: string,
): boolean;

export function diffSource(
  source: MonitoredSource,
  previous: SourceState | undefined,
  current: CurrentResult,
): SourceDiff;

export function buildIssueReport(
  source: MonitoredSource,
  previous: SourceState,
  current: CurrentResult,
): IssueReport;

export function nextState(
  previousState: Record<string, SourceState>,
  results: { source: MonitoredSource; current: CurrentResult; diff: SourceDiff }[],
): Record<string, SourceState>;
