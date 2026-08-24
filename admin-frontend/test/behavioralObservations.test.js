import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeBehavioralObservations,
  parseBehavioralNotes,
  serializeBehavioralNotes,
} from "../src/management/behavioralObservations.js";

test("behavior observations serialize into the existing human-readable notes field", () => {
  const stored = serializeBehavioralNotes([
    { label: "Friendly with handlers", detail: "Approaches calmly for touch." },
    { label: "Vocal", detail: "" },
  ], "Reassess after the next kennel rotation.");

  assert.match(stored, /Observed behaviors:/);
  assert.match(stored, /- Friendly with handlers — Approaches calmly for touch\./);
  assert.match(stored, /Assessment notes:/);
});

test("behavior observations round-trip without changing legacy notes", () => {
  const legacy = parseBehavioralNotes("Existing free-form assessment note.");
  assert.deepEqual(legacy, { observations: [], notes: "Existing free-form assessment note." });

  const stored = serializeBehavioralNotes([{ label: "Timid", detail: "Needs a slow approach" }], "Quiet kennel preferred");
  assert.deepEqual(parseBehavioralNotes(stored), {
    observations: [{ label: "Timid", detail: "Needs a slow approach" }],
    notes: "Quiet kennel preferred",
  });
});

test("blank observation rows are removed and multiline values are normalized", () => {
  assert.deepEqual(normalizeBehavioralObservations([
    { label: "  Resource\n guarding ", detail: " Around   food " },
    { label: "", detail: "" },
  ]), [{ label: "Resource guarding", detail: "Around food" }]);
});
