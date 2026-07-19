// Service worker de Firebase Cloud Messaging (mensajes en segundo plano).
//
// NOTA DE IMPLEMENTACIÓN — por qué la config está hardcodeada acá en vez de
// leerse de NEXT_PUBLIC_FIREBASE_*:
// Este archivo vive en `public/` y se sirve tal cual, sin pasar por el build
// de Next.js — un service worker no puede leer `process.env` en runtime como
// sí puede el bundle principal (ver lib/push.ts). Las alternativas habituales
// son (a) generar este archivo en build time inyectando las env vars, o
// (b) pasar la config por query string al registrar el SW. Ambas agregan
// complejidad de build/registro que no vale la pena todavía porque HOY no
// existe un proyecto Firebase real (ver lib/push.ts: registrarPushWeb() ya
// no-opea completo si faltan las env vars, así que este SW ni siquiera se
// registra en este entorno). Se optó por la opción más simple: constantes
// placeholder acá, documentadas, para completar a mano el día que exista un
// proyecto Firebase real — deben quedar IGUALES a NEXT_PUBLIC_FIREBASE_* del
// entorno web (mismo API key, mismo projectId, etc.).
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "REEMPLAZAR_CON_NEXT_PUBLIC_FIREBASE_API_KEY",
  projectId: "REEMPLAZAR_CON_NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  messagingSenderId: "REEMPLAZAR_CON_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "REEMPLAZAR_CON_NEXT_PUBLIC_FIREBASE_APP_ID",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const titulo = payload.notification?.title ?? "Guardianes";
  const cuerpo = payload.notification?.body ?? "";

  self.registration.showNotification(titulo, {
    body: cuerpo,
    icon: "/logo.png",
    data: payload.data,
  });
});
