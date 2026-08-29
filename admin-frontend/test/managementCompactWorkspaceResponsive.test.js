import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readPage = (name) => readFile(new URL(`../pages/${name}`, import.meta.url), "utf8");
const readStyle = (name) => readFile(new URL(`../src/css/${name}`, import.meta.url), "utf8");

const [compatibilityPage, inventoryPage, intakePage, adoptionScript, intakeScript, surrenderScript, compatibilityStyles, inventoryStyles, intakeStyles, responsiveStyles, tabStyles, managementModalStyles] = await Promise.all([
  readPage("compatibilityQuiz.html"),
  readPage("inventory.html"),
  readPage("intakeList.html"),
  readFile(new URL("../src/management/adoptionApps.js", import.meta.url), "utf8"),
  readFile(new URL("../src/management/intake.js", import.meta.url), "utf8"),
  readFile(new URL("../src/management/surrenderRequests.js", import.meta.url), "utf8"),
  readStyle("compatibilityQuiz.css"),
  readStyle("inventory.css"),
  readStyle("intake.css"),
  readStyle("managementResponsive.css"),
  readStyle("managementTabs.css"),
  readStyle("managementModal.css"),
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

test("the final compact-phone guard keeps shared cells shrink-safe and removes Surrender collisions", () => {
  const compactGuard = responsiveStyles.slice(
    responsiveStyles.lastIndexOf("/* Compact-phone collision guard."),
  );

  assert.match(compactGuard, /@media \(max-width: 380px\)/);
  assert.match(
    compactGuard,
    /management-card-row > td\s*\{[\s\S]*?min-width:\s*0 !important;[\s\S]*?max-width:\s*100% !important;[\s\S]*?overflow-wrap:\s*anywhere !important;/,
  );
  assert.match(
    compactGuard,
    /surrender-requests-page[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important;[\s\S]*?grid-template-areas:\s*none !important;/,
  );
  assert.match(
    compactGuard,
    /surrender-requests-page[\s\S]*?overflow-wrap:\s*anywhere !important;/,
  );
});

test("Intake remains one continuous Inventory-style panel on phones", () => {
  const intakePhone = responsiveStyles.slice(
    responsiveStyles.lastIndexOf("/* Intake phone composition:"),
  );

  assert.match(intakePhone, /@media \(max-width: 599px\)/);
  assert.match(
    intakePhone,
    /intake-management-page \.page-body > \.records-panel\s*\{[\s\S]*?overflow:\s*hidden !important;[\s\S]*?border:\s*1px solid #eadfd4 !important;[\s\S]*?background:\s*#ffffff !important;/,
  );
  assert.match(
    intakePhone,
    /records-panel > \.intake-toolbar\s*\{[\s\S]*?padding:\s*0 !important;[\s\S]*?border-radius:\s*0 !important;[\s\S]*?box-shadow:\s*none !important;/,
  );
  assert.match(
    intakePhone,
    /mrf-workspace-intake\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto !important;[\s\S]*?padding:\s*13px 14px !important;/,
  );
  assert.match(
    intakePhone,
    /records-panel > \.reference-table-section-head\s*\{[\s\S]*?padding:\s*14px !important;[\s\S]*?background:\s*#ffffff !important;/,
  );
  assert.match(
    intakePhone,
    /management-card-table\.management-card-active tbody\s*\{[\s\S]*?padding:\s*10px !important;[\s\S]*?background:\s*#ffffff !important;/,
  );
});

test("Intake rows use only the centralized View action while the modal owns workflow actions", () => {
  const intakeRow = intakeScript.slice(
    intakeScript.indexOf('tbody.innerHTML = page.map'),
    intakeScript.indexOf('// Row click'),
  );
  const intakeActions = responsiveStyles.slice(
    responsiveStyles.lastIndexOf("/* Intake rows expose only the centralized View control."),
    responsiveStyles.lastIndexOf("/* Intake mobile modal contract:"),
  );
  const intakeSourceLayout = intakeStyles.slice(
    intakeStyles.lastIndexOf("/* Keep all three Intake Source choices in one equal, aligned row"),
  );
  const intakeFieldSpacing = intakeStyles.slice(
    intakeStyles.lastIndexOf("/* Keep essential Intake fields compact"),
    intakeStyles.lastIndexOf("/* Keep all three Intake Source choices in one equal, aligned row"),
  );
  const sharedSingleColumnFields = managementModalStyles.slice(
    managementModalStyles.indexOf("/* CRUD modal bodies use one predictable reading path."),
    managementModalStyles.indexOf("html body.management-consistent-ui .management-modal-layer", managementModalStyles.indexOf("/* CRUD modal bodies use one predictable reading path.") + 1),
  );

  assert.match(
    intakeRow,
    /management-card-actions[\s\S]*?tbl-action-btn management-card-open management-view-action management-view-action--compact[\s\S]*?management-action-text">View record/,
  );
  assert.doesNotMatch(intakeRow, /intake-secondary-actions/);
  assert.doesNotMatch(intakeRow, /data-action="(?:edit|reject|convert)"/);
  assert.match(intakeScript, /intake-view-footer-actions[\s\S]*?vBtnEdit[\s\S]*?vBtnReject[\s\S]*?vBtnConvert/);
  assert.match(intakeScript, /vBtnEdit[\s\S]*?openEditModal\(id\)/);
  assert.match(intakeScript, /vBtnReject[\s\S]*?openConfirmModal\("reject",\s+id\)/);
  assert.match(intakeScript, /vBtnConvert[\s\S]*?openConfirmModal\("convert", id\)/);
  assert.match(
    surrenderScript,
    /tbl-action-btn management-card-open management-view-action management-view-action--compact[\s\S]*?management-action-text">View request/,
  );
  assert.match(intakeActions, /#intakeTableBody > tr > td\.management-card-actions\s*\{[\s\S]*?text-align:\s*center !important;/);
  assert.match(intakeSourceLayout, /@media \(min-width: 601px\)/);
  assert.match(intakeSourceLayout, /#intakeModalBackdrop #sourceSelector\.source-selector\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\) !important;[\s\S]*?align-items:\s*stretch !important;[\s\S]*?gap:\s*12px !important;/);
  assert.match(intakeSourceLayout, /#sourceSelector\.source-selector > \.source-opt\s*\{[\s\S]*?min-height:\s*148px !important;[\s\S]*?height:\s*100% !important;[\s\S]*?grid-row:\s*1 !important;[\s\S]*?grid-template-rows:\s*auto auto 1fr !important;/);
  assert.match(intakeSourceLayout, /> \.source-opt:nth-child\(3\)\s*\{\s*grid-column:\s*3 !important;/);
  assert.match(intakeSourceLayout, /> \.source-opt > :is\([\s\S]*?\.source-opt-label,[\s\S]*?\.source-opt-desc[\s\S]*?display:\s*block !important;/);
  assert.doesNotMatch(sharedSingleColumnFields, /\.source-selector/);
  assert.match(intakeFieldSpacing, /#intakeModalBackdrop #intakeForm \.form-grid\s*\{[\s\S]*?row-gap:\s*10px !important;/);
  assert.match(intakeFieldSpacing, /#intakeModalBackdrop #intakeForm \.form-err:empty\s*\{[\s\S]*?display:\s*none !important;[\s\S]*?min-height:\s*0 !important;/);
});

test("Intake modals stay inside the mobile viewport with usable actions", () => {
  const intakeModals = responsiveStyles.slice(
    responsiveStyles.lastIndexOf("/* Intake mobile modal contract:"),
  );

  for (const modalId of ["intakeModalBackdrop", "viewModalBackdrop", "confirmModalBackdrop"]) {
    assert.match(intakePage, new RegExp(`id="${modalId}"`));
  }
  assert.match(intakeModals, /@media \(max-width: 599px\)/);
  assert.match(
    intakeModals,
    /#intakeModalBackdrop,[\s\S]*?#viewModalBackdrop[\s\S]*?\.management-modal-layer\s*\{[\s\S]*?align-items:\s*center !important;[\s\S]*?justify-content:\s*center !important;[\s\S]*?padding:\s*max\(8px, env\(safe-area-inset-top\)\) 8px max\(8px, env\(safe-area-inset-bottom\)\) !important;/,
  );
  assert.match(
    intakeModals,
    /\.intake-modal\.management-side-modal\s*\{[\s\S]*?width:\s*100% !important;[\s\S]*?max-width:\s*min\(800px, calc\(100dvw - 16px\)\) !important;[\s\S]*?height:\s*auto !important;[\s\S]*?max-height:\s*calc\(100dvh - 16px\) !important;[\s\S]*?border-radius:\s*16px !important;/,
  );
  assert.match(
    intakeModals,
    /\.intake-modal > \.um-modal-body\s*\{[\s\S]*?min-height:\s*0 !important;[\s\S]*?overflow-y:\s*auto !important;[\s\S]*?touch-action:\s*pan-y !important;/,
  );
  assert.match(
    intakeModals,
    /#viewModalBackdrop[\s\S]*?\.intake-view-footer-actions\s*\{[\s\S]*?width:\s*100% !important;[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important;/,
  );
  assert.match(
    intakeModals,
    /@media \(max-width: 420px\)[\s\S]*?#confirmModalBackdrop[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important;/,
  );
});

test("Intake record details inherits the centralized desktop side-modal contract", () => {
  const intakeDesktopOverrides = responsiveStyles.slice(
    responsiveStyles.lastIndexOf("/* Intake rows expose only the centralized View control."),
    responsiveStyles.lastIndexOf("/* Intake mobile modal contract:"),
  );
  const intakeDetailsMarkup = intakeScript.slice(
    intakeScript.indexOf("function openViewModal"),
    intakeScript.indexOf("CONFIRM MODAL (approve / reject / convert)"),
  );

  assert.match(intakePage, /id="viewModalBackdrop"[\s\S]*?class="um-modal intake-modal intake-view-modal"/);
  assert.match(intakeDetailsMarkup, /class="form-section intake-record-hero"/);
  assert.match(intakeDetailsMarkup, /class="form-section view-section"/);
  assert.match(intakeDetailsMarkup, /class="form-section-title view-section-title"/);
  assert.match(
    managementModalStyles,
    /\.management-modal-layer\s*\{[\s\S]*?align-items:\s*stretch !important;[\s\S]*?justify-content:\s*flex-end !important;/,
  );
  assert.match(
    managementModalStyles,
    /\.management-modal-layer > \.management-side-modal\s*\{[\s\S]*?height:\s*100dvh !important;[\s\S]*?border-radius:\s*var\(--management-modal-radius\) 0 0 var\(--management-modal-radius\) !important;[\s\S]*?transform:\s*translate3d\(104%, 0, 0\) !important;/,
  );
  assert.doesNotMatch(intakeDesktopOverrides, /#viewModalBackdrop\.management-modal-layer\s*\{/);
  assert.doesNotMatch(intakeDesktopOverrides, /\.intake-view-modal\.management-side-modal\s*\{/);
  assert.doesNotMatch(intakeStyles, /#viewModalBackdrop > \.intake-view-modal\s*\{/);
  assert.doesNotMatch(intakeStyles, /#viewModalBackdrop \.um-modal-(?:header|body)\s*\{/);
  assert.doesNotMatch(intakeStyles, /\.intake-view-modal\s*\{\s*max-width:/);
  assert.doesNotMatch(intakeStyles, /#viewModalBackdrop \.view-section(?:-title)?\s*\{/);
});

test("Surrender record cards clear the mobile section header divider", () => {
  const surrenderSpacing = responsiveStyles.slice(
    responsiveStyles.lastIndexOf("/* Keep the first review-queue record clear"),
  );

  assert.match(surrenderSpacing, /@media \(max-width: 760px\)/);
  assert.match(
    surrenderSpacing,
    /adoption-applications-page,[\s\S]*?surrender-requests-page[\s\S]*?management-review-table\.management-card-active tbody\s*\{[\s\S]*?padding:\s*10px 2px 2px !important;/,
  );
});

test("Adoption compact fields use unique grid areas instead of overlapping", () => {
  const adoptionCompact = responsiveStyles.slice(
    responsiveStyles.lastIndexOf("/* Adoption compact cards keep four unique rows."),
  );

  for (const field of ["applicant", "animal", "application", "type", "match", "status", "actions"]) {
    assert.match(adoptionScript, new RegExp(`management-review-${field}-field`));
    assert.match(adoptionCompact, new RegExp(`management-review-${field}-field \\{ grid-area: ${field} !important; \\}`));
  }

  assert.match(
    adoptionCompact,
    /@media \(max-width: 380px\)[\s\S]*?"application type"[\s\S]*?"match status"/,
  );
  assert.match(
    adoptionCompact,
    /tbody > tr\.management-card-row > td\s*\{[\s\S]*?grid-column:\s*auto !important;/,
  );
  assert.match(
    adoptionCompact,
    /@media \(max-width: 339px\)[\s\S]*?"application"[\s\S]*?"type"[\s\S]*?"match"[\s\S]*?"status"/,
  );
});

test("shared tabs use the same horizontal scroll mechanics as Reports", () => {
  assert.match(tabStyles, /The bordered tablist is the one and[\s\S]*?only horizontal scroll owner/);
  assert.match(tabStyles, /\.cq-workspace-nav[\s\S]*?overflow:\s*visible !important;/);
  assert.match(tabStyles, /\.cq-workspace-nav > \.archive-tabs[\s\S]*?overflow-x:\s*auto !important;[\s\S]*?scroll-snap-type:\s*x proximity;[\s\S]*?scrollbar-width:\s*none !important;/);
  assert.match(tabStyles, /\.report-tabs\s*\{[\s\S]*?overflow-x:\s*auto !important;[\s\S]*?scroll-snap-type:\s*x proximity;[\s\S]*?touch-action:\s*pan-x pan-y;/);
  assert.match(tabStyles, /\.report-tab\s*\{[\s\S]*?scroll-snap-align:\s*start;/);
});
