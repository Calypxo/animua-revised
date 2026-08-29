import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const quizStyles = readFileSync(
  new URL("../src/css/public/petCompatibility.css", import.meta.url),
  "utf8",
);
const quizScript = readFileSync(
  new URL("../src/public/js/petCompatibility.js", import.meta.url),
  "utf8",
);

test("mobile quiz phase banner gives its copy a usable text column", () => {
  assert.match(
    quizStyles,
    /Phone phase banner:[\s\S]*?@media \(max-width: 760px\)[\s\S]*?\.phase-intro\s*\{[\s\S]*?display:\s*block\s*!important;[\s\S]*?padding:\s*18px clamp\(112px, 36vw, 142px\) 18px 18px\s*!important;/,
  );
  assert.match(
    quizStyles,
    /Phone phase banner:[\s\S]*?\.phase-intro > div:last-child\s*\{[\s\S]*?width:\s*100%\s*!important;[\s\S]*?min-width:\s*0\s*!important;/,
  );
  assert.match(
    quizStyles,
    /Phone phase banner:[\s\S]*?\.phase-intro-title,[\s\S]*?\.phase-intro-desc\s*\{[\s\S]*?word-break:\s*normal\s*!important;/,
  );
});

test("phone quiz header keeps one description and number-only phase markers", () => {
  assert.match(
    quizStyles,
    /Phone quiz chrome:[\s\S]*?@media \(max-width: 640px\)[\s\S]*?\.quiz-header\s*\{[\s\S]*?gap:\s*10px\s*!important;/,
  );
  assert.match(
    quizStyles,
    /Phone quiz chrome:[\s\S]*?\.header-brand::after\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?content:\s*none\s*!important;/,
  );
  assert.match(
    quizStyles,
    /Phone quiz chrome:[\s\S]*?\.quiz-header-intro\s*\{[\s\S]*?margin:\s*0\s*!important;/,
  );
  assert.match(
    quizStyles,
    /Phone quiz chrome:[\s\S]*?\.phase-step-dot i\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?\.phase-step-dot::before\s*\{[\s\S]*?display:\s*block\s*!important;/,
  );
});

test("phone quiz navigation keeps both actions inside the card", () => {
  assert.match(
    quizStyles,
    /Phone quiz navigation:[\s\S]*?@media \(max-width: 640px\)[\s\S]*?\.quiz-nav\s*\{[\s\S]*?width:\s*calc\(100% - clamp\(20px, 7vw, 32px\)\)\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)\s*!important;[\s\S]*?justify-self:\s*center\s*!important;[\s\S]*?margin:\s*12px auto 0\s*!important;/,
  );
  assert.match(
    quizStyles,
    /Phone quiz navigation:[\s\S]*?\.quiz-nav::before\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?content:\s*none\s*!important;/,
  );
  assert.match(
    quizStyles,
    /Phone quiz navigation:[\s\S]*?\.quiz-nav \.btn-prev,[\s\S]*?\.quiz-nav \.btn-submit\s*\{[\s\S]*?order:\s*initial\s*!important;[\s\S]*?max-width:\s*100%\s*!important;[\s\S]*?min-width:\s*0\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/,
  );
});

test("phone navigation accommodates the longer Tagalog action labels", () => {
  assert.match(quizScript, /previous:\s*"Bumalik"/);
  assert.match(quizScript, /next:\s*"Susunod"/);
  assert.match(quizScript, /submit:\s*"Hanapin ang Matches"/);
  assert.match(
    quizStyles,
    /Phone quiz navigation:[\s\S]*?\.quiz-nav\s*\{[\s\S]*?max-width:\s*calc\(100% - clamp\(20px, 7vw, 32px\)\)\s*!important;[\s\S]*?left:\s*auto\s*!important;[\s\S]*?right:\s*auto\s*!important;[\s\S]*?transform:\s*none\s*!important;[\s\S]*?\.quiz-nav \.btn-submit\s*\{[\s\S]*?min-height:\s*44px\s*!important;[\s\S]*?height:\s*auto\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/,
  );
});

test("phone phase banner removes crowded artwork and reclaims the text width", () => {
  assert.match(
    quizStyles,
    /Phone phase artwork:[\s\S]*?@media \(max-width: 640px\)[\s\S]*?\.phase-intro\s*\{[\s\S]*?min-height:\s*0\s*!important;[\s\S]*?background:\s*linear-gradient\(135deg, #5f0112 0%, #780116 100%\)\s*!important;/,
  );
  assert.match(
    quizStyles,
    /Phone phase artwork:[\s\S]*?\.phase-intro::before,[\s\S]*?\.phase-intro::after\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?content:\s*none\s*!important;[\s\S]*?background:\s*none\s*!important;/,
  );
  assert.match(
    quizStyles,
    /Phone phase artwork:[\s\S]*?\.phase-intro > div:last-child,[\s\S]*?\.phase-intro-desc\s*\{[\s\S]*?width:\s*100%\s*!important;[\s\S]*?max-width:\s*100%\s*!important;/,
  );
});

test("only the requested 820px, 912px, and 1024px tablet widths get the shared override", () => {
  assert.match(
    quizStyles,
    /Explicitly requested iPad Air \(820px\), Surface \(912px\), and iPad Pro \(1024px\) layouts only\.[\s\S]*?@media \(width: 820px\), \(min-width: 900px\) and \(max-width: 930px\), \(width: 1024px\)[\s\S]*?\.quiz-shell\s*\{[\s\S]*?grid-template-columns:\s*clamp\(220px, 25vw, 250px\) minmax\(0, 1fr\)\s*!important;[\s\S]*?\.quiz-shell > \.quiz-sidebar\s*\{[\s\S]*?display:\s*block\s*!important;[\s\S]*?visibility:\s*visible\s*!important;[\s\S]*?opacity:\s*1\s*!important;/,
  );
  assert.match(
    quizStyles,
    /Explicitly requested iPad Air[\s\S]*?\.header-brand::after\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?content:\s*none\s*!important;[\s\S]*?\.header-meta\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 36px\s*!important;/,
  );
  assert.match(
    quizStyles,
    /Explicitly requested iPad Air[\s\S]*?\.exit-quiz-link span\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?\.progress-label\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto\s*!important;[\s\S]*?#progressPercentLabel\s*\{[\s\S]*?text-align:\s*right\s*!important;/,
  );
  assert.doesNotMatch(
    quizStyles,
    /Explicitly requested iPad Air[\s\S]*?@media \(min-width: 761px\) and \(max-width: 1099px\)/,
  );
});

test("the 1024px iPad uses the desktop visual treatment only at that exact width", () => {
  assert.match(
    quizStyles,
    /iPad Pro portrait only:[\s\S]*?@media \(width: 1024px\)[\s\S]*?\.quiz-shell\s*\{[\s\S]*?grid-template-columns:\s*300px minmax\(0, 1fr\)\s*!important;[\s\S]*?\.quiz-shell > \.quiz-sidebar\s*\{[\s\S]*?width:\s*300px\s*!important;/,
  );
  assert.match(
    quizStyles,
    /iPad Pro portrait only:[\s\S]*?\.header-meta\s*\{[\s\S]*?position:\s*fixed\s*!important;[\s\S]*?display:\s*flex\s*!important;[\s\S]*?\.exit-quiz-link span\s*\{[\s\S]*?display:\s*inline\s*!important;/,
  );
  assert.match(
    quizStyles,
    /Active quiz step: the filled number circle is the complete indicator\.[\s\S]*?\.phase-step\.active\s*\{[\s\S]*?background:\s*transparent\s*!important;[\s\S]*?box-shadow:\s*none\s*!important;[\s\S]*?\.phase-step\.active span\s*\{[\s\S]*?border-color:\s*transparent\s*!important;[\s\S]*?background:\s*transparent\s*!important;/,
  );
  assert.doesNotMatch(
    quizStyles,
    /iPad Pro portrait only:[\s\S]*?@media \(min-width:/,
  );
});

test("the 820px iPad Air restores the sidebar and keeps Next inside the card", () => {
  assert.match(
    quizStyles,
    /iPad Air portrait only:[\s\S]*?@media \(width: 820px\)[\s\S]*?\.quiz-shell\s*\{[\s\S]*?grid-template-columns:\s*220px minmax\(0, 1fr\)\s*!important;[\s\S]*?\.quiz-shell > \.quiz-sidebar\s*\{[\s\S]*?width:\s*220px\s*!important;/,
  );
  assert.match(
    quizStyles,
    /iPad Air portrait only:[\s\S]*?\.quiz-nav\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 76px minmax\(0, 1fr\)\s*!important;[\s\S]*?margin:\s*12px 16px 14px\s*!important;[\s\S]*?\.quiz-nav \.btn-submit\s*\{[\s\S]*?max-width:\s*100%\s*!important;[\s\S]*?min-width:\s*0\s*!important;/,
  );
  assert.doesNotMatch(
    quizStyles,
    /iPad Air portrait only:[\s\S]*?@media \(min-width:/,
  );
});
