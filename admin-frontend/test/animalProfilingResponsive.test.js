import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(
  new URL("../pages/animalProfiling.html", import.meta.url),
  "utf8",
);
const panelStyles = await readFile(
  new URL("../src/css/recordsPanelReference.css", import.meta.url),
  "utf8",
);
const responsiveStyles = await readFile(
  new URL("../src/css/managementResponsive.css", import.meta.url),
  "utf8",
);
const behavior = await readFile(
  new URL("../src/management/animalProfiling.js", import.meta.url),
  "utf8",
);

test("animal lifecycle tabs stay inside a keyboard-accessible scroll surface", () => {
  assert.match(page, /class="ap-tabs-wrap" role="region" tabindex="0"/);
  assert.match(panelStyles, /\.ap-tabs-wrap[\s\S]*?width:\s*100%;[\s\S]*?overflow-x:\s*auto !important/);
  assert.match(panelStyles, /\.ap-list-page \.ap-tabs[\s\S]*?max-width:\s*none !important[\s\S]*?min-width:\s*max-content !important/);
  assert.match(behavior, /btn\.scrollIntoView\(\{ behavior: "smooth", block: "nearest", inline: "nearest" \}\)/);
});

test("animal search uses the shared shrink-safe mobile search rule", () => {
  assert.match(page, /class="ap-control"[\s\S]*?id="searchAnimals"/);
  assert.match(responsiveStyles, /\.mrf-search-slot :is\(\.search-pill-sm, \.ap-control[\s\S]*?box-sizing:\s*border-box !important/);
  assert.match(responsiveStyles, /> :is\(input\[type="search"\][\s\S]*?flex:\s*1 1 auto !important/);
});
