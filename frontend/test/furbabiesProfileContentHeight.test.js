import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(
  new URL("../src/css/public/furbabies.css", import.meta.url),
  "utf8",
);
const script = readFileSync(
  new URL("../src/public/js/find-furbabies.js", import.meta.url),
  "utf8",
);

test("variable pet text stays within the original desktop profile dimensions", () => {
  assert.match(
    styles,
    /Keep variable backend text within the original desktop profile dimensions[\s\S]*?\.profile-title-wrap h2\s*\{[\s\S]*?-webkit-line-clamp:\s*2\s*!important/,
  );
  assert.match(
    styles,
    /#petProfileModal \.profile-meta-card\s*\{[\s\S]*?height:\s*60px\s*!important;[\s\S]*?overflow:\s*hidden\s*!important/,
  );
  assert.match(
    styles,
    /#petProfileModal \.profile-section-card\s*\{[\s\S]*?height:\s*145px\s*!important;[\s\S]*?overflow:\s*hidden\s*!important/,
  );
  assert.match(
    styles,
    /#petProfileModal \.profile-about-card\s*\{[\s\S]*?overflow:\s*hidden\s*!important/,
  );
  assert.match(
    styles,
    /#petProfileModal \.profile-short-description\s*\{[\s\S]*?max-height:\s*88px\s*!important;[\s\S]*?overflow-y:\s*auto\s*!important/,
  );
});

test("every desktop profile aligns the About and Personality bottom edges", () => {
  assert.match(
    script,
    /const minimumAboutHeight = 104;[\s\S]*?currentHeight \+ traitsRect\.bottom - aboutRect\.bottom/,
  );
  assert.doesNotMatch(script, /minimumAboutHeight = Math\.ceil\(aboutPanel\.scrollHeight\)/);
});

test("the fix does not assign a new outer profile-modal height", () => {
  const containmentRules = styles.slice(styles.indexOf("Keep variable backend text"));
  assert.doesNotMatch(containmentRules, /#petProfileModal \.redesigned-profile-modal\s*\{/);
});
