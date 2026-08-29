import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssUrl = new URL("../src/css/public/my-submissions.css", import.meta.url);
const scriptUrl = new URL("../src/public/js/my-submissions.js", import.meta.url);

test("application details use a wider fluid tablet dialog", async () => {
  const [css, script] = await Promise.all([
    readFile(cssUrl, "utf8"),
    readFile(scriptUrl, "utf8"),
  ]);

  assert.match(script, /width:\s*"min\(720px, calc\(100vw - 28px\)\)"/);
  assert.match(css, /@media\s*\(min-width:\s*681px\)\s*and\s*\(max-width:\s*1024px\)/);
  assert.match(css, /grid-template-columns:\s*clamp\(120px,\s*19vw,\s*148px\)\s+minmax\(0,\s*1fr\)\s*!important/);
  assert.match(css, /grid-template-columns:\s*clamp\(120px,\s*19vw,\s*148px\)\s+minmax\(0,\s*1fr\)\s*!important;[\s\S]*?margin-top:\s*16px\s*!important/);
  assert.match(css, /max-height:\s*calc\(100dvh - 32px\)\s*!important/);
});

test("phone application details remain a floating dialog and scroll internally", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(css, /width:\s*min\(520px,\s*calc\(100vw - 28px\)\)\s*!important/);
  assert.match(css, /height:\s*auto\s*!important;[\s\S]*?max-height:\s*min\(84dvh,\s*760px\)\s*!important/);
  assert.match(css, /max-height:\s*min\(84dvh,\s*760px\)\s*!important;[\s\S]*?overflow-y:\s*auto\s*!important/);
  assert.match(css, /min-height:\s*0\s*!important/);
  assert.match(css, /position:\s*sticky\s*!important;[\s\S]*?top:\s*0\s*!important/);
  assert.match(css, /padding-bottom:\s*max\(20px,\s*env\(safe-area-inset-bottom\)\)\s*!important/);
  assert.match(css, /\.application-detail-header \+ \.application-detail-hero,[\s\S]*?margin-top:\s*14px\s*!important/);
});

test("approved cards have one consistent mobile inset instead of stacked margins", async () => {
  const [css, script] = await Promise.all([
    readFile(cssUrl, "utf8"),
    readFile(scriptUrl, "utf8"),
  ]);

  assert.match(css, /\.adoption-detail-modal \.approved-next-steps,[\s\S]*?margin:\s*0\s*!important/);
  assert.match(css, /\.approved-next-steps > :is\([\s\S]*?\.schedule-card-action-row,[\s\S]*?margin-inline:\s*12px\s*!important/);
  assert.match(script, /class="schedule-card-primary-btn" data-schedule-kind="adoption"/);
  assert.match(script, /class="\$\{!hasSchedule \? "schedule-card-primary-btn" : ""\}"[\s\S]*?data-schedule-kind="surrender"/);
  assert.match(css, /\.schedule-card-action-row > \.schedule-card-primary-btn,[\s\S]*?width:\s*100%\s*!important;[\s\S]*?max-width:\s*100%\s*!important;[\s\S]*?min-height:\s*44px\s*!important/);
  assert.match(css, /white-space:\s*normal\s*!important;[\s\S]*?overflow:\s*visible\s*!important/);
});

test("accepted surrender scheduling remains visible until a real appointment is completed", async () => {
  const script = await readFile(scriptUrl, "utf8");

  assert.match(script, /function hasConfirmedAttendance\(details = \{\}, kind = "adoption"\)/);
  assert.match(script, /kind === "surrender"[\s\S]*?hasScheduleValue\(details\.surrenderAppointment\)/);
  assert.match(script, /!arrivalConfirmed && \(!hasSchedule \|\| canReschedule\)/);
  assert.match(script, />\$\{hasSchedule \? "Request Re-sched" : "Schedule Appointment"\}<\/button>/);
});

test("confirmed adoption and surrender attendance remove every reschedule action", async () => {
  const script = await readFile(scriptUrl, "utf8");

  assert.match(script, /const arrivalConfirmed = hasConfirmedAttendance\(details, "adoption"\)/);
  assert.match(script, /\$\{hasSchedule && !arrivalConfirmed \? `/);
  assert.match(script, /!hasSchedule && !arrivalConfirmed \? '<div class="schedule-card-action-row"/);
  assert.match(script, /hasSchedule && !arrivalConfirmed \? renderPickupRescheduleWarning\(rescheduleCount\)/);
  assert.match(script, /Your pet pickup has been confirmed\./);
  assert.match(script, /Your surrender drop-off has been confirmed\./);
});

test("very narrow and short screens retain dedicated compact layouts", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(css, /@media\s*\(max-width:\s*360px\)/);
  assert.match(css, /@media\s*\(max-width:\s*1024px\)\s*and\s*\(max-height:\s*600px\)/);
  assert.match(css, /flex-wrap:\s*wrap\s*!important;[\s\S]*?white-space:\s*normal\s*!important/);
});
