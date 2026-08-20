export function getToken() {
  return localStorage.getItem("animua_token");
}

export function getUserRole() {
  return localStorage.getItem("user_role");
}

export function getUserName() {
  return localStorage.getItem("user_name");
}

const USER_SESSION_KEYS = [
  "animua_token",
  "user_role",
  "user_name",
  "user_email",
  "user_profile_photo",
  "is_logged_in",
  "show_welcome_toast",
  "sidebar_collapsed",
];

export function clearUserSession(storage = globalThis.localStorage) {
  USER_SESSION_KEYS.forEach((key) => storage.removeItem(key));
}

export function isAuthenticationFailure(errorOrResponse = {}) {
  if (Number(errorOrResponse?.status) === 401) return true;

  const message = String(
    errorOrResponse?.message || errorOrResponse || "",
  ).toLowerCase();
  return message.includes("token has expired") || message.includes("jwt expired");
}
