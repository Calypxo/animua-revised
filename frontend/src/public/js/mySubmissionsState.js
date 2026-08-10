export function mergeSubmissionResults(adoptionItems = [], surrenderItems = []) {
  return [...adoptionItems, ...surrenderItems];
}

export function submissionLoadErrorMessage(error) {
  const detail = String(error?.message || "").trim();
  return detail
    ? `Unable to load your submissions. ${detail}`
    : "Unable to load your submissions. Please try again.";
}
