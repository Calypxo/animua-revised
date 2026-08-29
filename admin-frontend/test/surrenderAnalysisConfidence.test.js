import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/management/surrenderRequests.js", import.meta.url),
  "utf8",
);

test("surrender triage displays category confidence and rule adjustments honestly", () => {
  assert.match(source, /categoryConfidence \?\? request\.nlp\?\.confidence/);
  assert.match(source, /Rule-adjusted — verify with the message/);
  assert.match(source, /did not contain enough meaningful text for RoBERTa classification/);
});
