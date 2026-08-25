import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesUrl = new URL("../src/css/public/petCompatibility.css", import.meta.url);
const pageUrl = new URL("../pages/public/petCompatibility.html", import.meta.url);

test("quiz scale choices remain reachable on tablets and narrow screens", async () => {
  const [styles, page] = await Promise.all([
    readFile(stylesUrl, "utf8"),
    readFile(pageUrl, "utf8"),
  ]);

  assert.match(styles, /Responsive answer-scale recovery/);
  assert.match(styles, /@media\s*\(max-width:\s*1399px\)/);
  assert.match(
    styles,
    /\.question-area \.option-group\s*\{[\s\S]*?display:\s*flex\s*!important;[\s\S]*?overflow-x:\s*auto\s*!important;[\s\S]*?scroll-snap-type:\s*inline proximity\s*!important;[\s\S]*?touch-action:\s*pan-x pan-y\s*!important;/,
  );
  assert.match(
    styles,
    /\.question-area \.option-btn\s*\{[\s\S]*?flex:\s*0 0 clamp\(112px,\s*14vw,\s*142px\)\s*!important;[\s\S]*?scroll-snap-align:\s*start\s*!important;/,
  );
  assert.match(
    styles,
    /@media\s*\(max-width:\s*760px\)[\s\S]*?\.question-area \.option-btn\s*\{[\s\S]*?flex-basis:\s*clamp\(96px,\s*30vw,\s*122px\)\s*!important;/,
  );
  assert.match(page, /petCompatibility\.css\?v=quiz-choice-scroll-20260825/);
});
