import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loginScriptUrl = new URL("../src/auth/login.js", import.meta.url);
const globalStylesUrl = new URL("../src/css/global.css", import.meta.url);

test("public login explains that valid management accounts use the management portal", async () => {
  const [script, styles] = await Promise.all([
    readFile(loginScriptUrl, "utf8"),
    readFile(globalStylesUrl, "utf8"),
  ]);

  assert.match(
    script,
    /data\.code === "MANAGEMENT_PORTAL_REQUIRED"[\s\S]*?title:\s*"Management Use Only"[\s\S]*?This account is for management use only\.[\s\S]*?Please sign in through the ANIMUA Management Portal\./,
  );
  assert.match(
    script,
    /popup:\s*"animua-popup animua-auth-feedback-popup management-only-popup"/,
  );
  assert.match(styles, /\.management-only-popup \.swal2-title\s*\{[\s\S]*?font-size:\s*1\.3rem\s*!important;/);
  assert.match(styles, /\.management-only-popup \.swal2-html-container\s*\{[\s\S]*?font-size:\s*0\.82rem\s*!important;/);
  assert.match(styles, /\.management-only-popup \.animua-confirm\s*\{[\s\S]*?min-width:\s*128px\s*!important;[\s\S]*?min-height:\s*36px\s*!important;[\s\S]*?font-size:\s*0\.8rem\s*!important;/);
  assert.match(
    script,
    /title:\s*"Login Failed"[\s\S]*?Invalid email or password\./,
  );
});
