self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "Flashcards";
  const options = {
    body: data.body || "You have cards due for review",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/review?active=true" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || "/";
  // Validate URL is same-origin before opening
  const resolved = new URL(rawUrl, self.location.origin);
  const url = resolved.origin === self.location.origin ? resolved.href : self.location.origin + "/";
  event.waitUntil(clients.openWindow(url));
});
