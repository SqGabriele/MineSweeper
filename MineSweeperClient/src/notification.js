export async function subscribeUser(uid) {
  const response = await fetch("http://localhost:2708/vapidPublicKey");
  const vapidPublicKey = await response.text();

  const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

  const registration = await navigator.serviceWorker.register("/sw.js");

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey,
  });

  await fetch("http://localhost:2708/register", {
    method: "POST",
    body: JSON.stringify({
      uid,
      subscription,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

//funzione di supporto per la vapid key
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}