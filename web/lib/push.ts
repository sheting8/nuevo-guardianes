import { api } from "@/lib/api";

// Config de Firebase Web SDK — todas estas variables NEXT_PUBLIC_FIREBASE_*
// están vacías hasta que exista un proyecto Firebase real; en ese momento
// basta con completarlas en el .env del entorno correspondiente (y replicar
// los mismos valores en public/firebase-messaging-sw.js, ver comentario ahí).
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

function configuracionCompleta(): boolean {
  return Boolean(apiKey && projectId && messagingSenderId && appId && vapidKey);
}

// Token FCM registrado durante esta sesión de navegador, para poder darlo de
// baja al cerrar sesión (ver eliminarTokenPush). Vive en memoria del módulo
// en vez de en el store de auth: es un detalle de implementación de push,
// no estado de sesión, y no necesita persistir entre recargas — cada carga
// de la app vuelve a pedir/registrar el token si push ya fue habilitado.
let tokenRegistrado: string | null = null;

// Registra el token de push web del dispositivo actual contra el backend.
// Es best-effort a propósito: si Firebase no está configurado (no hay
// proyecto real todavía), si el navegador no soporta notificaciones/service
// workers, o si el usuario rechaza el permiso, esta función simplemente no
// hace nada — nunca debe interrumpir el flujo de login.
export async function registrarPushWeb(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!configuracionCompleta()) return;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return;

    const { initializeApp, getApps } = await import("firebase/app");
    const { getMessaging, getToken } = await import("firebase/messaging");

    // configuracionCompleta() ya validó que todas estas variables están
    // presentes; el cast a string es seguro en este punto.
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({
          apiKey: apiKey as string,
          projectId: projectId as string,
          messagingSenderId: messagingSenderId as string,
          appId: appId as string,
        });

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(app);

    const token = await getToken(messaging, {
      vapidKey: vapidKey as string,
      serviceWorkerRegistration: registration,
    });
    if (!token) return;

    await api.post("/notificaciones/dispositivos", { token, plataforma: "WEB" });
    tokenRegistrado = token;
  } catch {
    // Push es un extra, no una dependencia crítica: cualquier falla (permiso
    // denegado, SW no soportado, red, etc.) se ignora en silencio.
  }
}

// Da de baja, en el backend, el token registrado en esta sesión. Se llama al
// cerrar sesión; también best-effort, nunca debe bloquear el logout.
export async function eliminarTokenPush(): Promise<void> {
  if (!tokenRegistrado) return;
  const token = tokenRegistrado;
  tokenRegistrado = null;
  try {
    await api.delete(`/notificaciones/dispositivos/${encodeURIComponent(token)}`);
  } catch {
    // best-effort
  }
}
