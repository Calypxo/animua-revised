import { API_BASE_URL } from "./api.js";

let currentUser = null;

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

  return currentUser;
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
