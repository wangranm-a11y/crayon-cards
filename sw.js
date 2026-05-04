const CACHE = 'crayon-cards-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './cards.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      // 立刻删除所有旧缓存
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

// —— 网络优先 ——
// 在线时永远拿最新（开发改了立刻生效）
// 离线时回退到缓存（保留 PWA 体验）
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // 跳过非同源（如 html2canvas CDN）
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 后台更新缓存
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(r => r || caches.match('./index.html'))
      )
  );
});
