import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldShowAddMedical,
  buildQuarantineDecisionPayload,
} from "../src/management/animalProfileWorkflow.js";

test("medical care stays available after clearance for authorized users", () => {
  assert.equal(shouldShowAddMedical("Quarantine", true), true);
  assert.equal(shouldShowAddMedical("Ready", true), true);
  assert.equal(shouldShowAddMedical("Profiling", true), false);
  assert.equal(shouldShowAddMedical("Adopted", true), false);
  assert.equal(shouldShowAddMedical("Archived", true), false);
  assert.equal(shouldShowAddMedical("Quarantine", false), false);
  assert.equal(shouldShowAddMedical("Ready", false), false);
});

test("inline clearance creates a valid medical-contract payload without opening the medical form", () => {
  const payload = buildQuarantineDecisionPayload(null, "Cleared", "2026-08-10");
  assert.equal(payload.type, "Quarantine Clearance");
  assert.equal(payload.clearance, "Cleared");
  assert.equal(payload.inventoryItemId, "");
  assert.equal(payload.quantityUsed, 0);
  assert.throws(() => buildQuarantineDecisionPayload(null, "Unknown", "2026-08-10"));
});
