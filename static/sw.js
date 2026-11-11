// Cache only content-addressed assets. HTML stays fresh; videos (including
// Range/206 responses), originals and external resources use normal HTTP caching.
const PREFIX = 'pairs-lab-assets-';
const CACHE = PREFIX + 'v1';
const MAX_ENTRIES = 60;
const MAX_BYTES = 512 * 1024; // <= 30 MiB of response bodies, plus small headers.
const MAX_AGE = 14 * 24 * 60 * 60 * 1000;
const STORED_AT = 'x-pairs-cached-at';
let writes = Promise.resolve();
let generation = 0;
const enqueue = task => (writes = writes.catch(() => {}).then(task));
const eligible = request => {
  const url = new URL(request.url);
  return request.method === 'GET' && url.origin === self.location.origin &&
    !request.headers.has('range') && !url.search &&
    (/\.[a-f0-9]{64}\.(css|js|svg)$/.test(url.pathname) || /_hu[a-f0-9]+[^/]*\.webp$/.test(url.pathname));
};
const fresh = response => Date.now() - Number(response.headers.get(STORED_AT) || 0) < MAX_AGE;

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
  const cache = await caches.open(CACHE);
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (!response || !fresh(response)) await cache.delete(request);
  }
  await self.clients.claim();
})()));

const store = async (request, response, requestGeneration) => {
  if (response.status !== 200 || response.type !== 'basic' || response.redirected ||
      Number(response.headers.get('content-length')) > MAX_BYTES ||
      /no-store|private/i.test(response.headers.get('cache-control') || '')) return;
  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return;
  return enqueue(async () => {
    if (requestGeneration !== generation) return;
    const cache = await caches.open(CACHE);
    const headers = new Headers(response.headers);
    headers.set(STORED_AT, String(Date.now()));
    // Fetch decodes the body; do not retain a transfer encoding or old length.
    headers.delete('content-encoding');
    headers.delete('content-length');
    await cache.delete(request);
    const keys = await cache.keys();
    while (keys.length >= MAX_ENTRIES) await cache.delete(keys.shift());
    await cache.put(request, new Response(body, { status: 200, headers }));
  });
};
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.mode === 'navigate' && new URL(request.url).origin === self.location.origin) {
    event.respondWith(fetch(request, { cache: 'no-cache' }));
    return;
  }
  if (!eligible(request)) return;
  const requestGeneration = generation;
  // Extend the event's lifetime immediately, including the later cache write.
  const result = (async () => {
    try {
      const hit = await (await caches.open(CACHE)).match(request);
      if (hit && fresh(hit)) return { response: hit };
    } catch (_) { /* Storage denial must not block the asset request. */ }
    const response = await fetch(request);
    return { response, stored: store(request, response.clone(), requestGeneration).catch(() => {}) };
  })();
  event.respondWith(result.then(value => value.response));
  event.waitUntil(result.then(value => value.stored).catch(() => {}));
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'CLEAR_ASSET_CACHE') return;
  ++generation; // In-flight requests from before the clear cannot restore old entries.
  event.waitUntil(enqueue(async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX)).map(name => caches.delete(name)));
  }).then(() => event.ports[0]?.postMessage({ ok: true }),
    () => event.ports[0]?.postMessage({ ok: false })));
});
