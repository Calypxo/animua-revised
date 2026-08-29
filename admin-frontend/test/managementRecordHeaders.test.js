import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const consistencyStyles = await readFile(
  new URL("../src/css/managementConsistency.css", import.meta.url),
  "utf8",
);
const panelStyles = await readFile(
  new URL("../src/css/recordsPanelReference.css", import.meta.url),
  "utf8",
);
const contactStyles = await readFile(
  new URL("../src/css/contactMessages.css", import.meta.url),
  "utf8",
);
const workspaceStyles = await readFile(
  new URL("../src/css/recordsWorkspace.css", import.meta.url),
  "utf8",
);
const intakeStyles = await readFile(
  new URL("../src/css/intake.css", import.meta.url),
  "utf8",
);
const tabStyles = await readFile(
  new URL("../src/css/managementTabs.css", import.meta.url),
  "utf8",
);

test("management record headers use the plain Inventory reference surface", () => {
  assert.match(
    consistencyStyles,
    /\.report-data-card > \.rpt-card-head[\s\S]*?border-bottom:\s*1px solid #EEE3D9 !important;[\s\S]*?background:\s*#FFFFFF !important;[\s\S]*?background-image:\s*none !important;/,
  );
  assert.doesNotMatch(
    panelStyles,
    /(?:ap-records-heading|ap-tabs-wrap|aa-panel-intro|surrender-records-toolbar)[^{]*\{[^}]*linear-gradient/i,
  );
  assert.match(workspaceStyles, /\.records-toolbar\{[^}]*background:#FFFFFF;[^}]*background-image:none/);
});

test("Contact Messages keeps its heading copy visible on the white record header", () => {
  assert.match(
    consistencyStyles,
    /contact-messages-page \.cm-records-panel > \.ap-records-heading h2\s*\{\s*color:\s*#2D2322 !important;/,
  );
  assert.match(
    consistencyStyles,
    /contact-messages-page \.cm-records-panel > \.ap-records-heading p\s*\{\s*color:\s*#81746D !important;/,
  );
  assert.match(contactStyles, /\.ap-records-heading h2,[\s\S]*?color:\s*#2D2322;/);
});

test("Contact Messages keeps compact sender emails and statuses on one line", () => {
  assert.match(
    contactStyles,
    /\.cm-message-sender > span:first-child\s*\{[\s\S]*?text-overflow:\s*ellipsis !important;[\s\S]*?white-space:\s*nowrap !important;[\s\S]*?overflow-wrap:\s*normal !important;/,
  );
  assert.match(
    contactStyles,
    /\.cm-message-sender > \.cm-message-status\s*\{[\s\S]*?flex:\s*0 0 auto !important;[\s\S]*?white-space:\s*nowrap !important;[\s\S]*?word-break:\s*keep-all !important;/,
  );
});

test("Animal Intake no longer renders a Status label beside its tabs", () => {
  assert.doesNotMatch(intakeStyles, /\.toolbar-tabs::before\s*\{[\s\S]*?content:\s*["']Status["']/i);
});

test("management tab strips keep top spacing while the rounded tablist owns scrolling", () => {
  assert.match(panelStyles, /\.ap-tabs-wrap[\s\S]*?padding:\s*16px 24px 18px !important;/);
  assert.match(
    tabStyles,
    /Wrappers provide White spacing only[\s\S]*?\.cq-workspace-nav[\s\S]*?overflow:\s*visible !important;/,
  );
  assert.match(
    tabStyles,
    /\.ap-tabs-wrap > \.ap-tabs,[\s\S]*?\.cq-workspace-nav > \.archive-tabs[\s\S]*?max-width:\s*100% !important;[\s\S]*?overflow-x:\s*auto !important;/,
  );
  assert.match(tabStyles, /background:\s*#efe5d2 !important;/);
  assert.match(tabStyles, /scrollbar-width:\s*none !important;/);
});
