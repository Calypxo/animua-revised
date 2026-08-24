import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesUrl = new URL("../src/css/public/petCompatibility.css", import.meta.url);

test("saved-result score stays centered inside a complete ring on tablet", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(
    styles,
    /Center the recommendation score ring[\s\S]*?\.saved-match-body > strong \{[\s\S]*?min-height:\s*88px\s*!important;[\s\S]*?display:\s*inline-flex\s*!important;[\s\S]*?align-items:\s*center\s*!important;[\s\S]*?justify-content:\s*center\s*!important;/,
  );
  assert.match(
    styles,
    /\.saved-match-body > strong::after \{[\s\S]*?conic-gradient\([\s\S]*?#d9b85a[\s\S]*?rgba\(217, 184, 90, 0\.2\) 0[\s\S]*?\)/,
  );
});
