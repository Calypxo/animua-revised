import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readPage = (name) => readFile(new URL(`../pages/${name}`, import.meta.url), "utf8");
const readStyle = (name) => readFile(new URL(`../src/css/${name}`, import.meta.url), "utf8");

const pages = Object.fromEntries(await Promise.all([
  "intakeList.html",
  "adoptionApplications.html",
  "surrenders.html",
  "animalProfiling.html",
  "userManagement.html",
  "contactMessages.html",
  "archivedRecords.html",
  "auditTrail.html",
].map(async (name) => [name, await readPage(name)])));

const reviewStyles = await readStyle("reviewQueueRecords.css");
const tableStyles = await readStyle("managementTables.css");
const tabStyles = await readStyle("managementTabs.css");
const panelStyles = await readStyle("recordsPanelReference.css");

function assertOrder(source, labels) {
  let previous = -1;
  labels.forEach(([label, token]) => {
    const current = source.indexOf(token);
    assert.ok(current >= 0, `${label} is missing`);
    assert.ok(current > previous, `${label} is out of order`);
    previous = current;
  });
}

test("record workspaces follow header, tabs, filters, section title, and records order", () => {
  const standardPages = [
    ["intakeList.html", "records-heading", "intake-tabs", "filter-toolbar"],
    ["adoptionApplications.html", "aa-panel-intro", "management-review-tabs-scroll", "management-review-filters"],
    ["surrenders.html", "records-heading", "management-review-tabs-scroll", "management-review-filters"],
    ["animalProfiling.html", "ap-records-heading", "ap-tabs-wrap", "ap-filter-toolbar"],
    ["userManagement.html", "um-directory-heading", "um-tabs-wrap", "um-filter-bar"],
    ["contactMessages.html", "ap-records-heading", "ap-tabs-wrap", "cm-filter-toolbar"],
  ];

  standardPages.forEach(([name, header, tabs, filters]) => assertOrder(pages[name], [
    [`${name} record header`, header],
    [`${name} tabs`, tabs],
    [`${name} filters`, filters],
    [`${name} section heading`, "reference-table-section-head"],
  ]));
});

test("Audit and Archive keep the same tab row and table section heading", () => {
  for (const name of ["archivedRecords.html", "auditTrail.html"]) {
    assertOrder(pages[name], [
      [`${name} record header`, "records-heading"],
      [`${name} scrollable tabs`, "management-record-tabs-scroll"],
      [`${name} filters`, "filter-grid"],
      [`${name} section heading`, "reference-table-section-head"],
      [`${name} data table`, "management-data-table"],
    ]);
  }
});

test("review queues remain one continuous White panel when rows switch to cards", () => {
  const responsivePanel = reviewStyles.slice(
    reviewStyles.indexOf("Rows become cards at narrower widths"),
    reviewStyles.indexOf("@media (max-width: 900px)"),
  );
  assert.match(responsivePanel, /\.management-review-panel[\s\S]*?overflow:\s*hidden !important;/);
  assert.match(responsivePanel, /\.management-review-panel[\s\S]*?border:\s*1px solid #eadfd4 !important;/);
  assert.match(responsivePanel, /\.management-review-section-head[\s\S]*?background:\s*#ffffff !important;/);
  assert.match(
    panelStyles,
    /Inventory White workspace contract[\s\S]*?\.management-review-table-wrap,[\s\S]*?background:\s*#ffffff !important;/,
  );
  const panelRule = responsivePanel.match(/\.management-review-panel\s*\{([^}]*)\}/)?.[1] || "";
  assert.doesNotMatch(panelRule, /border:\s*0 !important;/);
});

test("all canonical table headers use the plain Inventory surface", () => {
  assert.match(tableStyles, /--mt-head:\s*var\(--mt-white\);/);
  assert.match(tableStyles, /thead th\s*\{[\s\S]*?background:\s*var\(--mt-head\) !important;/);
  assert.match(tableStyles, /background-image:\s*none !important;/);
  assert.match(
    panelStyles,
    /Table headings and responsive card wells stay White[\s\S]*?thead th\s*\{[\s\S]*?background:\s*#ffffff !important;[\s\S]*?background-image:\s*none !important;/,
  );
});

test("tab rows stay horizontally scrollable at narrow widths", () => {
  assert.match(tabStyles, /\.management-record-tabs-scroll[\s\S]*?overflow:\s*visible !important;/);
  assert.match(tabStyles, /\.management-record-tabs-scroll > :is\(\.archive-tabs, \.audit-view-switch\)/);
  assert.match(tabStyles, /max-width:\s*100% !important;[\s\S]*?overflow-x:\s*auto !important;/);
  assert.match(tabStyles, /\.management-record-tabs-scroll[\s\S]*?> :is\(\.archive-tab, \.audit-view-btn\)[\s\S]*?min-width:\s*max-content !important;/);
  assert.match(reviewStyles, /@media \(max-width: 599px\)[\s\S]*?\.management-review-tabs-scroll[\s\S]*?padding:\s*14px 14px 16px !important;/);
});

test("review filters and cards collapse cleanly for tablet and phone widths", () => {
  assert.match(reviewStyles, /@media \(max-width: 900px\)[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important;/);
  assert.match(reviewStyles, /@media \(max-width: 599px\)[\s\S]*?\.management-review-filters[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important;/);
  assert.match(reviewStyles, /@media \(max-width: 380px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important;/);
});
