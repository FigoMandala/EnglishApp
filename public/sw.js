/* Service worker EnglishApp: pengingat belajar via Web Push. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * URL dari payload push hanya boleh path same-origin — tanpa ini, payload
 * lintas-origin (butuh kebocoran kunci VAPID, tapi tetap) bisa membuka
 * halaman phishing di bawah identitas notifikasi aplikasi (audit P3).
 */
function safeUrl(raw) {
  try {
    const parsed = new URL(String(raw || ""), self.location.origin);
    if (parsed.origin !== self.location.origin) return "/belajar";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "/belajar";
  }
}

self.addEventListener("push", (event) => {
  let data = { title: "EnglishApp", body: "Saatnya belajar!", url: "/belajar" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Payload bukan JSON: pakai teks mentah sebagai isi notifikasi.
    if (event.data) data.body = event.data.text();
  }
  data.url = safeUrl(data.url);
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: "englishapp-reminder",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
