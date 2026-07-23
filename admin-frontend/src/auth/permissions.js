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

    quarantine: [
      "view",
    ],

    inventory: [
      "view",
      "create",
      "edit",
      "delete",
      "stock_in",
      "consume_general",
      "consume_medical",
    ],

    adoption: [
      "view",
      "review",
      "approve",
      "reject",
      "finalize",
    ],

    reports: [
      "view",
    ],

    archive: [
      "view",
      "restore",
    ],

    audit: [
      "view",
    ],

    announcements: [
      "view", 
      "create", 
      "edit", 
      "delete", 
      "publish"
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
      "mark_ready",
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

    quarantine: [
      "view",
    ],

    inventory: [
      "view",
      "create",
      "edit",
      "stock_in",
      "consume_general",
    ],

    adoption: [
      "view",
      "review",
      "approve",
      "reject",
      "finalize",
    ],

    reports: [
      "view",
    ],

    archive: [
      "view",
    ],

    announcements: [
      "view", 
      "create", 
      "edit", 
      "publish"
    ],
  },

  Veterinarian: {
    dashboard: [
      "view",
    ],

    animals: [
      "view",
      "send_to_quarantine",
      "edit_behavioral",
      "add_medical",
      "edit_medical",
      "set_clearance",
    ],

    quarantine: [
      "view",
    ],

    inventory: [
      "view",
      "consume_medical",
    ],

    reports: [
      "view",
    ],

    archive: [
      "view",
    ],

    announcements: [
      "view", 
      "create", 
      "edit", 
      "publish"
    ],
  },
};

export function normalizeRole(role) {
  if (!role) {
    return "";
  }

  const normalized = String(role)
    .trim()
    .toLowerCase();

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

  const rolePermissions =
    ROLE_PERMISSIONS[normalizedRole];

  if (!rolePermissions) {
    return false;
  }

  const modulePermissions =
    rolePermissions[moduleName];

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
