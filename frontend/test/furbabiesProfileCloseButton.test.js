import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(
  new URL("../src/css/public/furbabies.css", import.meta.url),
  "utf8",
);

test("pet profile close control keeps a square painted border box", () => {
  assert.match(
    styles,
    /Pet profile close control:[\s\S]*?#petProfileModal \.profile-close-btn\s*\{[\s\S]*?width:\s*36px\s*!important;[\s\S]*?min-width:\s*36px\s*!important;[\s\S]*?max-width:\s*36px\s*!important;[\s\S]*?height:\s*36px\s*!important;[\s\S]*?min-height:\s*36px\s*!important;[\s\S]*?max-height:\s*36px\s*!important;[\s\S]*?aspect-ratio:\s*1\s*\/\s*1\s*!important;[\s\S]*?padding:\s*0\s*!important;[\s\S]*?border-radius:\s*50%\s*!important/,
  );
});
