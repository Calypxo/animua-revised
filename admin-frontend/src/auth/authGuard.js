import {
  clearUserSession,
  getCachedUserSession,
  setUserSession,
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
 * The backend confirms the HttpOnly session, current role, and account status.
 */
export async function protectManagementPage() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/protected`,
      {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
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

    const user = setUserSession(data.user);

    return {
      authenticated: true,
      role: serverRole,
      user,
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

    const cachedUser = getCachedUserSession();
    const cachedRole = normalizeRole(cachedUser?.role);

    if (
      isNetworkAuthError(error) &&
      cachedRole &&
      MANAGEMENT_ROLES.includes(cachedRole)
    ) {
      return {
        authenticated: true,
        role: cachedRole,
        user: setUserSession(cachedUser),
        verifiedByServer: false,
        offline: true,
      };
    }

    clearUserSession();
    redirectToLogin();

    throw createAuthorizationError(
      "Unable to verify your session. Please log in again."
    );
  }
}

function isNetworkAuthError(error) {
  if (!navigator.onLine) return true;

  const message = String(error?.message || "");
  return error instanceof TypeError ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("Unable to connect");
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
