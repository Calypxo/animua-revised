import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const markup = readFileSync(
  new URL("../pages/public/surrender.html", import.meta.url),
  "utf8",
);
const surrenderScript = readFileSync(
  new URL("../src/public/js/surrenderForm.js", import.meta.url),
  "utf8",
);
const loginScript = readFileSync(
  new URL("../src/auth/login.js", import.meta.url),
  "utf8",
);
const surrenderStyles = readFileSync(
  new URL("../src/css/public/surrender.css", import.meta.url),
  "utf8",
);

test("signed-out visitors are gated before the surrender form can be used", () => {
  assert.match(markup, /id="surrenderAuthPanel"[\s\S]*?id="surrenderAuthLoginButton"/);
  assert.match(markup, /id="surrenderForm" novalidate inert aria-disabled="true"/);
  assert.match(surrenderScript, /form\.inert\s*=\s*locked/);
  assert.match(surrenderScript, /applySurrenderAuthState\(session\)/);
  assert.doesNotMatch(surrenderScript, /if \(!canUseSurrenderForm\) openLoginModal\(\);/);
  assert.match(
    surrenderScript,
    /surrender-hero-actions a\[href=\"#surrenderRequestWorkspace\"\][\s\S]*?if \(!canUseSurrenderForm\) openLoginModal\(event\)/,
  );
});

test("surrender login returns the visitor to the surrender page", () => {
  assert.match(
    surrenderScript,
    /setPostAuthRedirect\("\/pages\/public\/surrender\.html"\)/,
  );
  assert.match(
    loginScript,
    /consumePostAuthRedirect\(\)[\s\S]*?postAuthRedirect \|\| "\/pages\/public\/home\.html"/,
  );
});

test("the guest sign-in state spans and centers within the surrender workspace", () => {
  assert.match(
    markup,
    /surrender\.css\?v=yellow-field-focus-20260829/,
  );
  assert.match(
    surrenderStyles,
    /Signed-out workspace:[\s\S]*?\.surrender-workspace\.is-auth-required\s*\{[\s\S]*?width:\s*min\(100%,\s*900px\)\s*!important;[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;[\s\S]*?min-height:\s*0\s*!important/,
  );
  assert.match(
    surrenderStyles,
    /\.surrender-workspace\.is-auth-required \.surrender-form-wrap\s*\{[\s\S]*?min-height:\s*0\s*!important;[\s\S]*?padding:\s*32px 36px\s*!important/,
  );
  assert.match(
    surrenderStyles,
    /one compact sign-in card[\s\S]*?\.surrender-auth-panel\s*\{[\s\S]*?border:\s*0\s*!important;[\s\S]*?box-shadow:\s*none\s*!important/,
  );
  assert.match(
    surrenderStyles,
    /@media \(min-width: 901px\)[\s\S]*?\.surrender-workspace\.is-auth-required \.surrender-auth-panel\s*\{[\s\S]*?grid-template-columns:\s*56px minmax\(0,\s*1fr\) auto\s*!important/,
  );
});
