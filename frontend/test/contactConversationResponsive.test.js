import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssUrl = new URL("../src/css/public/contact.css", import.meta.url);
const scriptUrl = new URL("../src/public/js/contact.js", import.meta.url);

test("phone contact conversations use a compact content-driven thread", async () => {
  const [css, script] = await Promise.all([
    readFile(cssUrl, "utf8"),
    readFile(scriptUrl, "utf8"),
  ]);

  assert.match(script, /matchMedia\("\(max-width: 1040px\)"\)/);
  assert.match(script, /style\.removeProperty\("--contact-thread-height"\)/);
  assert.match(script, /textarea name="message" rows="2"/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.contact-replies-panel\.is-thread-open\s*\{[\s\S]*?height:\s*auto;[\s\S]*?max-height:\s*none;[\s\S]*?overflow:\s*visible;/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.contact-thread-view\s*\{[\s\S]*?grid-template-rows:\s*auto auto auto auto;[\s\S]*?height:\s*auto;/);
});

test("phone reply composer keeps a round send button inside the field", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.doesNotMatch(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.contact-thread-send\s*\{\s*width:\s*100%;/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.contact-thread-send\s*\{[\s\S]*?width:\s*36px;[\s\S]*?height:\s*36px;[\s\S]*?border-radius:\s*50%;/);
  assert.match(css, /\.contact-thread-reply-field\s*\{[\s\S]*?min-height:\s*56px;[\s\S]*?padding:\s*9px 54px 9px 13px;/);
});
