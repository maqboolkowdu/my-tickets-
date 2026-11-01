/* CyberDigest moved to https://maqboolkowdu.github.io/cyberdigest/.
   This replacement service worker retires the old installed app: it clears the old offline
   cache, unregisters itself and sends open windows to the new address. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('cyberdigest-')).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const wins = await self.clients.matchAll({ type: 'window' });
    wins.forEach((w) => w.navigate('https://maqboolkowdu.github.io/cyberdigest/').catch(() => {}));
  })());
});
