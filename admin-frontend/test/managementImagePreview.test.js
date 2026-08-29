import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL("../src/components/management/managementImagePreview.js", import.meta.url);
const consistencyUrl = new URL("../src/components/management/managementConsistency.js", import.meta.url);
const cssUrl = new URL("../src/css/managementImagePreview.css", import.meta.url);

test("management review images use one shared accessible enlargement viewer", async () => {
  const [component, consistency] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(consistencyUrl, "utf8"),
  ]);

  assert.match(consistency, /initializeManagementImagePreview\(\)/);
  assert.match(consistency, /enhanceManagementImagePreviews\(root\)/);
  assert.match(component, /\.page-body img/);
  assert.match(component, /\.drawer-body img/);
  assert.match(component, /dataset\.originalSrc/);
  assert.match(component, /\["Enter", " "\]/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /aria-modal/);
});

test("the enlarged photo remains contained on desktop, tablet, and phone screens", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(css, /width:\s*min\(1120px, calc\(100vw - 48px\)\)/);
  assert.match(css, /max-height:\s*calc\(100dvh - 48px\)/);
  assert.match(css, /object-fit:\s*contain/);
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
  assert.match(css, /max-height:\s*calc\(100dvh - 158px\)/);
  assert.match(css, /@media\s*\(max-width:\s*380px\)/);
});
