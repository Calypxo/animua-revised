import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const furbabiesStyles = readFileSync(
  new URL("../src/css/public/furbabies.css", import.meta.url),
  "utf8",
);

test("mobile pet cards give long names two lines without covering metadata", () => {
  assert.match(
    furbabiesStyles,
    /Mobile pet names:[\s\S]*?@media \(max-width: 640px\)[\s\S]*?\.pet-card-top\s*\{[\s\S]*?height:\s*auto\s*!important;[\s\S]*?overflow:\s*visible\s*!important;/,
  );
  assert.match(
    furbabiesStyles,
    /Mobile pet names:[\s\S]*?\.pet-card-top h3\s*\{[\s\S]*?height:\s*auto\s*!important;[\s\S]*?max-height:\s*2\.3em\s*!important;[\s\S]*?-webkit-line-clamp:\s*2\s*!important;/,
  );
  assert.match(
    furbabiesStyles,
    /Mobile pet names:[\s\S]*?\.pet-card-top \.pet-meta\s*\{[\s\S]*?height:\s*auto\s*!important;[\s\S]*?overflow:\s*visible\s*!important;/,
  );
});

test("laptop pet cards reserve two title lines without changing the phone breakpoint", () => {
  assert.match(
    furbabiesStyles,
    /Laptop pet names:[\s\S]*?@media \(min-width: 901px\)[\s\S]*?\.pet-card\s*\{[\s\S]*?height:\s*420px\s*!important;[\s\S]*?\.pet-card-body\s*\{[\s\S]*?height:\s*226px\s*!important;/,
  );
  assert.match(
    furbabiesStyles,
    /Laptop pet names:[\s\S]*?\.pet-card-top\s*\{[\s\S]*?height:\s*auto\s*!important;[\s\S]*?flex:\s*0 0 auto\s*!important;[\s\S]*?\.pet-card-top h3\s*\{[\s\S]*?height:\s*auto\s*!important;[\s\S]*?max-height:\s*2\.2em\s*!important;[\s\S]*?-webkit-line-clamp:\s*2\s*!important;/,
  );
  assert.match(
    furbabiesStyles,
    /Laptop pet names:[\s\S]*?\.pet-actions\s*\{[\s\S]*?margin-top:\s*auto\s*!important;/,
  );
  assert.match(furbabiesStyles, /Mobile pet names:[\s\S]*?@media \(max-width: 640px\)/);
});
