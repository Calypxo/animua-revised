import { getToken, getUserRole, clearUserSession } from "../utils/storage.js";
import { API_BASE_URL } from "../utils/api.js";

export async function protectManagementPage() {
  const token = getToken();
  const role = getUserRole();

  console.log("Guard token:", token);
  console.log("Guard role:", role);

  if (!token || (role !== "Admin" && role !== "Staff")) {
    clearUserSession();
    redirectToLogin();
    throw new Error("Unauthorized");
  }

  try {
    const res = await fetch(`${API_BASE_URL}/protected`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Protected route status:", res.status);

    if (!res.ok) {
      clearUserSession();
      redirectToLogin();
      throw new Error("Token invalid");
    }

    const data = await res.json();

    if (data.user?.role && data.user.role !== role) {
      clearUserSession();
      redirectToLogin();
      throw new Error("Role mismatch");
    }

    return true;
  } catch (err) {
    console.error("Guard error:", err);
    clearUserSession();
    redirectToLogin();
    throw err;
  }
}

function redirectToLogin() {
  window.location.href = "/pages/management/admin-login.html";
}