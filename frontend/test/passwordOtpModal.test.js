import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publicUiScript = readFileSync(
  new URL("../src/public/js/public-ui.js", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(
  new URL("../src/css/global.css", import.meta.url),
  "utf8",
);

test("OTP step force-hides the duplicate SweetAlert action footer", () => {
  assert.match(
    publicUiScript,
    /setPasswordOtpSwalActionsHidden[\s\S]*?style\.setProperty\("display", "none", "important"\)/,
  );
  assert.match(publicUiScript, /window\.setTimeout\(applyDisplay, 50\)/);
});

test("sending OTP centers the only visible loading action", () => {
  assert.match(
    globalStyles,
    /\.change-password-popup\.swal2-loading \.change-password-actions,[\s\S]*?grid-template-columns:\s*minmax\(220px, 0\.48fr\)\s*!important;[\s\S]*?justify-content:\s*center\s*!important;/,
  );
});

test("OTP uses one centered pill action while idle, disabled, and verifying", () => {
  assert.doesNotMatch(publicUiScript, /class="password-otp-cancel"/);
  assert.match(
    publicUiScript,
    /stylePasswordOtpActionButtons[\s\S]*?setProperty\("border-radius", "999px", "important"\)/,
  );
  assert.match(
    globalStyles,
    /\.change-password-popup \.password-change-otp-screen \.password-otp-actions[\s\S]*?grid-template-columns:\s*minmax\(0, 306px\)\s*!important;[\s\S]*?justify-content:\s*center\s*!important/,
  );
  assert.match(
    globalStyles,
    /#confirm-password-change-otp-btn\.auth-submit-btn\[aria-busy="true"\][\s\S]*?border-radius:\s*999px\s*!important/,
  );
});

test("password success opens as the compact login-feedback modal", () => {
  assert.match(
    publicUiScript,
    /showPasswordSuccessFeedback[\s\S]*?icon:\s*"success"[\s\S]*?popup:\s*"animua-popup animua-auth-feedback-popup password-update-success-popup"/,
  );
  assert.match(
    publicUiScript,
    /confirmButtonText:\s*"Done"[\s\S]*?showCancelButton:\s*false[\s\S]*?showCloseButton:\s*true/,
  );
  assert.match(publicUiScript, /showPasswordSuccessFeedback\(\s*"Password Updated"/);
  assert.match(
    globalStyles,
    /\.password-update-success-popup \.swal2-cancel[\s\S]*?display:\s*none\s*!important/,
  );
});
