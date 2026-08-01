const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canAdvanceIntakeToProfiling,
  shouldAutoAdvanceIntake,
} = require("../src/services/intakeWorkflowService");

test("pending and approved intakes can advance to profiling in one action", () => {
  assert.equal(canAdvanceIntakeToProfiling("Pending"), true);
  assert.equal(canAdvanceIntakeToProfiling("Approved"), true);
});

test("closed intake statuses cannot create another profile", () => {
  assert.equal(canAdvanceIntakeToProfiling("Converted"), false);
  assert.equal(canAdvanceIntakeToProfiling("Rejected"), false);
  assert.equal(canAdvanceIntakeToProfiling("Draft"), false);
});

test("an arrived approved-surrender intake skips the duplicate review stage", () => {
  assert.equal(
    shouldAutoAdvanceIntake({ source: "Approved Surrender", status: "Pending" }),
    true
  );
  assert.equal(
    shouldAutoAdvanceIntake({ source: "Rescue", status: "Pending" }),
    false
  );
});
