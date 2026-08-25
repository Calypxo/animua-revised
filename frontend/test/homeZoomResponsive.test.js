import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const homeStylesUrl = new URL("../src/css/public/home.css", import.meta.url);
const homePageUrl = new URL("../pages/public/home.html", import.meta.url);

test("desktop adoption process can grow when browser zoom changes text wrapping", async () => {
  const css = await readFile(homeStylesUrl, "utf8");

  assert.match(
    css,
    /Browser zoom changes the CSS viewport width[\s\S]*?\.how-animua-works-section\s*\{[\s\S]*?height:\s*auto\s*!important;[\s\S]*?min-height:\s*var\(--home-feature-section-height\)\s*!important;[\s\S]*?max-height:\s*none\s*!important;[\s\S]*?overflow:\s*visible\s*!important;/,
  );
  assert.match(
    css,
    /\.how-animua-works-section\s*>\s*\.how-animua-works-layout\s*\{\s*max-height:\s*none\s*!important;/,
  );
});

test("desktop adoption process uses stable type sizing and fixed-header offset", async () => {
  const css = await readFile(homeStylesUrl, "utf8");

  assert.match(css, /\.how-animua-works-section\s*\{[\s\S]*?scroll-margin-top:\s*76px;/);
  assert.match(css, /\.how-animua-works-head p\s*\{\s*font-size:\s*0\.8rem;/);
  assert.match(css, /\.how-animua-step h3\s*\{\s*font-size:\s*0\.875rem;/);
  assert.match(css, /\.how-animua-step p\s*\{\s*font-size:\s*0\.72rem;/);
});

test("success-story photos cover the complete story canvas", async () => {
  const [css, home] = await Promise.all([
    readFile(homeStylesUrl, "utf8"),
    readFile(homePageUrl, "utf8"),
  ]);

  assert.match(
    css,
    /\.story-modal-card\[data-story-key="success-stories"\] \.story-modal-image img\s*\{[\s\S]*?object-fit:\s*cover\s*!important;[\s\S]*?background:\s*transparent\s*!important;/,
  );
  assert.doesNotMatch(
    css,
    /\.story-modal-card\[data-story-key="success-stories"\] \.story-modal-image img\s*\{[\s\S]*?object-fit:\s*contain\s*!important;/,
  );
  assert.match(home, /home\.css\?v=story-photo-cover-20260825/);
});
