import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import firebaseApp from "../config/firebase.js";
import { apiFetch } from "../utils/api.js";

const TOKEN_STORAGE_KEY = "animua_management_fcm_token";
const VAPID_KEY = String(import.meta.env.VITE_FIREBASE_VAPID_KEY || "").trim();
let foregroundListenerBound = false;
let messagingInstance = null;

async function getMessagingInstance() {
  if (!(await isSupported())) return null;
  messagingInstance ||= getMessaging(firebaseApp);
  return messagingInstance;
}

async function getServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing || navigator.serviceWorker.ready;
}

function storedToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function storeToken(token = "") {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // A private browsing policy can disable local storage. The FCM token still works.
  }
}

function dispatchForegroundMessage(payload = {}) {
  window.dispatchEvent(new CustomEvent("animua:push-notification", { detail: payload }));
}

async function bindForegroundListener() {
  if (foregroundListenerBound) return;
  const messaging = await getMessagingInstance();
  if (!messaging) return;
  foregroundListenerBound = true;
  onMessage(messaging, (payload) => {
    dispatchForegroundMessage(payload);
  });
}

export async function getManagementPushState() {
  const supported = Boolean(
    "Notification" in window &&
    "serviceWorker" in navigator &&
    await isSupported()
  );
  const permission = supported ? Notification.permission : "unsupported";
  return {
    supported,
    configured: Boolean(VAPID_KEY),
    permission,
    enabled: supported && Boolean(VAPID_KEY) && permission === "granted" && Boolean(storedToken()),
  };
}

async function registerCurrentBrowser({ requestPermission = false } = {}) {
  const messaging = await getMessagingInstance();
  if (!messaging) throw new Error("Browser notifications are not supported on this device.");
  if (!VAPID_KEY) throw new Error("Browser notifications need the Firebase Web Push public key.");

  let permission = Notification.permission;
  if (permission === "default" && requestPermission) {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Browser notifications are blocked. Allow them in the browser site settings first."
        : "Notification permission was not granted."
    );
  }

  const serviceWorkerRegistration = await getServiceWorkerRegistration();
  if (!serviceWorkerRegistration) throw new Error("The management service worker is unavailable.");
  const token = await getToken(messaging, {
    serviceWorkerRegistration,
    vapidKey: VAPID_KEY,
  });
  if (!token) throw new Error("Firebase did not return a browser notification token.");

  await apiFetch("/notifications/push-subscriptions", {
    method: "POST",
    body: JSON.stringify({ token, userAgent: navigator.userAgent }),
  });
  storeToken(token);
  await bindForegroundListener();
  return token;
}

export async function enableManagementPushNotifications() {
  return registerCurrentBrowser({ requestPermission: true });
}

export async function syncManagementPushNotifications() {
  if (!("Notification" in window) || Notification.permission !== "granted" || !VAPID_KEY) return false;
  await registerCurrentBrowser({ requestPermission: false });
  return true;
}

export async function disableManagementPushNotifications() {
  const token = storedToken();
  if (token) {
    await apiFetch("/notifications/push-subscriptions", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    });
  }

  const messaging = await getMessagingInstance();
  if (messaging) await deleteToken(messaging).catch(() => false);
  storeToken();
  return true;
}
