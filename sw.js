// 联网时重新验证资源，离线时使用最近一次成功访问的缓存
const CACHE = 'nextthing-v2';
const ALBUM_PATH = new URL('./album/', self.registration.scope).pathname;
const CORE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/ui.js',
  './js/scheduler.js',
  './js/rare.js',
  './js/meta.js',
  './js/state.js',
  './js/data.js',
  './js/embedded-data.js',
  './data/index.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => Promise.all(clients.map(client => {
        const url = new URL(client.url);
        if (url.origin === self.location.origin && url.pathname.startsWith(ALBUM_PATH)) {
          return client.navigate(client.url);
        }
      })))
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const network = fetch(e.request, { cache: 'no-cache' }).then(res => ({
    res,
    copy: res.ok && res.status === 200 ? res.clone() : null,
  }));

  e.waitUntil(
    network
      .then(async ({ copy }) => {
        if (!copy) return;
        const cache = await caches.open(CACHE);
        await cache.put(e.request, copy);
      })
      .catch(() => {})
  );

  e.respondWith(
    network
      .then(({ res }) => res)
      .catch(async () => {
        const hit = await caches.match(e.request, { ignoreSearch: true });
        return hit || Response.error();
      })
  );
});
