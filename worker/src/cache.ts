/**
 * Cloudflare Cache API を使った検索結果キャッシュ。
 *
 * KV や DB を使わず、無料枠のみで動かす。キャッシュキーには個人情報を含めない
 * （路線・日付・人数・条件のみ）。
 */

export type CachedPayload<T> = {
  readonly value: T;
  /** キャッシュへ入れた時刻（ISO8601）。 */
  readonly storedAt: string;
};

export type CacheLookup<T> =
  | { readonly hit: true; readonly value: T; readonly ageSeconds: number; readonly storedAt: string }
  | { readonly hit: false };

/** 内部的なキャッシュURL（実在のホストではない）。 */
function cacheKeyUrl(namespace: string, key: string): string {
  return `https://cache.nrt-kix.internal/${namespace}/${encodeURIComponent(key)}`;
}

export async function readCache<T>(namespace: string, key: string): Promise<CacheLookup<T>> {
  try {
    const cache = caches.default;
    const response = await cache.match(new Request(cacheKeyUrl(namespace, key)));
    if (!response) return { hit: false };
    const payload = (await response.json()) as CachedPayload<T>;
    const storedAtMs = Date.parse(payload.storedAt);
    const ageSeconds = Number.isFinite(storedAtMs)
      ? Math.max(0, Math.floor((Date.now() - storedAtMs) / 1000))
      : 0;
    return { hit: true, value: payload.value, ageSeconds, storedAt: payload.storedAt };
  } catch {
    return { hit: false };
  }
}

export async function writeCache<T>(
  namespace: string,
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  try {
    const cache = caches.default;
    const payload: CachedPayload<T> = { value, storedAt: new Date().toISOString() };
    await cache.put(
      new Request(cacheKeyUrl(namespace, key)),
      new Response(JSON.stringify(payload), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `max-age=${Math.max(1, Math.floor(ttlSeconds))}`,
        },
      }),
    );
  } catch {
    // キャッシュ失敗は機能を止めない
  }
}

/** 航空券検索のキャッシュキー（個人情報を含めない）。 */
export function flightCacheKey(input: {
  origin: string;
  destination: string;
  date: string;
  adults: number;
  cabin: string;
  directOnly: boolean;
}): string {
  return [
    input.origin,
    input.destination,
    input.date,
    String(input.adults),
    input.cabin,
    input.directOnly ? "direct" : "any",
  ].join(":");
}

/**
 * 公共交通のキャッシュキー。
 * 到着目標時刻は 15 分バケットへ丸め、近い到着時刻の便で結果を再利用する
 * （Google Routes の無料枠を無駄に消費しないため）。
 */
export function transitCacheKey(input: {
  originStationCode: string;
  destinationStationCode: string;
  arriveBy: string;
}): string {
  return [
    input.originStationCode,
    input.destinationStationCode,
    roundToBucket(input.arriveBy, 15),
  ].join(":");
}

/** ISO8601 を指定分バケットへ切り下げる。 */
export function roundToBucket(iso: string, bucketMinutes: number): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso;
  const bucketMs = bucketMinutes * 60 * 1000;
  return new Date(Math.floor(time / bucketMs) * bucketMs).toISOString();
}
