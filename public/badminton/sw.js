// CourtQueue's service worker. It caches nothing — the courts change every
// minute and a stale screen is worse than none. It exists so a phone that
// allowed alerts can show "You're up!" and open the app when tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener("push", (event) => {
  let data = { title: "CourtQueue", body: "Something changed on the courts." };
  try {
    data = event.data ? event.data.json() : data;
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: "courtqueue",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const c of list)
          if (c.url.includes("/badminton")) return c.focus();
        return self.clients.openWindow("/badminton");
      }),
  );
});
