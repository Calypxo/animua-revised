import test from "node:test";
import assert from "node:assert/strict";

import {
  hasPermission,
  canAccessModule,
} from "../src/auth/permissions.js";

test("UT-004 hasPermission follows the current ANIMUA role/action matrix", () => {
  const scenarios = [
    ["Admin", "users", "delete", true, "Admin may delete users"],
    ["Admin", "contact", "delete", false, "Admin has no contact delete action"],
    ["Staff", "adoption", "approve", true, "Staff may approve adoption applications"],
    ["Staff", "inventory", "delete", false, "Staff may not delete inventory"],
    ["Veterinarian", "animals", "add_medical", true, "Veterinarian may add medical records"],
    ["Veterinarian", "adoption", "approve", false, "Veterinarian may not approve adoptions"],
    ["Public", "dashboard", "view", false, "Public has no management permissions"],
    ["Unknown", "dashboard", "view", false, "Invalid role has no permissions"],
  ];

  for (const [role, moduleName, action, expected, label] of scenarios) {
    assert.equal(hasPermission(role, moduleName, action), expected, label);
  }
});

test("UT-005 canAccessModule follows the current management module matrix", () => {
  const scenarios = [
    ["Admin", "users", true, "Admin may access User Management"],
    ["Admin", "not-a-module", false, "Unknown module is denied"],
    ["Staff", "adoption", true, "Staff may access Adoption Applications"],
    ["Staff", "audit", false, "Staff may not access Audit Trail"],
    ["Veterinarian", "quarantine", true, "Veterinarian may access Quarantine"],
    ["Veterinarian", "adoption", false, "Veterinarian may not access Adoption Applications"],
    ["Public", "dashboard", false, "Public may not access management Dashboard"],
    ["Unknown", "dashboard", false, "Invalid role may not access modules"],
  ];

  for (const [role, moduleName, expected, label] of scenarios) {
    assert.equal(canAccessModule(role, moduleName), expected, label);
  }
});
