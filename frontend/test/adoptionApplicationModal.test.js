import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../pages/public/find-furbabies.html", import.meta.url);
const scriptUrl = new URL("../src/public/js/find-furbabies.js", import.meta.url);
const stylesUrl = new URL("../src/css/public/furbabies.css", import.meta.url);

test("the adoption modal hides the animal ID but keeps it for submission", async () => {
  const [page, script] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(scriptUrl, "utf8"),
  ]);

  assert.doesNotMatch(page, /id="selectedPetId"|Animal ID:/);
  assert.doesNotMatch(script, /\["Animal ID",/);
  assert.match(page, /<input type="hidden" id="petIdField" name="pet_id">/);
  assert.match(script, /petIdField\.value = pet\.id \|\| pet\.petId \|\| ""/);
});

test("the desktop adoption modal uses a compact workspace hierarchy", async () => {
  const [page, styles] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(styles, /Desktop adoption workspace: fixed shell with one focused scrolling panel/);
  assert.match(styles, /@media\s*\(min-width:\s*901px\)[\s\S]*?\.adoption-wizard-modal\s*\{[\s\S]*?width:\s*min\(980px,[\s\S]*?height:\s*min\(740px,\s*88dvh\)[\s\S]*?grid-template-columns:\s*190px minmax\(0,\s*1fr\)/);
  assert.match(styles, /Desktop adoption workspace:[\s\S]*?\.adoption-wizard-modal > \.adoption-stepper\s*\{[\s\S]*?position:\s*static\s*!important;[\s\S]*?grid-row:\s*2 \/ 5\s*!important/);
  assert.match(page, /<img[^>]+class="adoption-form-logo"[^>]+src="\/images\/animua_logo1\.svg"/);
  assert.match(styles, /Desktop adoption workspace:[\s\S]*?\.adoption-form-logo\s*\{\s*display:\s*block\s*!important;[\s\S]*?object-fit:\s*contain\s*!important;[\s\S]*?background:\s*transparent\s*!important/);
  assert.match(styles, /Desktop adoption workspace:[\s\S]*?\.adoption-section-title \.fa-shield-heart::before\s*\{\s*content:\s*"\\f007"\s*!important/);
  assert.match(styles, /Desktop adoption workspace:[\s\S]*?\.adoption-section-title > span\s*\{[\s\S]*?width:\s*26px\s*!important;[\s\S]*?height:\s*26px\s*!important;[\s\S]*?font-size:\s*0\.68rem\s*!important/);
  assert.match(styles, /Desktop adoption workspace:[\s\S]*?\.adoption-stepper-item\.active\s*\{[\s\S]*?border-left-color:\s*transparent\s*!important/);
  assert.match(styles, /Desktop adoption workspace:[\s\S]*?\.adopt-form-panel \.adoption-form\s*\{[\s\S]*?grid-row:\s*3\s*!important;[\s\S]*?overflow-y:\s*auto\s*!important/);
  assert.match(styles, /Desktop adoption workspace:[\s\S]*?\.selected-pet-box\s*\{[\s\S]*?grid-template-columns:\s*64px\s+minmax\(0,\s*1fr\)\s+auto\s*!important/);
  assert.match(styles, /Desktop adoption workspace:[\s\S]*?\.adoption-form > \.adoption-wizard-actions\s*\{[\s\S]*?position:\s*static\s*!important;[\s\S]*?margin:\s*14px 0 0\s*!important;[\s\S]*?background:\s*transparent\s*!important/);
  assert.match(styles, /\.adoption-form > \.adoption-wizard-actions \.btn\s*\{[\s\S]*?flex:\s*0 0 auto\s*!important;[\s\S]*?width:\s*auto\s*!important/);
  assert.match(page, /<form id="adoptionForm"[\s\S]*?<div class="form-actions adoption-wizard-actions">[\s\S]*?id="adoptionSubmitBtn"[\s\S]*?<\/div>\s*<\/form>/);
  assert.match(styles, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.adoption-wizard-modal > \.adoption-stepper/);
  assert.match(styles, /Tablet and phone headers keep the same standalone Animua mark[\s\S]*?@media\s*\(max-width:\s*900px\)[\s\S]*?\.adoption-form-logo\s*\{\s*display:\s*block\s*!important;[\s\S]*?object-fit:\s*contain\s*!important;[\s\S]*?background:\s*transparent\s*!important;[\s\S]*?\.adoption-section-title \.fa-shield-heart::before\s*\{\s*content:\s*"\\f007"\s*!important/);
  assert.match(styles, /Tablet and phone headers keep the same standalone Animua mark[\s\S]*?@media\s*\(max-width:\s*760px\)[\s\S]*?\.adoption-form-header\s*\{[\s\S]*?grid-template-columns:\s*38px minmax\(0,\s*1fr\)\s*!important;[\s\S]*?gap:\s*10px\s*!important/);
  assert.match(styles, /Browser zoom can move a desktop window into this effective tablet width[\s\S]*?@media\s*\(min-width:\s*761px\) and \(max-width:\s*900px\)[\s\S]*?\.adoption-wizard-modal > \.adoption-stepper\s*\{[\s\S]*?position:\s*static\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)\s*!important/);
  assert.match(styles, /Browser zoom can move a desktop window into this effective tablet width[\s\S]*?\.adopt-form-panel \.adoption-form\s*\{[\s\S]*?margin:\s*0\s*!important;[\s\S]*?padding:\s*0 20px 20px\s*!important;[\s\S]*?overflow:\s*visible\s*!important/);
  assert.match(styles, /Browser zoom can move a desktop window into this effective tablet width[\s\S]*?body\.furbabies-page\.modal-open \.animua-chatbot\s*\{\s*display:\s*none\s*!important/);
  assert.match(styles, /Readiness labels only need room for two compact lines[\s\S]*?@media\s*\(min-width:\s*761px\)[\s\S]*?grid-template-rows:\s*34px auto\s*!important;[\s\S]*?row-gap:\s*5px\s*!important;[\s\S]*?min-height:\s*34px\s*!important/);
});

test("the applicant fields use the requested desktop-only pairings", async () => {
  const [page, script, styles] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(scriptUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(page, /class="form-group adoption-desktop-email-field" data-adoption-field-step="1"[\s\S]*?id="emailAddress"[\s\S]*?readonly/);
  assert.match(script, /const email = session\.email \|\| "";[\s\S]*?getField\("emailAddress"\)[\s\S]*?emailField\.value = email/);
  assert.match(styles, /\.adoption-desktop-email-field\s*\{\s*display:\s*none\s*!important/);
  assert.match(styles, /@media\s*\(min-width:\s*901px\)[\s\S]*?\.adoption-field-full-name\s*\{[\s\S]*?grid-column:\s*1[\s\S]*?grid-row:\s*1[\s\S]*?\.adoption-field-birthdate\s*\{[\s\S]*?grid-column:\s*2[\s\S]*?grid-row:\s*1/);
  assert.match(styles, /@media\s*\(min-width:\s*901px\)[\s\S]*?\.adoption-field-gender\s*\{[\s\S]*?grid-column:\s*1[\s\S]*?grid-row:\s*2[\s\S]*?\.adoption-field-civil-status\s*\{[\s\S]*?grid-column:\s*2[\s\S]*?grid-row:\s*2/);
  assert.match(styles, /@media\s*\(min-width:\s*901px\)[\s\S]*?\.adoption-field-citizenship\s*\{[\s\S]*?grid-column:\s*1[\s\S]*?grid-row:\s*3[\s\S]*?\.adoption-field-occupation\s*\{[\s\S]*?grid-column:\s*2[\s\S]*?grid-row:\s*3/);
  assert.match(styles, /@media\s*\(min-width:\s*901px\)[\s\S]*?\.adoption-field-contact-number\s*\{[\s\S]*?grid-column:\s*1[\s\S]*?grid-row:\s*4[\s\S]*?\.adoption-desktop-email-field:not\(\.adoption-step-hidden\)\s*\{[\s\S]*?grid-column:\s*2[\s\S]*?grid-row:\s*4/);
  assert.match(styles, /@media\s*\(min-width:\s*901px\)[\s\S]*?\.adoption-field-address\s*\{[\s\S]*?grid-column:\s*1 \/ -1[\s\S]*?grid-row:\s*5/);
  assert.match(styles, /@media\s*\(min-width:\s*901px\)[\s\S]*?\.adoption-field-age\s*\{\s*display:\s*none\s*!important/);
});

test("adoption progress removes the redundant desktop counter and keeps a clear phone tracker", async () => {
  const [page, script, styles] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(scriptUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(page, /id="adoptionStepCounter"[^>]*>Step 1 of 4<\/span>/);
  assert.match(script, /adoptionStepCounter\.textContent = `Step \$\{currentAdoptionStep\} of 4`/);
  assert.match(script, /button\.setAttribute\("aria-current", "step"\)/);
  assert.match(styles, /Final adoption progress hierarchy:[\s\S]*?@media\s*\(min-width:\s*901px\)[\s\S]*?\.adoption-step-counter\s*\{\s*display:\s*none\s*!important/);
  assert.match(styles, /Final adoption progress hierarchy:[\s\S]*?@media\s*\(max-width:\s*760px\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\) repeat\(4,\s*8px\)\s*!important;[\s\S]*?grid-template-rows:\s*30px\s*!important/);
  assert.match(styles, /Final adoption progress hierarchy:[\s\S]*?\.adoption-step-counter\s*\{[\s\S]*?width:\s*max-content\s*!important;[\s\S]*?border-radius:\s*999px\s*!important;[\s\S]*?color:\s*#780116\s*!important/);
  assert.match(styles, /Final adoption progress hierarchy:[\s\S]*?\.adoption-stepper-item > span\s*\{\s*display:\s*none\s*!important/);
  assert.match(styles, /Final adoption progress hierarchy:[\s\S]*?\.adoption-stepper-item:not\(:last-child\)::after\s*\{[\s\S]*?content:\s*none\s*!important;[\s\S]*?display:\s*none\s*!important/);
  assert.match(styles, /Final adoption progress hierarchy:[\s\S]*?\.adoption-stepper-item > :is\(strong, small\)\s*\{\s*display:\s*none\s*!important/);
  assert.match(styles, /Final adoption progress hierarchy:[\s\S]*?\.adoption-stepper-item\.active\s*\{[\s\S]*?background:\s*#780116\s*!important;[\s\S]*?box-shadow:\s*none\s*!important/);
  assert.match(styles, /Final adoption progress hierarchy:[\s\S]*?\[data-adoption-step-target="1"\]\s*\{\s*grid-column:\s*2\s*!important;[\s\S]*?\[data-adoption-step-target="4"\]\s*\{\s*grid-column:\s*5\s*!important/);
});

test("the phone selected-pet heading does not inherit the desktop pill", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.selected-pet-box h3\s*\{[\s\S]*?width:\s*auto\s*!important;[\s\S]*?padding:\s*0\s*!important;[\s\S]*?border-radius:\s*0\s*!important;[\s\S]*?background:\s*transparent\s*!important;[\s\S]*?box-shadow:\s*none\s*!important/);
});

test("the birthdate calendar uses a compact scrollable year menu", async () => {
  const [script, styles] = await Promise.all([
    readFile(scriptUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.doesNotMatch(script, /<select class="calendar-select calendar-year-select"/);
  assert.match(script, /data-calendar-year-trigger/);
  assert.match(script, /data-calendar-year-options/);
  assert.match(script, /data-calendar-year-option=/);
  assert.match(script, /today\.getFullYear\(\) - 100/);
  assert.match(styles, /\.calendar-year-options\s*\{[\s\S]*?max-height:\s*180px\s*!important/);
  assert.match(styles, /\.calendar-year-options\s*\{[\s\S]*?overflow-y:\s*auto\s*!important/);
});

test("the birthdate month menu matches the custom year menu", async () => {
  const [script, styles] = await Promise.all([
    readFile(scriptUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.doesNotMatch(script, /<select class="calendar-select" data-calendar-month/);
  assert.match(script, /data-calendar-month-trigger/);
  assert.match(script, /data-calendar-month-options/);
  assert.match(script, /data-calendar-month-option=/);
  assert.match(script, /isFutureMonth[\s\S]*?disabled aria-disabled/);
  assert.match(styles, /\.calendar-month-options,[\s\S]*?\.calendar-year-options\s*\{[\s\S]*?max-height:\s*180px\s*!important/);
  assert.match(styles, /\.calendar-month-trigger,[\s\S]*?\.calendar-year-trigger\s*\{/);
});

test("a confirmed adoption submission opens the compact account-feedback modal", async () => {
  const [script, styles] = await Promise.all([
    readFile(scriptUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(script, /function showAdoptionSubmissionSuccess\(\)/);
  assert.match(script, /title:\s*"Application Submitted"/);
  assert.doesNotMatch(script, /adoption-success-reference|Reference number/);
  assert.match(script, /popup:\s*"animua-popup animua-auth-feedback-popup adoption-submission-success-popup"/);
  assert.match(script, /confirmButtonText:\s*"Done"[\s\S]*?showCancelButton:\s*false[\s\S]*?showCloseButton:\s*true/);
  assert.match(script, /await submitAdoptionApplication\(formData\)[\s\S]*?await showAdoptionSubmissionSuccess\(\)/);
  assert.doesNotMatch(script, /Adoption request submitted successfully! Reference:/);
  assert.match(styles, /\.adoption-submission-success-popup \.swal2-actions\s*\{[\s\S]*?justify-content:\s*center\s*!important/);
});

test("rapid submit clicks cannot create parallel adoption requests", async () => {
  const script = await readFile(scriptUrl, "utf8");

  assert.match(script, /let isSubmittingAdoption = false;/);
  assert.match(script, /function setAdoptionSubmitting\(isSubmitting\)[\s\S]*?"Submitting\.\.\."[\s\S]*?toggleAttribute\("aria-busy", isSubmittingAdoption\)[\s\S]*?syncAdoptionSubmitState\(\)/);
  assert.match(script, /adoptionForm\.addEventListener\("submit", async \(event\) => \{[\s\S]*?event\.preventDefault\(\);\s*if \(isSubmittingAdoption\) return;/);
  assert.match(script, /if \(!validateAdoptionStep\(4\)\)[\s\S]*?setAdoptionSubmitting\(true\);[\s\S]*?await submitAdoptionApplication\(formData\)/);
  assert.match(script, /catch \(error\)[\s\S]*?finally \{\s*setAdoptionSubmitting\(false\);\s*\}/);
  assert.match(script, /adoptionSubmitBtn\.disabled = isSubmittingAdoption \|\|/);
});
