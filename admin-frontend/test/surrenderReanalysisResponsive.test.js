import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const behavior = await readFile(
  new URL("../src/management/surrenderRequests.js", import.meta.url),
  "utf8",
);
const styles = await readFile(
  new URL("../src/css/surrenderRequests.css", import.meta.url),
  "utf8",
);

test("surrender reanalysis remains available after rendering a result", () => {
  assert.match(behavior, /Re-run Tagalog RoBERTa/);
  assert.match(behavior, /reanalyzeSurrenderBtn/);
});

test("surrender reanalysis action fills the mobile triage card", () => {
  assert.match(
    styles,
    /\.triage-analysis-source\s*\{[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?width:\s*100%;/,
  );
  assert.match(
    styles,
    /\.triage-reanalyze-btn\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-height:\s*44px;/,
  );
});
