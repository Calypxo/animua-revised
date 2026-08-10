const URGENCY_RANK = Object.freeze({
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
});

export function compareSurrenderUrgency(left, right) {
  const leftRank = URGENCY_RANK[left?.nlp?.urgencyLabel] ?? 4;
  const rightRank = URGENCY_RANK[right?.nlp?.urgencyLabel] ?? 4;
  const urgencyDifference = leftRank - rightRank;

  if (urgencyDifference !== 0) {
    return urgencyDifference;
  }

  return new Date(right?.submittedAt || 0) - new Date(left?.submittedAt || 0);
}
