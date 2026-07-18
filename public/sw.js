/* 簡易サービスワーカー。
 *
 * 目的は「オフラインでも、保存済みの公式基礎情報（アプリシェルとバンドルに
 * 含まれる搭乗締切・ターミナル情報）を表示できる」こと。価格・空席・列車時刻は
 * そもそも扱わないため、オフラインでも架空データを見せることはない。
 *
 * scope は登録時の basePath 配下。self.registration.scope を基準に相対解決する。
 */

const CACHE_NAME = "nrt-kix-shell-v1";
const scopeUrl = new URL(self.registration.scope);
const base = scopeUrl.pathname.replace(/\/$/, "");

const PRECACHE_URLS = [
  `${base}/`,
  `${base}/calendar/`,
  `${base}/demo/`,
  `${base}/demo/calendar/`,
  `${base}/api/airlines.json`,
  `${base}/api/terminals.json`,
  `${base}/api/health.json`,
  `${base}/icon.svg`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // 一部が失敗しても install を止めない
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // ナビゲーションは network-first（最新を優先し、オフライン時のみキャッシュ）
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(`${base}/`))),
    );
    return;
  }

  // それ以外は cache-first（アセット・静的JSON）
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
