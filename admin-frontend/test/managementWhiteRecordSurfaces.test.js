import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const panelStyles = await readSource("src/css/recordsPanelReference.css");
const tabStyles = await readSource("src/css/managementTabs.css");
const animalPage = await readSource("pages/animalProfiling.html");
const compatibilityPage = await readSource("pages/compatibilityQuiz.html");

const entries = Object.fromEntries(await Promise.all([
  "adoptionApps.js",
  "surrenderRequests.js",
  "contactMessages.js",
  "auditTrail.js",
  "archivedRecords.js",
].map(async (name) => [name, await readSource(`src/management/${name}`)])));

test("the Inventory White contract covers every requested management record page", () => {
  const contract = panelStyles.slice(panelStyles.indexOf("/* Inventory White workspace contract"));
  for (const pageClass of [
    "intake-management-page",
    "ap-list-page",
    "surrender-requests-page",
    "adoption-applications-page",
    "reports-page",
    "audit-trail-page",
    "archived-records-page",
    "inventory-page",
  ]) {
    assert.match(contract, new RegExp(`\\.${pageClass}`));
  }
  for (const surface of [
    "panel-head",
    "command-card-heading",
    "mrf-workspace",
    "management-review-filters",
    "reference-table-section-head",
    "management-review-table-wrap",
    "report-table-footer",
  ]) {
    assert.match(contract, new RegExp(`\\.${surface}`));
  }
  assert.match(contract, /background:\s*#ffffff !important;/);
  assert.match(contract, /background-image:\s*none !important;/);
});

test("outer tab rows never scroll and the rounded tablists scroll directly", () => {
  assert.match(
    tabStyles,
    /Wrappers provide White spacing only[\s\S]*?\.management-record-tabs-scroll,[\s\S]*?overflow:\s*visible !important;/,
  );
  assert.match(
    tabStyles,
    /\.management-record-tabs-scroll > :is\(\.archive-tabs, \.audit-view-switch\),[\s\S]*?overflow-x:\s*auto !important;[\s\S]*?border-radius:/,
  );
  assert.match(
    panelStyles,
    /\.page-body \.management-review-tabs-scroll\s*\{\s*overflow:\s*visible !important;[\s\S]*?\.page-body \.management-review-tabs\s*\{[\s\S]*?max-width:\s*100% !important;[\s\S]*?overflow-x:\s*auto !important;/,
  );
  assert.match(
    panelStyles,
    /The actual bordered list is the sole horizontal scroll owner[\s\S]*?background:\s*#efe5d2 !important;/,
  );
  assert.doesNotMatch(animalPage, /ap-tabs-wrap[^>]*tabindex=/);
  assert.doesNotMatch(compatibilityPage, /cq-workspace-nav[^>]*tabindex=/);
});

test("entry styles and extracted queue CSS cannot restore Cream record surfaces", () => {
  for (const [name, source] of Object.entries(entries)) {
    const referenceImport = source.indexOf('import "../css/recordsPanelReference.css";');
    assert.ok(referenceImport >= 0, `${name} is missing the shared record surface import`);

    for (const localStyle of [
      "adoptionApps.css",
      "reviewQueueRecords.css",
      "surrenderRequests.css",
      "contactMessages.css",
      "auditTrail.css",
      "archivedRecords.css",
      "recordsWorkspace.css",
    ]) {
      const localImport = source.indexOf(`import "../css/${localStyle}";`);
      if (localImport >= 0) {
        assert.ok(referenceImport > localImport, `${name} loads ${localStyle} after the shared White contract`);
      }
    }
  }

  assert.match(
    panelStyles,
    /Vite may extract the queue stylesheet after this shared file[\s\S]*?\.management-review-panel :is\([\s\S]*?background:\s*#ffffff !important;/,
  );
  assert.match(
    panelStyles,
    /\.management-review-panel \.management-review-table:not\(\.management-card-active\) thead th\s*\{[\s\S]*?background:\s*#ffffff !important;/,
  );
});
