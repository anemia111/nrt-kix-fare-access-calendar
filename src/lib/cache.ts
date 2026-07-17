/**
 * 種類別のキャッシュ（要件39）。
 *
 * 航空券価格・航空会社ルール・鉄道時刻は更新頻度が異なるため、TTL を分ける。
 * 同一条件の短時間検索ではキャッシュを利用し、古い情報を表示する場合は
 * 最終取得時刻を必ず画面に出す。
 *
 * データ提供元の利用規約がキャッシュを制限する場合は、その規約を優先すること。
 * 実データモードを実装する際は、提供元ごとに TTL を見直す必要がある。
 */

export const CACHE_TTL_MINUTES = {
  /** 航空券価格: 1〜3時間の範囲で、短めの2時間を採用。 */
  flightPrice: 120,
  /** リアルタイム運行情報: 短時間のみ。 */
  realtimeServiceInfo: 5,
  /** 鉄道の通常時刻表: 提供元の規約に従う。デモでは1日。 */
  timetable: 60 * 24,
  /** 航空会社の搭乗ルール: 定期確認し、最終確認日を保持する。 */
  boardingRules: 60 * 24 * 7,
  /** 空港ターミナル情報: 定期確認。 */
  terminalInfo: 60 * 24 * 7,
} as const;

type CacheEntry<T> = {
  readonly value: T;
  readonly expiresAtMillis: number;
  readonly storedAtMillis: number;
};

/**
 * 単純な TTL 付きインメモリキャッシュ。
 * プロセス／タブ内でのみ有効。永続化はしない。
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMinutes: number) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAtMillis) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** キャッシュに入れた時刻。「最終取得時刻」の表示に使う。 */
  storedAt(key: string): Date | undefined {
    const entry = this.entries.get(key);
    return entry ? new Date(entry.storedAtMillis) : undefined;
  }

  set(key: string, value: T): void {
    const now = Date.now();
    this.entries.set(key, {
      value,
      storedAtMillis: now,
      expiresAtMillis: now + this.ttlMinutes * 60_000,
    });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

/** 古い情報を表示する際に添える文言（要件39）。 */
export const STALE_DATA_LABELS = {
  referencePrice: "参考価格",
  awaitingUpdate: "更新待ち",
  normalTimetable: "通常ダイヤに基づく",
  notVerified: "最新情報未確認",
} as const;
