export function getToken() {
  return localStorage.getItem("animua_token");
}

export function getUserRole() {
  return localStorage.getItem("user_role");
}

export function getUserName() {
  return localStorage.getItem("user_name");
}

export function clearUserSession() {
  localStorage.removeItem("animua_token");
  localStorage.removeItem("user_role");
  localStorage.removeItem("user_name");
  localStorage.removeItem("user_email");
  localStorage.removeItem("show_welcome_toast");
  localStorage.removeItem("sidebar_collapsed");
}