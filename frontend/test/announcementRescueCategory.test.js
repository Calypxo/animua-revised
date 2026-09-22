import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pageUrl = new URL("../pages/public/announcements.html", import.meta.url);
const scriptUrl = new URL("../src/public/js/announcements.js", import.meta.url);

test("public announcements expose Rescue as its own category", async () => {
  const [page, script] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(scriptUrl, "utf8"),
  ]);

  assert.match(page, /<option value="Rescue">Rescue<\/option>/);
  assert.match(page, /<option value="News & Alerts">News &amp; Alerts<\/option>/);
  assert.match(page, /data-topic-value="Rescue"/);
  assert.match(page, /data-public-type="Rescue"/);
  assert.match(script, /"Rescue": \{ icon: .* slug: "rescue", label: "Rescue" \}/);
  assert.match(script, /if \(type\.includes\("rescue"\)\) return "Rescue";/);
  assert.match(script, /return "News & Alerts";/);
});
