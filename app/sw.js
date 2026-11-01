/* THINK 工作台 Service Worker
 * 策略: 同源 GET 走 network-first (在线永远拿最新代码, 更新即时生效),
 * 网络失败时回退缓存 (离线可用); 跨域请求 (面试系统 API / 天气) 直连不缓存。
 * 仅在 http(s) 环境注册 (file:// 双击打开时自动跳过, 功能不受影响)。
 */
const CACHE = 'think-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './js/store.js',
  './js/main.js',
  './js/boot.js',
  './js/views/overview.js',
  './js/views/calendar.js',
  './js/views/todos.js',
  './js/views/focus.js',
  './js/views/habits.js',
  './js/views/review.js',
  './js/views/notes.js',
  './js/views/interview.js',
  './js/views/countdown.js',
  './js/views/bookmarks.js',
  './js/views/stats.js',
  './js/views/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;   // 面试系统 API / 天气: 直连
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
