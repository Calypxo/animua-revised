const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getSurrenderConversionError,
  isDirectSurrenderStatusAllowed,
} = require("../src/services/surrenderWorkflowService");

test("generic surrender status changes cannot mark a request Converted", () => {
  assert.equal(isDirectSurrenderStatusAllowed("Pending"), true);
  assert.equal(isDirectSurrenderStatusAllowed("Approved"), true);
  assert.equal(isDirectSurrenderStatusAllowed("Rejected"), true);
  assert.equal(isDirectSurrenderStatusAllowed("Converted"), false);
});

test("surrender conversion requires an approved request", () => {
  assert.match(
    getSurrenderConversionError({ status: "Pending" }),
    /only approved/i
  );
});

test("surrender conversion requires confirmed shelter arrival", () => {
  assert.match(
    getSurrenderConversionError({ status: "Approved" }),
    /confirm.*arrived/i
  );
});

test("an approved surrender can convert after arrival is confirmed", () => {
  assert.equal(
    getSurrenderConversionError({
      status: "Approved",
      arrivalConfirmedAt: "2026-08-10T02:00:00.000Z",
    }),
    ""
  );
});
