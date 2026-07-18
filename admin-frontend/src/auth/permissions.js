export const USER_ROLES = {
  ADMIN: "Admin",
  STAFF: "Staff",
  VETERINARIAN: "Veterinarian",
};

export const ROLE_PERMISSIONS = {
  Admin: {
    dashboard: [
      "view",
    ],

    users: [
      "view",
      "create",
      "edit",
      "delete",
    ],

    animals: [
      "view",
      "edit_basic",
      "upload_photo",
      "send_to_quarantine",
      "edit_behavioral",
      "add_medical",
      "edit_medical",
      "set_clearance",
      "mark_ready",
      "process_adoption",
      "archive",
      "restore",
      ],

    intake: [
      "view",
      "create",
      "edit",
      "approve",
      "reject",
      "convert",
    ],

    surrender: [
      "view",
      "approve",
      "reject",
      "convert",
    ],

    inventory: [
      "view",
      "create",
      "edit",
      "delete",
      "consume",
    ],

    adoption: [
      "view",
      "review",
      "approve",
      "reject",
      "finalize",
    ],

    archive: [
      "view",
      "restore",
    ],

    audit: [
      "view",
    ],
  },

  Staff: {
    dashboard: [
      "view",
    ],

    animals: [
      "view",
      "edit_basic",
      "upload_photo",
      "send_to_quarantine",
      "process_adoption",
    ],

    intake: [
      "view",
      "create",
      "edit",
      "approve",
      "reject",
      "convert",
    ],

    surrender: [
      "view",
      "approve",
      "reject",
      "convert",
    ],

    inventory: [
      "view",
      "consume",
    ],

    adoption: [
      "view",
      "review",
      "approve",
      "reject",
      "finalize",
    ],

    archive: [
      "view",
    ],
  },

  Veterinarian: {
    dashboard: [
      "view",
    ],

    animals: [
      "view",
      "edit_behavioral",
      "add_medical",
      "edit_medical",
      "set_clearance",
    ],

    intake: [
      "view",
    ],

    surrender: [
      "view",
    ],

    inventory: [
      "view",
      "consume",
    ],

    adoption: [
      "view",
    ],

    archive: [
      "view",
    ],
  },
};

export function normalizeRole(role) {
  if (!role) {
    return "";
  }

  const normalized = String(role).trim().toLowerCase();

  if (normalized === "admin") {
    return USER_ROLES.ADMIN;
  }

  if (normalized === "staff") {
    return USER_ROLES.STAFF;
  }

  if (
    normalized === "veterinarian" ||
    normalized === "vet"
  ) {
    return USER_ROLES.VETERINARIAN;
  }

  return "";
}

export function hasPermission(
  role,
  moduleName,
  action
) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return false;
  }

  const permissions =
    ROLE_PERMISSIONS[normalizedRole];

  if (!permissions) {
    return false;
  }

  const modulePermissions =
    permissions[moduleName];

  if (!Array.isArray(modulePermissions)) {
    return false;
  }

  return modulePermissions.includes(action);
}

export function canAccessModule(
  role,
  moduleName
) {
  return hasPermission(
    role,
    moduleName,
    "view"
  );
}