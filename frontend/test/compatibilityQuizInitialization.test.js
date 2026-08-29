import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../pages/public/petCompatibility.html", import.meta.url);
const scriptUrl = new URL("../src/public/js/petCompatibility.js", import.meta.url);
const stylesUrl = new URL("../src/css/public/petCompatibility.css", import.meta.url);

test("the questionnaire stays hidden until quiz eligibility is resolved", async () => {
  const [page, script, styles] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(scriptUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(page, /<body class="quiz-initializing">/);
  assert.match(page, /class="quiz-initial-loader"[\s\S]*?class="quiz-initial-card"[\s\S]*?Checking your quiz status/);
  assert.doesNotMatch(page, /class="quiz-initial-brand"/);
  assert.match(
    styles,
    /Eligibility loading:[\s\S]*?body\.quiz-initializing \.quiz-shell\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?body\.quiz-initializing \.quiz-initial-loader\s*\{[\s\S]*?display:\s*grid;/,
  );
  assert.match(
    script,
    /function revealInitializedQuiz\(\)[\s\S]*?classList\.remove\("quiz-initializing"\)/,
  );
  assert.match(
    script,
    /if \(!info\.canTakeQuiz\)[\s\S]*?revealInitializedQuiz\(\);\s*return;/,
  );
  assert.match(
    styles,
    /Open loading layout:[\s\S]*?quiz-initial-card\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/,
  );
});
