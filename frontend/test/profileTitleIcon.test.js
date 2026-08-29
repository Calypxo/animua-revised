import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sources = [
  "../pages/public/home.html",
  "../pages/public/my-submissions.html",
  "../pages/public/compatibilityResults.html",
  "../src/public/js/public-ui.js",
  "../src/public/js/lightweight-profile.js",
];

test("the My Profile title uses only the solid circle-user icon", async () => {
  const contents = await Promise.all(
    sources.map(source => readFile(new URL(source, import.meta.url), "utf8")),
  );

  contents.forEach(content => {
    assert.match(content, /profile-title-icon[\s\S]{0,120}fa-solid fa-circle-user/);
    assert.doesNotMatch(content, /profile-title-icon[\s\S]{0,120}fa-regular fa-(?:circle-)?user/);
  });
});
