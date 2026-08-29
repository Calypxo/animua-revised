import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adoptionAppsSource = await readFile(
  new URL("../src/management/adoptionApps.js", import.meta.url),
  "utf8",
);

test("adoption applications retain the submitted timestamp returned by the API", () => {
  assert.match(adoptionAppsSource, /submitted:\s*a\.submittedAt\s*\|\|\s*""/);
});

test("submitted dates support both Firestore timestamp response shapes", () => {
  assert.match(
    adoptionAppsSource,
    /d\?\._seconds\s*\?\?\s*d\?\.seconds/,
  );
  assert.match(
    adoptionAppsSource,
    /new Date\(Number\(timestampSeconds\) \* 1000\)/,
  );
});
