import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globalStyles = readFileSync(
  new URL("../src/css/global.css", import.meta.url),
  "utf8",
);

test("the chatbot language selector leaves space after the Assistant badge", () => {
  assert.match(
    globalStyles,
    /without crowding the Assistant badge[\s\S]*?\.chatbot-language-select\s*\{[\s\S]*?width:\s*94px\s*!important;[\s\S]*?min-width:\s*94px\s*!important;[\s\S]*?gap:\s*6px\s*!important;[\s\S]*?padding-inline:\s*8px\s*!important;/,
  );
  assert.match(
    globalStyles,
    /@media \(max-width: 430px\)\s*\{[\s\S]*?\.chatbot-language-select\s*\{[\s\S]*?width:\s*88px\s*!important;[\s\S]*?min-width:\s*88px\s*!important;[\s\S]*?gap:\s*5px\s*!important;/,
  );
});
