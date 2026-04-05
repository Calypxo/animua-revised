import { getToken, getUserRole, clearUserSession } from "../utils/storage.js";
import { API_BASE_URL } from "../utils/api.js";

export async function protectManagementPage() {
  const token = getToken();
  const role  = getUserRole();

  console.log("Guard token:", token);
  console.log("Guard role:", role);

  // ── Step 1: basic local check ──────────────────────
  // Your backend stores role as "Admin" or "Staff"
  if (!token || (role !== "Admin" && role !== "Staff")) {
    clearUserSession();
    redirectToLogin();
    throw new Error("Unauthorized");
  }

  // ── Step 2: verify token against backend ──────────
  try {
    const res = await fetch(`${API_BASE_URL}/protected`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Protected route status:", res.status);

    // 401 / 403 = definitely invalid — redirect
    if (res.status === 401 || res.status === 403) {
      clearUserSession();
      redirectToLogin();
      throw new Error("Token invalid or forbidden");
    }

    // Any other non-ok status (500, network hiccup, etc.)
    // — don't boot the user, just warn and continue.
    // Remove this leniency once your API is stable.
    if (!res.ok) {
      console.warn(`Guard: /protected returned ${res.status} — allowing through (non-auth error).`);
      return true;
    }

    const data = await res.json();

    // If backend returns a role and it conflicts with local storage → re-auth
    if (data.user?.role && data.user.role !== role) {
      console.warn("Guard: role mismatch — local:", role, "server:", data.user.role);
      clearUserSession();
      redirectToLogin();
      throw new Error("Role mismatch");
    }

    return true;

  } catch (err) {
    // Only redirect if it's an auth error we explicitly threw above.
    // Network errors (offline, CORS, API down) should NOT boot the user.
    if (err.message === "Token invalid or forbidden" || err.message === "Role mismatch") {
      throw err; // already redirected above
    }

    // Network / fetch error — allow through so dev work isn't blocked
    console.warn("Guard: network error on /protected check — allowing through.", err.message);
    return true;
  }
}

function redirectToLogin() {
  window.location.href = "/pages/admin-login.html";
}