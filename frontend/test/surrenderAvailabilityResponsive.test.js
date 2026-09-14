import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const surrenderStylesUrl = new URL(
  "../src/css/public/surrender.css",
  import.meta.url,
);

test("closed surrender availability uses the full desktop workspace", async () => {
  const css = await readFile(surrenderStylesUrl, "utf8");

  assert.match(
    css,
    /body\.home-page\.surrender-page \.surrender-workspace\.is-not-accepting\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;[^}]*min-height:\s*0\s*!important;[^}]*\}/,
  );
  assert.match(
    css,
    /body\.home-page\.surrender-page \.surrender-workspace\.is-not-accepting \.surrender-form-wrap\s*\{[^}]*width:\s*100%\s*!important;[^}]*grid-column:\s*1\s*\/\s*-1\s*!important;[^}]*\}/,
  );
});
