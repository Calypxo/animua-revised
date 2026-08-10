import test from "node:test";
import assert from "node:assert/strict";

import {
  compareSurrenderUrgency,
} from "../src/management/surrenderRequestSorting.js";

test("surrender requests sort Critical, High, Medium, then Low", () => {
  const requests = ["Low", "Critical", "Medium", "High"].map((urgencyLabel) => ({
    nlp: { urgencyLabel },
    submittedAt: "2026-08-11T00:00:00.000Z",
  }));

  requests.sort(compareSurrenderUrgency);

  assert.deepEqual(
    requests.map((request) => request.nlp.urgencyLabel),
    ["Critical", "High", "Medium", "Low"]
  );
});

test("requests with equal urgency sort newest first", () => {
  const requests = [
    { id: "older", nlp: { urgencyLabel: "Critical" }, submittedAt: "2026-08-10T00:00:00.000Z" },
    { id: "newer", nlp: { urgencyLabel: "Critical" }, submittedAt: "2026-08-11T00:00:00.000Z" },
  ];

  requests.sort(compareSurrenderUrgency);
  assert.deepEqual(requests.map((request) => request.id), ["newer", "older"]);
});
