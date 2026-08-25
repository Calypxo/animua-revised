import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const markupUrl = new URL("../pages/public/surrender.html", import.meta.url);
const scriptUrl = new URL("../src/public/js/surrenderForm.js", import.meta.url);

test("animal photos accept the same 5 MB source limit as ID uploads", async () => {
  const [markup, script] = await Promise.all([
    readFile(markupUrl, "utf8"),
    readFile(scriptUrl, "utf8"),
  ]);

  assert.match(markup, /Animal photo[\s\S]*?up to 5 MB\. Large photos are optimized automatically\./);
  assert.match(markup, /surrenderForm\.js\?v=animal-photo-5mb-20260825/);
  assert.match(script, /const MAX_IMAGE_UPLOAD_SIZE = 5 \* 1024 \* 1024;/);
  assert.match(script, /Animal photo must be 5 MB or smaller\./);
});

test("animal photos are optimized before being stored in the surrender payload", async () => {
  const script = await readFile(scriptUrl, "utf8");

  assert.match(script, /const MAX_PROCESSED_IMAGE_SIZE = 400 \* 1024;/);
  assert.match(script, /const fileData = await optimizeImageUpload\(file, \{\s*fallbackName: "animal-photo",\s*label: "animal photo",\s*\}\);/);
  assert.match(script, /animalPhotoData = fileData;/);
});
