// EXP Desktop — Service Worker
const CACHE = 'exp-desktop-v1';

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(clients.claim()));

// Push recebido
self.addEventListener('push', e => {
  const d = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(d.title ?? 'EXP', {
      body:    d.body  ?? '',
      icon:    d.icon  ?? '/files/assets/icon-192.png',
      badge:   '/files/assets/badge-72.png',
      tag:     d.tag   ?? 'exp-notif',
      data:    { url: d.url ?? '/files/gestao.html' },
      vibrate: [150, 75, 150],
      requireInteraction: false,
    })
  );
});

// Clique na notificação
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.data?.url ?? '/files/gestao.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('gestao') || c.url.includes('app.html')) return c.focus();
      }
      return clients.openWindow(target);
    })
  );
});
