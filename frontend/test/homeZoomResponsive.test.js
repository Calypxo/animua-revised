import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const homeStylesUrl = new URL("../src/css/public/home.css", import.meta.url);
const globalStylesUrl = new URL("../src/css/global.css", import.meta.url);
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

test("adoption process numbers stay centered above their icon circles", async () => {
  const [css, home] = await Promise.all([
    readFile(homeStylesUrl, "utf8"),
    readFile(homePageUrl, "utf8"),
  ]);

  assert.match(
    css,
    /body\.home-page \.how-animua-number\s*\{[\s\S]*?position:\s*static;[\s\S]*?display:\s*grid;[\s\S]*?place-items:\s*center;[\s\S]*?margin:\s*0 auto 14px;[\s\S]*?transform:\s*none;/,
  );
  assert.match(
    home,
    /home\.css\?v=story-photo-cover-20260825-process-number-alignment-20260826/,
  );
});

test("adoption process matches the compact-header breakpoint and keeps a solid desktop connector", async () => {
  const [css, homeCss, home] = await Promise.all([
    readFile(globalStylesUrl, "utf8"),
    readFile(homeStylesUrl, "utf8"),
    readFile(homePageUrl, "utf8"),
  ]);

  assert.match(
    css,
    /@media \(min-width:\s*961px\)\s*\{[\s\S]*?body\.home-page \.how-animua-process::before\s*\{[\s\S]*?background:\s*#d8b558 !important;[\s\S]*?background-image:\s*none !important;/,
  );
  assert.match(
    css,
    /@media \(min-width:\s*961px\) and \(max-width:\s*1040px\)[\s\S]*?body\.home-page \.how-animua-process\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\) !important;/,
  );
  assert.match(
    homeCss,
    /@media \(max-width:\s*1040px\)[\s\S]*?body\.home-page \.how-animua-process\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?body\.home-page \.how-animua-process::before\s*\{[\s\S]*?content:\s*none;/,
  );
  assert.match(
    home,
    /global\.css\?v=mobile-notification-icon-20260824-process-layout-20260827-2/,
  );
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
