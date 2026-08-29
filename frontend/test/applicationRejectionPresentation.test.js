import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scriptUrl = new URL("../src/public/js/my-submissions.js", import.meta.url);
const cssUrl = new URL("../src/css/public/my-submissions.css", import.meta.url);

test("rejected application details use a dedicated red presentation", async () => {
  const [script, css] = await Promise.all([
    readFile(scriptUrl, "utf8"),
    readFile(cssUrl, "utf8"),
  ]);

  assert.match(script, /application-timeline[^`]*is-rejected/);
  assert.match(script, /rejection-detail-note/);
  assert.match(css, /\.application-modal-status\.submission-status\.rejected\s*\{[\s\S]*?color:\s*#b42318/);
  assert.doesNotMatch(css, /\.application-timeline\.is-rejected \.application-step:last-child > span\s*\{/);
  assert.doesNotMatch(css, /\.application-timeline\.is-rejected \.application-step:last-child strong\s*\{/);
  assert.doesNotMatch(css, /\.application-timeline\.is-rejected::before\s*\{/);
  assert.match(css, /\.rejection-detail-copy\s*\{[\s\S]*?grid-template-columns:\s*max-content minmax\(0, 1fr\)/);
});
