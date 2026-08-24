import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const scriptUrl = new URL("../src/public/js/surrenderForm.js", import.meta.url);
const stylesUrl = new URL("../src/css/public/surrender.css", import.meta.url);

test("selected ID photos use a readable preview state", async () => {
  const [script, styles] = await Promise.all([
    readFile(scriptUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(script, /preview\.classList\.toggle\("has-image", Boolean\(fileData\)\)/);
  assert.match(styles, /\.identity-document-preview\.has-image\s*\{[^}]*width:\s*min\(100%,\s*160px\)[^}]*height:\s*70px/);
  assert.match(styles, /\.identity-document-preview img\s*\{[^}]*object-fit:\s*contain/);
});

test("long ID filenames cannot overflow into the neighboring upload", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.identity-document-upload\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%[^}]*overflow:\s*hidden/);
  assert.match(styles, /\.identity-document-copy\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0[^}]*max-width:\s*100%[^}]*overflow:\s*hidden/);
  assert.match(styles, /\.identity-document-copy strong\s*\{[^}]*width:\s*100%[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/);
});
