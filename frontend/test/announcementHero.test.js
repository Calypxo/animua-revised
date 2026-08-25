import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const announcementsUrl = new URL("../pages/public/announcements.html", import.meta.url);
const homeUrl = new URL("../pages/public/home.html", import.meta.url);
const stylesUrl = new URL("../src/css/public/announcements.css", import.meta.url);
const publicUiUrl = new URL("../src/public/js/public-ui.js", import.meta.url);

test("highlight stories stay on the homepage and are absent from the announcements hero", async () => {
  const [announcements, home, styles] = await Promise.all([
    readFile(announcementsUrl, "utf8"),
    readFile(homeUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.doesNotMatch(announcements, /announcement-category-nav/);
  assert.doesNotMatch(announcements, /announcement-category-item/);
  assert.match(home, /<section class="home-highlights-section" id="home-highlights"/);
  assert.match(home, /class="home-highlight-story"/);
  assert.doesNotMatch(styles, /\.announcement-category-nav/);
  assert.match(styles, /Highlights belong to the homepage; keep this hero copy naturally centered/);
});

test("newest-furbabies stories use the same available pets returned to Find Furbabies", async () => {
  const [home, script] = await Promise.all([
    readFile(homeUrl, "utf8"),
    readFile(publicUiUrl, "utf8"),
  ]);

  assert.match(
    script,
    /const getPetDateValue[\s\S]*?pet\.readyForAdoptionAt\s*\|\|[\s\S]*?pet\.updatedAt\s*\|\|[\s\S]*?pet\.createdAt\s*\|\|[\s\S]*?pet\.intakeDate/,
  );
  assert.match(
    script,
    /const normalizePets[\s\S]*?\.filter\(\(pet\) => pet\?\.id\)[\s\S]*?\.sort\(\(a, b\) => getPetDateValue\(b\) - getPetDateValue\(a\)\)[\s\S]*?\.slice\(0, 3\)/,
  );
  assert.doesNotMatch(
    script,
    /const normalizePets[\s\S]*?isFreshStoryDate\(pet\.createdAt/,
  );
  assert.match(script, /date:\s*formatStoryDate\([\s\S]*?pet\.readyForAdoptionAt/);
  assert.match(home, /public-ui\.js\?v=newest-furbabies-date-20260825/);
});
