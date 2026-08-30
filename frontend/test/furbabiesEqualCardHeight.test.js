import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(
  new URL("../src/css/public/furbabies.css", import.meta.url),
  "utf8",
);
const markup = readFileSync(
  new URL("../pages/public/find-furbabies.html", import.meta.url),
  "utf8",
);

test("newly ready pets keep the same card height as the rest of the public grid", () => {
  assert.match(
    styles,
    /Ready pets can use a full identifying description[\s\S]*?\.pets-grid\s*\{[\s\S]*?grid-auto-rows:\s*420px\s*!important/,
  );
  assert.match(
    styles,
    /\.pets-grid > \.pet-card\s*\{[\s\S]*?height:\s*420px\s*!important;[\s\S]*?max-height:\s*420px\s*!important;[\s\S]*?overflow:\s*hidden\s*!important/,
  );
  assert.match(
    styles,
    /\.pets-grid > \.pet-card \.pet-card-top h3\s*\{[\s\S]*?-webkit-line-clamp:\s*2\s*!important/,
  );
});

test("phone cards also use one equal row height without changing the image band", () => {
  assert.match(
    styles,
    /@media \(max-width: 640px\)[\s\S]*?\.pets-grid\s*\{[\s\S]*?grid-auto-rows:\s*432px\s*!important;[\s\S]*?\.pets-grid > \.pet-card\s*\{[\s\S]*?height:\s*432px\s*!important/,
  );
});

test("tablet pet grids use three columns without centering an odd final card", () => {
  assert.match(
    styles,
    /@media \(max-width: 1180px\) and \(min-width: 901px\)\s*\{[\s\S]*?\.pets-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)\s*!important;[\s\S]*?\.pet-card:last-child:nth-child\(odd\)\s*\{[\s\S]*?grid-column:\s*auto\s*!important;[\s\S]*?width:\s*auto\s*!important;[\s\S]*?justify-self:\s*stretch\s*!important/,
  );
});

test("the public page requests the current furbabies stylesheet revision", () => {
  assert.match(markup, /furbabies\.css\?v=profile-close-circle-tablet-three-columns-20260830/);
});
