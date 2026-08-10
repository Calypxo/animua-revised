const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getAdoptionFinalizationError,
} = require("../src/services/adoptionWorkflowService");

test("only approved adoption applications can be finalized", () => {
  assert.match(
    getAdoptionFinalizationError({
      status: "Pending",
      arrivalConfirmedAt: "2026-08-11T02:00:00.000Z",
    }),
    /only approved/i
  );
});

test("adoption finalization requires a previously confirmed arrival", () => {
  assert.match(
    getAdoptionFinalizationError({ status: "Approved" }),
    /arrival must be confirmed/i
  );
});

test("an approved adoption can be finalized after arrival confirmation", () => {
  assert.equal(
    getAdoptionFinalizationError({
      status: "Approved",
      arrivalConfirmedAt: "2026-08-11T02:00:00.000Z",
    }),
    ""
  );
});
