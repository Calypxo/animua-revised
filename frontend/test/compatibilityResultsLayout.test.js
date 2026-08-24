import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const resultsScript = readFileSync(
  new URL("../src/public/js/compatibility-results-account.js", import.meta.url),
  "utf8",
);
const resultsStyles = readFileSync(
  new URL("../src/css/public/compatibilityResults.css", import.meta.url),
  "utf8",
);

test("results render recommendations without the compatibility traits section", () => {
  assert.match(
    resultsScript,
    /compatibility-result-grid[\s\S]*?compatibility-recommendations-section[\s\S]*?Top recommended animals/,
  );
  assert.doesNotMatch(resultsScript, /compatibility-traits-section|<h3>Compatibility traits<\/h3>/);
  assert.match(
    resultsStyles,
    /\.compatibility-result-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/,
  );
});

test("recommended animals use resolved photos and emphasize rank one", () => {
  assert.match(resultsScript, /resolveCompatibilityAnimalPhoto[\s\S]*?\/public\/pets\/\$\{encodeURIComponent\(animalId\)\}/);
  assert.match(resultsScript, /class="compatibility-pet-photo"[\s\S]*?data-match-photo/);
  assert.match(resultsScript, /compatibility-top-chip[\s\S]*?Top match/);
  assert.match(
    resultsStyles,
    /\.is-top-match \.compatibility-rank\s*\{[\s\S]*?width:\s*48px;[\s\S]*?font-size:\s*1\.1rem/,
  );
  assert.match(
    resultsStyles,
    /\.is-top-match \.compatibility-pet-photo\s*\{[\s\S]*?width:\s*120px;[\s\S]*?object-fit|\.compatibility-pet-photo\s*\{[\s\S]*?object-fit:\s*cover/,
  );
});

test("compatibility percentages remain prominent and responsive", () => {
  assert.match(
    resultsStyles,
    /\.compatibility-score\s*\{[\s\S]*?min-width:\s*86px;[\s\S]*?min-height:\s*40px;[\s\S]*?border-radius:\s*999px/,
  );
  assert.match(
    resultsStyles,
    /@media \(max-width: 620px\)[\s\S]*?\.compatibility-score\s*\{[\s\S]*?grid-column:\s*1 \/ 3/,
  );
});

test("ranked result cards use balanced actions and descriptive hierarchy", () => {
  assert.match(resultsScript, /Your closest matches based on the preferences from your latest quiz/);
  assert.match(resultsScript, /compatibility-score" aria-label="\$\{score\.toFixed\(1\)\} percent compatibility">\$\{score\.toFixed\(1\)\}%<\/span>/);
  assert.doesNotMatch(resultsScript, /compatibility-score"><small>Match/);
  assert.match(resultsScript, /<span>View details<\/span>/);
  assert.match(resultsStyles, /\.compatibility-recommendations-section\s*\{[\s\S]*?width:\s*min\(100%, 1260px\)/);
  assert.match(resultsStyles, /\.compatibility-view-pet\s*\{[\s\S]*?min-width:\s*126px;[\s\S]*?height:\s*40px;[\s\S]*?border-radius:\s*999px;[\s\S]*?white-space:\s*nowrap/);
});

test("secondary recommendations stay compact and use a useful subtitle", () => {
  assert.match(resultsScript, /const subtitle = index === 0[\s\S]*?: "Recommended match";/);
  assert.match(
    resultsStyles,
    /\.compatibility-matches li\s*\{[\s\S]*?grid-template-columns:\s*32px 72px[\s\S]*?min-height:\s*88px;[\s\S]*?padding:\s*10px 16px/,
  );
  assert.match(resultsStyles, /\.is-top-match \.compatibility-view-pet\s*\{[\s\S]*?background:\s*var\(--burgundy\)/);
});

test("mobile explanation cards keep their padding and avoid the chat control", () => {
  assert.match(
    resultsStyles,
    /@media \(max-width: 620px\)[\s\S]*?body\.home-page\.compatibility-results-page \.compatibility-info-card\s*\{[\s\S]*?grid-template-columns:\s*42px minmax\(0, 1fr\)[\s\S]*?padding:\s*18px !important/,
  );
  assert.match(
    resultsStyles,
    /body\.home-page\.compatibility-results-page \.compatibility-how-card\s*\{[\s\S]*?padding:\s*20px 18px 24px !important/,
  );
  assert.match(
    resultsStyles,
    /@media \(max-width: 420px\)[\s\S]*?\.compatibility-how-grid article > div\s*\{[\s\S]*?padding-right:\s*52px !important/,
  );
});
