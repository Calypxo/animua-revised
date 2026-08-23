import { API_BASE_URL } from "./api.js";

let currentUser = null;
const MANAGEMENT_SESSION_CACHE_KEY = "animua_management_session_cache";
const MANAGEMENT_SESSION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const LEGACY_SESSION_KEYS = [
  "animua_token",
  "user_role",
  "user_name",
  "user_email",
  "is_logged_in",
  "show_welcome_toast",
  "animua_role",
];

function clearLegacyBrowserSession(storage = globalThis.localStorage) {
  LEGACY_SESSION_KEYS.forEach((key) => storage?.removeItem(key));

  Object.keys(storage || {})
    .filter((key) => (
      key.startsWith("animua_contact_reply_draft:") ||
      key.startsWith("animua_animal_form_draft:")
    ))
    .forEach((key) => storage.removeItem(key));
}

export function setUserSession(user = {}) {
  clearLegacyBrowserSession();
  currentUser = {
    ...user,
    role: user.role || "",
    fullName: user.fullName || "",
    email: user.email || "",
  };

  try {
    globalThis.localStorage?.setItem(
      MANAGEMENT_SESSION_CACHE_KEY,
      JSON.stringify({
        user: currentUser,
        savedAt: Date.now(),
      })
    );
  } catch (error) {
    console.warn("Unable to cache management session summary:", error.message);
  }

  return currentUser;
}

export function getCachedUserSession() {
  try {
    const cached = JSON.parse(
      globalThis.localStorage?.getItem(MANAGEMENT_SESSION_CACHE_KEY) || "null"
    );

    if (!cached?.user || Date.now() - Number(cached.savedAt || 0) > MANAGEMENT_SESSION_CACHE_TTL_MS) {
      globalThis.localStorage?.removeItem(MANAGEMENT_SESSION_CACHE_KEY);
      return null;
    }

    return {
      ...cached.user,
      role: cached.user.role || "",
      fullName: cached.user.fullName || "",
      email: cached.user.email || "",
    };
  } catch (error) {
    globalThis.localStorage?.removeItem(MANAGEMENT_SESSION_CACHE_KEY);
    return null;
  }
}

export function getUserSession() {
  return currentUser;
}

export function getUserRole() {
  return currentUser?.role || "";
}

export function getUserEmail() {
  return currentUser?.email || "";
}

export function getUserName() {
  return currentUser?.fullName || "";
}

export function clearUserSession(storage = globalThis.localStorage) {
  currentUser = null;
  clearLegacyBrowserSession(storage);
  storage?.removeItem(MANAGEMENT_SESSION_CACHE_KEY);
}

export async function endUserSession() {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.warn("Unable to confirm backend logout:", error.message);
  } finally {
    clearUserSession();
    globalThis.sessionStorage?.removeItem("show_welcome_toast");
  }
}
