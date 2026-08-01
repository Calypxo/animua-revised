const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getSurrenderConversionError,
} = require("../src/services/surrenderWorkflowService");

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
