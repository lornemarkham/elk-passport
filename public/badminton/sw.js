// CourtQueue's service worker. It caches nothing — the courts change every
// minute and a stale screen is worse than none. It shows the server's push
// notifications ("COURT 2 — YOU'RE UP!", "You're in tonight!", "Sign-up is
// open") and opens the app when one is tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener("push", (event) => {
  let data = { title: "CourtQueue", body: "Something changed on the courts." };
  try {
    data = event.data ? { ...data, ...event.data.json() } : data;
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag || "courtqueue",
      renotify: true,
      icon: "/badminton/app-icon/192",
      badge: "/badminton/app-icon/192",
      vibrate: [200, 100, 200],
      data: { url: data.url || "/badminton" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) || "/badminton";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const c of list)
          if (c.url.includes("/badminton")) return c.focus();
        return self.clients.openWindow(url);
      }),
  );
});
