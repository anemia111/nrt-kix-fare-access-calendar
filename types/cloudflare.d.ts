/**
 * Cloudflare Workers 固有の型を、ルートの型チェックでも解決できるようにする。
 *
 * テストが worker/src を import するため、ルートの tsconfig からも
 * `caches.default` が見える必要がある。Worker 自身のビルドでは
 * `@cloudflare/workers-types`（worker/tsconfig.json）が使われる。
 */

declare global {
  interface CacheStorage {
    /** Cloudflare Workers の既定キャッシュ。 */
    readonly default: Cache;
  }
}

export {};
