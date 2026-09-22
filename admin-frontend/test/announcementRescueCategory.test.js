import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pageUrl = new URL("../pages/announcements.html", import.meta.url);
const scriptUrl = new URL("../src/management/announcements.js", import.meta.url);

test("management announcements can create and filter Rescue posts", async () => {
  const [page, script] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(scriptUrl, "utf8"),
  ]);

  assert.match(page, /data-category-type="Rescue"/);
  assert.match(page, /id="categoryRescueCount"/);
  assert.equal((page.match(/<option value="News & Alerts">News &amp; Alerts<\/option>/g) || []).length, 2);
  assert.equal((page.match(/<option value="Rescue">Rescue<\/option>/g) || []).length, 2);
  assert.match(script, /if \(type\.includes\("rescue"\)\) return "Rescue";/);
  assert.match(script, /countType\("Rescue"\)/);
  assert.match(script, /selectedType === "News & Alerts" && isRescuePostContent\(title, caption\)/);
});
