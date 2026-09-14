import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicPages = [
  "announcements.html",
  "compatibilityResults.html",
  "contact.html",
  "find-furbabies.html",
  "home.html",
  "my-submissions.html",
  "petCompatibility.html",
  "quizLanding.html",
  "surrender.html",
  "verify-email-action.html",
  "verify-success.html",
];

const zoomStylesUrl = new URL(
  "../src/css/public/zoom-responsive.css",
  import.meta.url,
);

test("every public page loads the shared browser-zoom guardrails", async () => {
  const pages = await Promise.all(
    publicPages.map(async (page) => ({
      page,
      markup: await readFile(new URL(`../pages/public/${page}`, import.meta.url), "utf8"),
    })),
  );

  for (const { page, markup } of pages) {
    assert.match(
      markup,
      /src\/css\/public\/zoom-responsive\.css\?v=public-zoom-[\w-]+/,
      `${page} must load the shared zoom stylesheet`,
    );
  }
});

test("wide effective viewports gain fluid shells without cancelling browser zoom", async () => {
  const css = await readFile(zoomStylesUrl, "utf8");

  assert.match(css, /@media\s*\(min-width:\s*1600px\)/);
  assert.match(css, /--public-wide-shell:\s*clamp\(1280px,\s*60vw,\s*1600px\)/);
  assert.match(css, /--public-wide-grid-shell:\s*clamp\(1280px,\s*72vw,\s*1920px\)/);
  assert.match(css, /\.container:not\(\.nav-shell\)[\s\S]*?max-width:\s*var\(--public-wide-shell\)\s*!important/);
  assert.doesNotMatch(css, /(?:^|[;{\s])zoom\s*:/m);
  assert.doesNotMatch(css, /transform:\s*scale\(/);
});

test("find and surrender heroes remain centered at browser zoom-out", async () => {
  const [css, findPage, surrenderPage] = await Promise.all([
    readFile(zoomStylesUrl, "utf8"),
    readFile(new URL("../pages/public/find-furbabies.html", import.meta.url), "utf8"),
    readFile(new URL("../pages/public/surrender.html", import.meta.url), "utf8"),
  ]);

  assert.match(
    css,
    /body\.furbabies-page \.furbabies-hero > \.container,\s*html body\.home-page\.surrender-page \.surrender-page-hero > \.surrender-page-hero-grid\s*\{[\s\S]*?width:\s*min\(calc\(100% - 64px\),\s*var\(--public-wide-shell\)\)\s*!important;[\s\S]*?max-width:\s*var\(--public-wide-shell\)\s*!important;[\s\S]*?margin-inline:\s*auto\s*!important;[\s\S]*?padding-inline:\s*0\s*!important;/,
  );
  assert.doesNotMatch(css, /body\.furbabies-page \.finder-left\s*\{[\s\S]*?max-width:\s*900px\s*!important/);
  assert.doesNotMatch(css, /body\.furbabies-page \.pets-grid\s*\{[\s\S]*?repeat\(auto-fit/);
  assert.match(findPage, /zoom-responsive\.css\?v=public-zoom-20260915-1/);
  assert.match(surrenderPage, /zoom-responsive\.css\?v=public-zoom-20260915-1/);
});

test("the fullscreen homepage keeps its stories below the actions at strong zoom-out", async () => {
  const css = await readFile(zoomStylesUrl, "utf8");

  assert.match(
    css,
    />\s*\.hero\s*\{[\s\S]*?height:\s*clamp\(800px,\s*78vh,\s*940px\)\s*!important;[\s\S]*?max-height:\s*940px\s*!important;/,
  );
  assert.match(
    css,
    />\s*\.hero\s*>\s*\.hero-layout\s*\{[\s\S]*?height:\s*100%\s*!important;[\s\S]*?display:\s*flex\s*!important;[\s\S]*?padding-bottom:\s*clamp\(238px,\s*24vh,\s*276px\)\s*!important;/,
  );
  assert.match(
    css,
    />\s*\.hero \.hero-left\s*\{[\s\S]*?max-width:\s*800px\s*!important;[\s\S]*?margin-top:\s*0\s*!important;/,
  );
});

test("desktop public heroes grow with wrapped copy instead of clipping it", async () => {
  const css = await readFile(zoomStylesUrl, "utf8");

  assert.match(css, /@media\s*\(min-width:\s*761px\)[\s\S]*?\.furbabies-hero,[\s\S]*?\.community-cover,[\s\S]*?\.surrender-page-hero\s*\{[\s\S]*?height:\s*auto\s*!important;[\s\S]*?max-height:\s*none\s*!important;/);
  assert.match(css, /\.furbabies-hero\s*>\s*\.container,[\s\S]*?\.community-cover-inner,[\s\S]*?\.surrender-page-hero-grid\s*\{[\s\S]*?height:\s*auto\s*!important;/);
  assert.match(css, /html body\.home-page\.surrender-page \.surrender-page-hero\s*\{[\s\S]*?height:\s*auto\s*!important;[\s\S]*?min-height:\s*648px\s*!important;[\s\S]*?max-height:\s*none\s*!important;/);
  assert.match(css, /html body\.home-page\.surrender-page \.surrender-page-hero\s*>\s*\.surrender-page-hero-grid\s*\{[\s\S]*?height:\s*auto\s*!important;[\s\S]*?min-height:\s*648px\s*!important;/);
});
