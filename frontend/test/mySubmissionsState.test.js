import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeSubmissionResults,
  submissionLoadErrorMessage,
} from "../src/public/js/mySubmissionsState.js";

test("a real empty submissions response remains empty", () => {
  assert.deepEqual(mergeSubmissionResults([], []), []);
});

test("real adoption and surrender results are combined without fallback records", () => {
  const adoption = { id: "APP-2026-001" };
  const surrender = { id: "SR-2026-001" };
  assert.deepEqual(
    mergeSubmissionResults([adoption], [surrender]),
    [adoption, surrender]
  );
});

test("API failures produce a visible load error message", () => {
  assert.match(
    submissionLoadErrorMessage(new Error("Request failed: 503")),
    /unable to load.*503/i
  );
});
