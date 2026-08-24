import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  isValidRecoveryEmail,
  validateManagementRecoveryPassword,
} from "../src/management/managementRecoveryModel.js";

test("management recovery validates email and the shared strong-password policy", () => {
  assert.equal(isValidRecoveryEmail("admin@animua.test"), true);
  assert.equal(isValidRecoveryEmail("not-an-email"), false);
  assert.equal(validateManagementRecoveryPassword("SecurePass1!", "SecurePass1!"), "");
  assert.match(validateManagementRecoveryPassword("weak", "weak"), /between 8 and 128/);
  assert.match(validateManagementRecoveryPassword("NoSpecial123", "NoSpecial123"), /uppercase, lowercase, number, and special/);
  assert.match(validateManagementRecoveryPassword("SecurePass1!", "Different1!"), /do not match/);
});

test("management login includes the complete accessible recovery workflow", async () => {
  const html = await readFile(new URL("../pages/admin-login.html", import.meta.url), "utf8");
  for (const id of [
    "forgotPasswordBtn",
    "managementRecovery",
    "recoveryEmailForm",
    "recoveryOtpForm",
    "recoveryPasswordForm",
    "recoverySuccessStep",
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), id);
  }
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
});
