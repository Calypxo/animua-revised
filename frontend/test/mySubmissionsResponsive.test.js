import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssUrl = new URL("../src/css/public/my-submissions.css", import.meta.url);

test("the submissions sort divider stays inside its rounded control", async () => {
  const css = await readFile(cssUrl, "utf8");
  const sortButtonRule = css.match(/\.submission-sort-btn\s*\{([^}]*)\}/)?.[1] ?? "";
  const sortDividerRule = css.match(/\.submission-sort-btn::before\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(sortButtonRule, /height:\s*29px\s*;/);
  assert.doesNotMatch(sortButtonRule, /height:\s*100%\s*;/);
  assert.doesNotMatch(sortButtonRule, /border-left:/);
  assert.match(sortDividerRule, /top:\s*50%\s*;/);
  assert.match(sortDividerRule, /height:\s*20px\s*;/);
  assert.match(sortDividerRule, /transform:\s*translateY\(-50%\)\s*;/);
});

test("the logged-in submissions navbar has protected tablet columns", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(css, /@media\s*\(max-width:\s*960px\)/);
  assert.match(css, /@media\s*\(min-width:\s*961px\)\s*and\s*\(max-width:\s*1180px\)/);
  assert.match(css, /grid-template-columns:\s*max-content\s+minmax\(0,\s*1fr\)\s+max-content\s*!important/);
  assert.match(css, /#loggedUserName,[\s\S]*?max-width:\s*clamp\(64px,\s*8vw,\s*94px\)\s*!important/);
});

test("mobile follow-up actions are centered and do not stretch across the card", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(css, /Keep the mobile follow-up actions compact instead of stretching edge-to-edge/);
  assert.match(css, /\.submission-next-card\s*\{[\s\S]*?padding:\s*22px\s+clamp\(14px,\s*5vw,\s*22px\)\s*!important/);
  assert.match(css, /\.submission-next-actions\s*\{[\s\S]*?width:\s*min\(100%,\s*300px\)\s*!important;[\s\S]*?justify-self:\s*center\s*!important/);
  assert.match(css, /\.submission-primary-link,[\s\S]*?\.submission-secondary-link\s*\{[\s\S]*?max-width:\s*300px\s*!important;[\s\S]*?min-height:\s*44px\s*!important/);
});

test("the mobile schedule picker stays compact and keeps both actions visible", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(css, /\.schedule-picker-popup\s*\{[\s\S]*?max-height:\s*min\(80dvh,\s*720px\)\s*!important;[\s\S]*?flex-direction:\s*column\s*!important;[\s\S]*?overflow:\s*hidden\s*!important/);
  assert.match(css, /\.schedule-picker-popup \.swal2-html-container\s*\{[\s\S]*?min-height:\s*0\s*!important;[\s\S]*?overflow-y:\s*auto\s*!important/);
  assert.match(css, /\.schedule-picker-popup \.swal2-actions\s*\{[\s\S]*?flex-direction:\s*row\s*!important;[\s\S]*?margin:\s*0\s*!important/);
});
