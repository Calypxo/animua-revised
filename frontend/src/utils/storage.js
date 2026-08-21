import { API_BASE_URL } from "./api.js";

let currentUser = null;
let sessionRequest = null;

const LEGACY_SESSION_KEYS = [
  "animua_token",
  "user_role",
  "user_name",
  "user_email",
  "user_profile_photo",
  "is_logged_in",
  "show_welcome_toast",
  "pending_verify_email",
  "pending_verify_password",
  "animua_contact_email",
  "animua_quiz_data",
  "animua_match_results",
  "animua_match_metadata",
  "animua_match_fresh",
  "animua_saved_result",
  "animua_selected_pet_id",
  "animua_selected_pet_action",
  "animua_selected_pet_source",
  "animua_selected_pet_timestamp",
  "animua_open_auth_modal",
];

function clearLegacyBrowserSession(storage = globalThis.localStorage) {
  LEGACY_SESSION_KEYS.forEach((key) => storage?.removeItem(key));

  Object.keys(storage || {})
    .filter((key) => key.startsWith("animua_login_failures:"))
    .forEach((key) => storage.removeItem(key));
}

export function setUserSession(user = {}) {
  clearLegacyBrowserSession();
  currentUser = {
    ...user,
    role: user.role || "",
    fullName: user.fullName || "",
    email: user.email || "",
    profilePhotoDataUrl: user.profilePhotoDataUrl || "",
  };

  return currentUser;
}

export function getUserSession() {
  return currentUser;
}

export function getUserRole() {
  return currentUser?.role || "";
}

export function getUserName() {
  return currentUser?.fullName || "";
}

export function getUserEmail() {
  return currentUser?.email || "";
}

export function hasUserSession() {
  return Boolean(currentUser);
}

export function clearUserSession(storage = globalThis.localStorage) {
  currentUser = null;
  sessionRequest = null;
  clearLegacyBrowserSession(storage);
}

export async function ensureUserSession({ force = false } = {}) {
  if (currentUser && !force) return currentUser;
  if (sessionRequest && !force) return sessionRequest;

  sessionRequest = fetch(`${API_BASE_URL}/auth/account`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          clearUserSession();
          return null;
        }

        throw new Error(`Session verification failed (${response.status}).`);
      }

      const data = await response.json();
      return setUserSession(data.account || data.user || {});
    })
    .finally(() => {
      sessionRequest = null;
    });

  return sessionRequest;
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

export function isAuthenticationFailure(errorOrResponse = {}) {
  if (Number(errorOrResponse?.status) === 401) return true;

  const message = String(
    errorOrResponse?.message || errorOrResponse || "",
  ).toLowerCase();
  return message.includes("token has expired") || message.includes("jwt expired");
}
