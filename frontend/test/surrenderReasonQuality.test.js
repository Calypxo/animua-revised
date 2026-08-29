import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, source] = await Promise.all([
  readFile(new URL("../pages/public/surrender.html", import.meta.url), "utf8"),
  readFile(new URL("../src/public/js/surrenderForm.js", import.meta.url), "utf8"),
]);

test("the public surrender form requires a meaningful reason length", () => {
  assert.match(html, /id="reasons"[^>]*minlength="15"/);
  assert.match(source, /meaningful explanation using at least 15 characters/);
});
