import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(
  new URL("../pages/surrenders.html", import.meta.url),
  "utf8",
);
const queueStyles = await readFile(
  new URL("../src/css/reviewQueueRecords.css", import.meta.url),
  "utf8",
);
const responsiveStyles = await readFile(
  new URL("../src/css/managementResponsive.css", import.meta.url),
  "utf8",
);
const behavior = await readFile(
  new URL("../src/management/surrenderRequests.js", import.meta.url),
  "utf8",
);

test("surrender status tabs use the bounded horizontal scroll surface", () => {
  assert.match(page, /management-review-tabs-scroll/);
  assert.match(page, /management-review-tabs-scroll[\s\S]*?management-review-tabs/);
  assert.match(queueStyles, /\.surrender-requests-page\) \.management-review-tabs-scroll/);
  assert.match(queueStyles, /overflow-x:\s*auto/);
  assert.match(behavior, /btn\.scrollIntoView\(\{ behavior: "smooth", block: "nearest", inline: "nearest" \}\)/);
});

test("responsive search pills include padding and let their input shrink", () => {
  assert.match(responsiveStyles, /\.mrf-search-slot :is\(\.search-pill-sm[\s\S]*?box-sizing:\s*border-box !important/);
  assert.match(responsiveStyles, /\.mrf-search-slot :is\(\.search-pill-sm[\s\S]*?> :is\(input\[type="search"\][\s\S]*?flex:\s*1 1 auto !important/);
});
