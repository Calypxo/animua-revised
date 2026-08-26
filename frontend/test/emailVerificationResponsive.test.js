import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registerScript = readFileSync(
  new URL("../src/auth/register.js", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(
  new URL("../src/css/global.css", import.meta.url),
  "utf8",
);

test("email verification stays inside the existing auth card at every viewport", () => {
  assert.match(
    registerScript,
    /authModal\?\.classList\.add\("register-mode", "email-verification-mode"\)/,
  );
  assert.match(
    registerScript,
    /if \(screen\.parentElement !== registerSection\) \{[\s\S]*?registerSection\.appendChild\(screen\)/,
  );
  assert.match(
    globalStyles,
    /@media \(min-width: 821px\)[\s\S]*?\.auth-modal-card:has\(\.email-verification-screen\)[\s\S]*?width:\s*min\(86vw, 960px\)\s*!important;[\s\S]*?height:\s*min\(82vh, 600px\)\s*!important;/,
  );
});

test("phone OTP containment does not change tablet or laptop breakpoints", () => {
  assert.match(
    globalStyles,
    /Email OTP modal: phone-only containment[\s\S]*?@media \(max-width: 560px\)/,
  );
  assert.match(
    globalStyles,
    /#authModal\.email-verification-mode \.auth-modal-left \{[\s\S]*?display:\s*none\s*!important/,
  );
  assert.match(
    globalStyles,
    /#authModal\.email-verification-mode \.auth-modal-card \{[\s\S]*?height:\s*min\(86dvh, 760px\)\s*!important;[\s\S]*?display:\s*block\s*!important/,
  );
  assert.match(
    globalStyles,
    /#authModal\.email-verification-mode \.auth-modal-right \{[\s\S]*?overflow-y:\s*auto\s*!important/,
  );
  assert.match(
    globalStyles,
    /#authModal\.email-verification-mode #register-section :is\([\s\S]*?\.auth-switch-inline\.hidden[\s\S]*?\)[\s\S]*?display:\s*none\s*!important/,
  );
});
