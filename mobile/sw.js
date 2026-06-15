// EXP Mobile — Service Worker v5.0
const CACHE = 'exp-mobile-v5';

// Apenas assets estáticos que não mudam com frequência
const STATIC = [
  './assets/exp-mobile.css',
  './assets/exp-mobile-core.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
];

// Install — cache só os assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(STATIC.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

// Activate — limpa caches antigos, sem claim() para não interromper navegação
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

// Fetch strategy:
// - Supabase → sempre rede
// - HTML (.html) → sempre rede (garante updates chegarem ao usuário)
// - Assets (css/js) → cache-first com fallback de rede
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Supabase — sempre rede
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

  // HTML — sempre rede para garantir versão atualizada
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Assets — cache-first
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});

// Push notification received
self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? {};
  const options = {
    body:    data.body    ?? 'Nova mensagem no EXP',
    icon:    './assets/icon-192.png',
    badge:   './assets/badge-72.png',
    tag:     data.tag     ?? 'exp',
    data:    { url: data.url ?? './chat.html' },
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
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(target) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(target);
    })
  );
});
