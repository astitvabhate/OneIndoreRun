// Kill switch for stale service workers. This site does not use one, but a worker left on
// localhost by another project keeps serving old cached files. When the browser checks for an
// update it loads this file, which clears those caches, unregisters itself and reloads open tabs.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: 'window' });
      windows.forEach((client) => client.navigate(client.url));
    })(),
  );
});
