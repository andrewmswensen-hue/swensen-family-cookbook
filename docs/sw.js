/* Swensen Family Cookbook: notification helper for cook-mode timers.
 *
 * This file exists only so timer alerts can show as phone notifications
 * (Android Chrome requires one).  It deliberately has NO "fetch" handler and
 * caches nothing, so it can never serve an out-of-date copy of the site.
 * cook-mode.js registers it the first time someone starts a timer.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

// Tapping a "Time's up" notification brings the cookbook forward and opens
// cook mode for that recipe.
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const hash = (event.notification.data && event.notification.data.url) || "#/";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.indexOf(self.registration.scope) === 0) {
        client.postMessage({ type: "open", hash });
        return client.focus();
      }
    }
    return self.clients.openWindow(self.registration.scope + hash);
  })());
});
