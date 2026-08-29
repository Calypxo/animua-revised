import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the public root redirects without rendering the legacy access portal", async () => {
  const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(indexHtml, /window\.location\.replace\("\/pages\/public\/home\.html"\)/);
  assert.match(indexHtml, /http-equiv="refresh" content="0; url=\/pages\/public\/home\.html"/);
  assert.doesNotMatch(indexHtml, /ANIMUA - Access Portal|id="authModal"|public-ui\.js/);
});

test("Firebase redirects root requests before serving the legacy index route", async () => {
  const firebaseConfig = JSON.parse(
    await readFile(new URL("../../firebase.json", import.meta.url), "utf8")
  );
  const publicHosting = firebaseConfig.hosting.find((entry) => entry.target === "public");

  assert.deepEqual(publicHosting.redirects, [
    { source: "/", destination: "/pages/public/home.html", type: 302 },
    { source: "/index.html", destination: "/pages/public/home.html", type: 302 },
  ]);
});

test("the public cache rotates and protected redirects bypass index.html", async () => {
  const [serviceWorker, compatibilityResults] = await Promise.all([
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../src/public/js/compatibilityResults.js", import.meta.url), "utf8"),
  ]);

  assert.match(serviceWorker, /CACHE_VERSION = "animua-public-v30"/);
  assert.doesNotMatch(compatibilityResults, /window\.location\.href = "\/index\.html"/);
});
