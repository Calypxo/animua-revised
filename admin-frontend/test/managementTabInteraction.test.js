import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function managementSource(fileName) {
  return readFile(new URL(`../src/management/${fileName}`, import.meta.url), "utf8");
}

const compatibility = await managementSource("compatibilityQuiz.js");
const contactMessages = await managementSource("contactMessages.js");
const intake = await managementSource("intake.js");
const users = await managementSource("userManagement.js");
const archives = await managementSource("archivedRecords.js");
const audit = await managementSource("auditTrail.js");
const reports = await managementSource("reports.js");

test("Compatibility Quiz provides complete roving-tab keyboard navigation", () => {
  assert.match(compatibility, /button\.tabIndex=active\?0:-1/);
  assert.match(compatibility, /button\.addEventListener\("keydown",handleWorkspaceTabKeydown\)/);
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"]) {
    assert.match(compatibility, new RegExp(`event\\.key===\\"${key}\\"`));
  }
  assert.match(compatibility, /event\.preventDefault\(\)/);
  assert.match(compatibility, /showWorkspaceTab\(tabs\[nextIndex\]\.dataset\.cqTab,\{focus:true,smooth:true\}\)/);
  assert.match(compatibility, /selectedButton\.focus\(\{preventScroll:true\}\)/);
  assert.match(compatibility, /selectedButton\.scrollIntoView\?\.\(/);
});

test("older management tab resets bring the restored selection back into view", () => {
  assert.match(contactMessages, /querySelector\('\.ap-tab\[data-status=""\]'\)\?\.scrollIntoView/);
  assert.match(intake, /querySelector\('\.intake-tab\[data-tab="all"\]'\)\?\.scrollIntoView/);
  assert.match(users, /querySelector\('\.um-tab\[data-tab="all"\]'\)\?\.scrollIntoView/);
  assert.match(archives, /querySelector\('\.archive-tab\[data-tab="all"\]'\)\?\.scrollIntoView/);
  assert.match(audit, /keepSelectedAuditViewVisible\(\);/);
});

test("selected management tabs stay visible after direct and programmatic changes", () => {
  for (const source of [contactMessages, intake, users, archives]) {
    assert.match(source, /scrollIntoView\?\.\(\{ behavior: "smooth", block: "nearest", inline: "nearest" \}\)/);
  }
  assert.match(audit, /keepSelectedAuditViewVisible\(true\)/);
  assert.match(reports, /tabs\(\{ focusActive: true, smooth: true \}\)/);
  assert.match(reports, /activeButton\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(reports, /activeButton\?\.scrollIntoView\?\.\(/);
});
