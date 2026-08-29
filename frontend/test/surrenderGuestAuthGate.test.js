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
    /surrender\.css\?v=success-without-request-id-20260829/,
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

test("long requester emails wrap inside the surrender review column", () => {
  assert.match(
    surrenderStyles,
    /\.review-summary #reviewOwnerContact\s*\{[^}]*max-width:\s*100%[^}]*overflow-wrap:\s*anywhere[^}]*word-break:\s*break-word/,
  );
});

test("phone progress line connects the numbered surrender steps", () => {
  assert.match(
    surrenderStyles,
    /join the progress line to the numbered step circles[\s\S]*?@media \(max-width: 700px\)[\s\S]*?\.surrender-progress-rail[\s\S]*?border-bottom:\s*0\s*!important/,
  );
  assert.match(
    surrenderStyles,
    /\.surrender-step-nav::before[\s\S]*?top:\s*22px\s*!important;[\s\S]*?left:\s*12\.5%\s*!important;[\s\S]*?right:\s*12\.5%\s*!important/,
  );
  assert.match(
    surrenderStyles,
    /data-step-link="4"[^}]*\.is-active\)::after\s*\{\s*width:\s*75%/,
  );
});

test("the redundant mobile Step 1 of 4 progress strip is removed", () => {
  assert.doesNotMatch(markup, /mobile-form-progress|currentStepText|currentStepLabel|formProgressBar/);
  assert.doesNotMatch(surrenderScript, /STEP_LABELS|mobile-form-progress|currentStepText|currentStepLabel|formProgressBar/);
  assert.doesNotMatch(surrenderStyles, /mobile-form-progress|form-progress-track/);
});

test("the success screen does not expose a request ID card", () => {
  assert.doesNotMatch(markup, /success-request-id|submittedRequestId|>Request ID</);
  assert.doesNotMatch(surrenderScript, /submittedRequestId/);
  assert.doesNotMatch(surrenderStyles, /success-request-id/);
});

test("rapid clicks cannot create parallel surrender requests", () => {
  assert.match(surrenderScript, /let isSubmitting = false;/);
  assert.match(
    surrenderScript,
    /function setSubmitting\(submitting\)[\s\S]*?isSubmitting = submitting;[\s\S]*?classList\.toggle\("is-submitting", submitting\)[\s\S]*?setAttribute\("aria-busy", String\(submitting\)\)[\s\S]*?button\.disabled = submitting \|\| !surrenderAcceptingRequests/,
  );
  assert.match(
    surrenderScript,
    /async function handleSurrenderSubmit\(event\)[\s\S]*?event\.preventDefault\(\);\s*if \(isSubmitting\) return;[\s\S]*?setSubmitting\(true\);[\s\S]*?await submitSurrenderRequest\(requestData\)[\s\S]*?finally \{\s*setSubmitting\(false\);\s*\}/,
  );
  assert.match(
    surrenderStyles,
    /\.surrender-form\.is-submitting\s*\{\s*pointer-events:\s*none\s*!important;/,
  );
});
