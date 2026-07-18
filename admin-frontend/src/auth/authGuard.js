import {
  getToken,
  getUserRole,
  clearUserSession,
} from "../utils/storage.js";

import { API_BASE_URL } from "../utils/api.js";
import { normalizeRole } from "./permissions.js";

const MANAGEMENT_ROLES = [
  "Admin",
  "Staff",
  "Veterinarian",
];

/**
 * Protects pages that belong to the management/admin frontend.
 *
 * This only checks whether the user belongs to an allowed management role.
 * Specific page permissions are handled separately using permissions.js.
 */
export async function protectManagementPage() {
  const token = getToken();
  const storedRole = getUserRole();
  const role = normalizeRole(storedRole);

  console.log("Guard token exists:", Boolean(token));
  console.log("Guard stored role:", storedRole);
  console.log("Guard normalized role:", role);

  // Step 1: Validate locally stored session
  if (!token || !MANAGEMENT_ROLES.includes(role)) {
    handleUnauthorizedAccess("Missing token or invalid management role.");
  }

  // Step 2: Verify the token with the backend
  try {
    const response = await fetch(`${API_BASE_URL}/protected`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Protected route status:", response.status);

    if (response.status === 401 || response.status === 403) {
      handleUnauthorizedAccess("Token is invalid or forbidden.");
    }

    if (!response.ok) {
      console.warn(
        `Guard: /protected returned ${response.status}. ` +
        "Access is temporarily allowed because this is not an authentication error."
      );

      return {
        authenticated: true,
        role,
        verifiedByServer: false,
      };
    }

    const data = await response.json();

    const serverRole = normalizeRole(data.user?.role);

    if (!serverRole || !MANAGEMENT_ROLES.includes(serverRole)) {
      handleUnauthorizedAccess("Server returned an invalid management role.");
    }

    if (serverRole !== role) {
      console.warn(
        "Guard role mismatch:",
        {
          localRole: role,
          serverRole,
        }
      );

      handleUnauthorizedAccess("Stored role does not match the server role.");
    }

    return {
      authenticated: true,
      role: serverRole,
      user: data.user,
      verifiedByServer: true,
    };
  } catch (error) {
    if (error.name === "AuthorizationError") {
      throw error;
    }

    console.warn(
      "Guard: unable to verify the token because of a network or server error.",
      error.message
    );

    return {
      authenticated: true,
      role,
      verifiedByServer: false,
    };
  }
}

/**
 * Protects a page using a list of roles.
 *
 * Example:
 * await protectPageByRole(["Admin", "Veterinarian"]);
 */
export async function protectPageByRole(allowedRoles = []) {
  const session = await protectManagementPage();

  const normalizedAllowedRoles = allowedRoles
    .map((role) => normalizeRole(role))
    .filter(Boolean);

  if (!normalizedAllowedRoles.includes(session.role)) {
    redirectToUnauthorizedPage();
    throw createAuthorizationError(
      `Role ${session.role} cannot access this page.`
    );
  }

  return session;
}

function handleUnauthorizedAccess(message) {
  clearUserSession();
  redirectToLogin();
  throw createAuthorizationError(message);
}

function createAuthorizationError(message) {
  const error = new Error(message);
  error.name = "AuthorizationError";
  return error;
}

function redirectToLogin() {
  window.location.replace("/pages/admin-login.html");
}

function redirectToUnauthorizedPage() {
  window.location.replace("/pages/unauthorized.html");
}