//service worker
self.addEventListener("push", function (event) {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.png",
    })
  );

  //informa il client se ci sono notifiche
  self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then(clients => {
    clients.forEach(client => {
      client.postMessage(data);
    });
  });
});
