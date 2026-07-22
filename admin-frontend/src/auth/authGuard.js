import {
  getToken,
  getUserRole,
  clearUserSession,
} from "../utils/storage.js";

import { API_BASE_URL } from "../utils/api.js";

import {
  normalizeRole,
  canAccessModule,
} from "./permissions.js";

const MANAGEMENT_ROLES = [
  "Admin",
  "Staff",
  "Veterinarian",
];

/**
 * Protects pages that belong to the management frontend.
 *
 * This confirms that:
 * 1. A token exists.
 * 2. The locally stored role is a management role.
 * 3. The backend confirms the current token, role, and account status.
 */
export async function protectManagementPage() {
  const token = getToken();
  const storedRole = getUserRole();
  const role = normalizeRole(storedRole);

  console.log("Guard token exists:", Boolean(token));
  console.log("Guard stored role:", storedRole);
  console.log("Guard normalized role:", role);

  if (
    !token ||
    !MANAGEMENT_ROLES.includes(role)
  ) {
    handleUnauthorizedAccess(
      "Missing token or invalid management role."
    );
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/protected`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "Protected route status:",
      response.status
    );

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      handleUnauthorizedAccess(
        "The current session is invalid, inactive, or forbidden."
      );
    }

    if (!response.ok) {
      clearUserSession();
      redirectToLogin();

      throw createAuthorizationError(
        `Session verification failed with status ${response.status}.`
      );
    }

    const data = await response.json();

    const serverRole = normalizeRole(
      data.user?.role
    );

    if (
      !serverRole ||
      !MANAGEMENT_ROLES.includes(serverRole)
    ) {
      handleUnauthorizedAccess(
        "Server returned an invalid management role."
      );
    }

    if (serverRole !== role) {
      console.warn("Guard role mismatch:", {
        localRole: role,
        serverRole,
      });

      handleUnauthorizedAccess(
        "Stored role does not match the current server role."
      );
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

    console.error(
      "Guard: unable to verify the current session.",
      error
    );

    clearUserSession();
    redirectToLogin();

    throw createAuthorizationError(
      "Unable to verify your session. Please log in again."
    );
  }
}

/**
 * Protects a page using an explicit list of roles.
 *
 * Example:
 * await protectPageByRole([
 *   "Admin",
 *   "Veterinarian",
 * ]);
 */
export async function protectPageByRole(
  allowedRoles = []
) {
  const session =
    await protectManagementPage();

  const normalizedAllowedRoles =
    allowedRoles
      .map((role) => normalizeRole(role))
      .filter(Boolean);

  if (
    !normalizedAllowedRoles.includes(
      session.role
    )
  ) {
    redirectToUnauthorizedPage();

    throw createAuthorizationError(
      `Role ${session.role} cannot access this page.`
    );
  }

  return session;
}

/**
 * Protects a page using the module permissions
 * defined in permissions.js.
 *
 * Examples:
 * await protectPageByModule("users");
 * await protectPageByModule("inventory");
 * await protectPageByModule("audit");
 */
export async function protectPageByModule(
  moduleName
) {
  const session =
    await protectManagementPage();

  const normalizedModule = String(
    moduleName || ""
  )
    .trim()
    .toLowerCase();

  if (!normalizedModule) {
    redirectToUnauthorizedPage();

    throw createAuthorizationError(
      "A valid module name is required."
    );
  }

  if (
    !canAccessModule(
      session.role,
      normalizedModule
    )
  ) {
    redirectToUnauthorizedPage();

    throw createAuthorizationError(
      `Role ${session.role} cannot access the ${normalizedModule} module.`
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
  window.location.replace(
    "/pages/admin-login.html"
  );
}

function redirectToUnauthorizedPage() {
  window.location.replace(
    "/pages/unauthorized.html"
  );
}