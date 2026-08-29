const MIN_SURRENDER_REASON_LENGTH = 15;
const MIN_SURRENDER_REASON_LETTERS = 8;

function isDetailedSurrenderReason(value) {
  const reason = String(value || "").trim().replace(/\s+/g, " ");
  const letterCount = (reason.match(/\p{L}/gu) || []).length;
  return (
    reason.length >= MIN_SURRENDER_REASON_LENGTH &&
    letterCount >= MIN_SURRENDER_REASON_LETTERS
  );
}

module.exports = {
  MIN_SURRENDER_REASON_LENGTH,
  MIN_SURRENDER_REASON_LETTERS,
  isDetailedSurrenderReason,
};
