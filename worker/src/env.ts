/**
 * Worker の環境。APIキーは Secrets 経由でのみ渡る。
 * これらの値をレスポンスやログへ出してはいけない。
 */
export type Env = {
  /** Secrets（wrangler secret put）。未設定の場合がある。 */
  readonly SERPAPI_API_KEY?: string;
  readonly GOOGLE_MAPS_API_KEY?: string;

  /** vars（公開してよい設定）。 */
  readonly ALLOWED_ORIGINS?: string;
  readonly FLIGHT_CACHE_TTL_SECONDS?: string;
  readonly TRANSIT_CACHE_TTL_SECONDS?: string;
};

export function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function allowedOrigins(env: Env): string[] {
  const raw = env.ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
