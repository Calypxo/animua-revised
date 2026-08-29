import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readPage = (name) => readFile(new URL(`../pages/${name}`, import.meta.url), "utf8");
const readStyle = (name) => readFile(new URL(`../src/css/${name}`, import.meta.url), "utf8");

const [compatibilityPage, inventoryPage, compatibilityStyles, inventoryStyles, responsiveStyles, tabStyles] = await Promise.all([
  readPage("compatibilityQuiz.html"),
  readPage("inventory.html"),
  readStyle("compatibilityQuiz.css"),
  readStyle("inventory.css"),
  readStyle("managementResponsive.css"),
  readStyle("managementTabs.css"),
]);

test("Compatibility Quiz uses the shared record header and scrollable workspace navigation", () => {
  assert.match(compatibilityPage, /cq-workspace-nav management-record-tabs-scroll/);
  assert.doesNotMatch(compatibilityPage, /cq-workspace-nav management-record-tabs-scroll[^>]*tabindex=/);
  assert.match(compatibilityPage, /cq-record-head reference-records-heading-row/);
  assert.match(compatibilityPage, /cq-card-head reference-records-heading/);
  assert.match(compatibilityPage, /reference-records-kicker">Saved recommendations/);
  assert.match(compatibilityPage, /cq-legend reference-records-tip/);
});

test("Compatibility result filters and section heading stay integrated with the record card", () => {
  assert.match(
    compatibilityStyles,
    /cq-records > :is\(\.cq-toolbar, \.mrf-workspace\)\s*\{[\s\S]*?margin:\s*0;[\s\S]*?border-bottom:\s*1px solid #f0e6dd;[\s\S]*?border-radius:\s*0;/,
  );
  assert.match(
    compatibilityStyles,
    /cq-records > \.reference-table-section-head\s*\{[\s\S]*?margin:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*#fff !important;/,
  );
});

test("Inventory preserves its reference header and one continuous phone panel", () => {
  const inventoryPhone = inventoryStyles.slice(inventoryStyles.lastIndexOf("@media (max-width: 700px)"));
  const panelRule = inventoryPhone.match(/\.inv-table-panel\s*\{([^}]*)\}/)?.[1] || "";

  assert.match(inventoryPage, /inventory-records-heading reference-records-heading-row/);
  assert.match(inventoryPage, /inventory-records-kicker reference-records-kicker/);
  assert.match(
    responsiveStyles,
    /@media \(max-width: 599px\)[\s\S]*?inventory-page \.inv-table-panel\s*\{[\s\S]*?overflow:\s*hidden !important;[\s\S]*?border:\s*1px solid #eadfd4 !important;/,
  );
  assert.match(
    responsiveStyles,
    /inv-table-panel > \.inventory-records-heading\s*\{[\s\S]*?display:\s*flex !important;/,
  );
  assert.match(responsiveStyles, /inventory-page \.inventory-filter-summary\s*\{\s*display:\s*none !important;/);
  assert.match(panelRule, /overflow:\s*hidden !important/);
  assert.match(panelRule, /border:\s*1px solid #eadfd4 !important/);
  assert.doesNotMatch(panelRule, /border:\s*0 !important/);
});

test("phone search and Filters actions share one aligned row", () => {
  const sharedFilters = responsiveStyles.indexOf("/* Shared responsive filter workspace");
  const phoneStart = responsiveStyles.indexOf("@media (max-width: 599px)", sharedFilters);
  const phoneEnd = responsiveStyles.indexOf("@media (min-width: 430px) and (max-width: 599px)", phoneStart);
  const phoneFilters = responsiveStyles.slice(
    phoneStart,
    phoneEnd,
  );
  assert.match(phoneFilters, /\.mrf-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;[\s\S]*?align-items:\s*end;/);
  assert.match(phoneFilters, /\.mrf-search-slot\s*\{[\s\S]*?grid-column:\s*1;/);
  assert.match(phoneFilters, /\.mrf-actions\s*\{[\s\S]*?align-self:\s*end;[\s\S]*?grid-column:\s*2;/);
  assert.match(phoneFilters, /\.mrf-chips\s*\{[\s\S]*?grid-column:\s*1 \/ -1;/);
});

test("compact Inventory spacing stays aligned without squeezing its search field", () => {
  const compactGuard = responsiveStyles.slice(
    responsiveStyles.lastIndexOf("/* Compact-phone collision guard."),
  );

  assert.match(
    compactGuard,
    /inventory-page \.inv-table-panel > \.inventory-records-heading\s*\{[\s\S]*?padding:\s*16px 14px 13px !important;/,
  );
  assert.match(
    compactGuard,
    /inventory-page \.mrf-workspace-inventory\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto !important;[\s\S]*?padding:\s*13px 14px !important;/,
  );
  assert.match(
    compactGuard,
    /inventory-page \.mrf-workspace-inventory \.mrf-trigger\s*\{[\s\S]*?min-width:\s*92px !important;[\s\S]*?min-height:\s*42px !important;/,
  );
});

test("the final compact-phone guard prevents overlap in every shared record card", () => {
  const compactGuard = responsiveStyles.slice(
    responsiveStyles.lastIndexOf("/* Compact-phone collision guard."),
  );

  assert.match(compactGuard, /@media \(max-width: 380px\)/);
  assert.match(
    compactGuard,
    /management-data-table\.management-card-table\.management-card-active[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important;[\s\S]*?grid-template-areas:\s*none !important;/,
  );
  assert.match(
    compactGuard,
    /tbody > tr\.management-card-row > td\s*\{[\s\S]*?grid-column:\s*1 !important;[\s\S]*?grid-area:\s*auto !important;/,
  );
  assert.match(
    compactGuard,
    /surrender-requests-page[\s\S]*?overflow-wrap:\s*anywhere !important;/,
  );
});

test("shared tabs use the same horizontal scroll mechanics as Reports", () => {
  assert.match(tabStyles, /The bordered tablist is the one and[\s\S]*?only horizontal scroll owner/);
  assert.match(tabStyles, /\.cq-workspace-nav[\s\S]*?overflow:\s*visible !important;/);
  assert.match(tabStyles, /\.cq-workspace-nav > \.archive-tabs[\s\S]*?overflow-x:\s*auto !important;[\s\S]*?scroll-snap-type:\s*x proximity;[\s\S]*?scrollbar-width:\s*none !important;/);
  assert.match(tabStyles, /\.report-tabs\s*\{[\s\S]*?overflow-x:\s*auto !important;[\s\S]*?scroll-snap-type:\s*x proximity;[\s\S]*?touch-action:\s*pan-x pan-y;/);
  assert.match(tabStyles, /\.report-tab\s*\{[\s\S]*?scroll-snap-align:\s*start;/);
});
