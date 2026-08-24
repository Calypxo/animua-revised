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
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /Desktop adoption workspace: clearer hierarchy with less visual bulk/);
  assert.match(styles, /@media\s*\(min-width:\s*901px\)/);
  assert.match(styles, /\.selected-pet-box\s*\{[\s\S]*?grid-template-columns:\s*72px\s+minmax\(0,\s*1fr\)\s+auto\s*!important/);
  assert.match(styles, /\.adoption-stepper-item\s*\{[\s\S]*?min-height:\s*72px\s*!important/);
  assert.match(styles, /\.adoption-wizard-actions\s*\{[\s\S]*?justify-content:\s*flex-end\s*!important/);
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

  assert.match(script, /function showAdoptionSubmissionSuccess\(referenceNumber\)/);
  assert.match(script, /title:\s*"Application Submitted"/);
  assert.match(script, /popup:\s*"animua-popup animua-auth-feedback-popup adoption-submission-success-popup"/);
  assert.match(script, /confirmButtonText:\s*"Done"[\s\S]*?showCancelButton:\s*false[\s\S]*?showCloseButton:\s*true/);
  assert.match(script, /const result = await submitAdoptionApplication\(formData\)[\s\S]*?await showAdoptionSubmissionSuccess\(referenceNumber\)/);
  assert.doesNotMatch(script, /Adoption request submitted successfully! Reference:/);
  assert.match(styles, /\.adoption-submission-success-popup \.swal2-actions\s*\{[\s\S]*?justify-content:\s*center\s*!important/);
});
