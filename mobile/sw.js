// EXP Mobile — Service Worker v6.0
const CACHE = 'exp-mobile-v6';
const OFFLINE_URL = './offline.html';

const PRECACHE = [
  './',
  './index.html',
  './offline.html',
  './app.html',
  './chat.html',
  './horas.html',
  './gestao.html',
  './contatos.html',
  './projetos.html',
  './projeto.html',
  './tarefas.html',
  './custos.html',
  './revisoes.html',
  './manifest.json',
  './assets/exp-mobile.css',
  './assets/exp-mobile-core.js',
  './assets/exp-mobile-supabase-fallback.js',
  './assets/exp.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/badge-72.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh && (fresh.ok || fresh.type === 'opaque')) {
    const cache = await caches.open(CACHE);
    cache.put(req, fresh.clone());
  }
  return fresh;
}

async function staleWhileRevalidate(req) {
  const cached = await caches.match(req);
  const networkPromise = fetch(req).then(async (fresh) => {
    if (fresh && (fresh.ok || fresh.type === 'opaque')) {
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
    }
    return fresh;
  });
  return cached || networkPromise;
}

async function networkFirstPage(req) {
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (_) {
    return (await caches.match(req))
      || (await caches.match('./index.html'))
      || (await caches.match(OFFLINE_URL));
  }
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isNavigation = e.request.mode === 'navigate'
    || (e.request.headers.get('accept') || '').includes('text/html');

  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  if (isNavigation) {
    e.respondWith(networkFirstPage(e.request));
    return;
  }

  if (isSameOrigin) {
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }

  e.respondWith(cacheFirst(e.request).catch(() => caches.match(e.request)));
});

// Push notification received
self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? {};
  const options = {
    body: data.body ?? 'Nova mensagem no EXP',
    icon: './assets/icon-192.png',
    badge: './assets/badge-72.png',
    tag: data.tag ?? 'exp',
    data: { url: data.url ?? './chat.html' },
    vibrate: [200, 100, 200],
  };
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'EXP', options)
  );
});

// Notification clicked — focus or open the target URL
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = e.notification.data?.url ?? './';
  const targetUrl = new URL(target, self.registration.scope || self.location.href);
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        const clientUrl = new URL(client.url);
        if (clientUrl.href === targetUrl.href && 'focus' in client) return client.focus();
      }
      for (const client of list) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === targetUrl.origin && clientUrl.pathname === targetUrl.pathname && 'navigate' in client) {
          return client.navigate(targetUrl.href).then((navigated) => {
            if (navigated && 'focus' in navigated) return navigated.focus();
            if ('focus' in client) return client.focus();
          });
        }
      }
      return clients.openWindow(targetUrl.href);
    })
  );
});
