const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MIN_SURRENDER_REASON_LENGTH,
  isDetailedSurrenderReason,
} = require("../src/utils/surrenderReason");

test("rejects placeholder and non-letter surrender explanations", () => {
  assert.equal(isDetailedSurrenderReason("xsx"), false);
  assert.equal(isDetailedSurrenderReason("12345678901234567890"), false);
});

test("accepts a concise meaningful surrender explanation", () => {
  assert.equal(MIN_SURRENDER_REASON_LENGTH, 15);
  assert.equal(
    isDetailedSurrenderReason("May sakit ang aso."),
    true,
  );
});
