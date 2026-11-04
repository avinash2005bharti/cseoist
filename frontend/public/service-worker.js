const CACHE_NAME = 'campusflow-shell-v4';
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/ogi.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((cacheName) => cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName))
    )),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  // Never cache or intercept in local development or for APIs / sockets
  if (
    request.method !== 'GET'
    || requestUrl.origin !== self.location.origin
    || requestUrl.pathname.startsWith('/api/')
    || requestUrl.pathname.startsWith('/uploads/')
    || requestUrl.pathname.startsWith('/socket.io/')
    || self.location.hostname === 'localhost'
    || self.location.hostname === '127.0.0.1'
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedShell = await caches.match('/');
        return cachedShell || Response.error();
      })
    );
    return;
  }

  if (!['script', 'style', 'image', 'font'].includes(request.destination)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((response) => {
        if (response.ok) {
          const responseToCache = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, responseToCache))
              .catch((error) => console.error('Failed to cache app asset:', error))
          );
        }
        return response;
      });
    })
  );
});

// =========================================================================
// PWA Web Push & Native Notification Handlers
// =========================================================================

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {
        title: 'CampusFlow Reminder',
        body: event.data.text(),
      };
    }
  }

  const title = data.title || 'Attendance & Consideration Review Reminder';
  const body =
    data.body ||
    data.message ||
    'Please review student consideration requests and update attendance records.';
  const url = data.url || (data.data && data.data.url) || '/';

  const options = {
    body,
    icon: data.icon || '/ogi.png',
    badge: data.badge || '/ogi.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: `reminder-${data.data?.slot || 'attendance'}-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: {
      url,
      timestamp: Date.now(),
      slot: data.data?.slot || 'SCHEDULED',
    },
    actions: [
      { action: 'open_url', title: 'Review Now' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open with the app origin, focus and navigate it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Support direct messages from the frontend to trigger native notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, url, tag } = event.data;
    self.registration.showNotification(title || 'CampusFlow Reminder', {
      body: body || 'Please review student consideration requests and update attendance.',
      icon: '/ogi.png',
      badge: '/ogi.png',
      vibrate: [150, 75, 150],
      tag: tag || 'campusflow-notice',
      data: { url: url || '/' },
      actions: [
        { action: 'open_url', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    });
  }
});
