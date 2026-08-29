export function mergeSubmissionResults(adoptionItems = [], surrenderItems = []) {
  return [...adoptionItems, ...surrenderItems];
}

export function submissionLoadErrorMessage(error) {
  const detail = String(error?.message || "").trim();
  return detail
    ? `Unable to load your submissions. ${detail}`
    : "Unable to load your submissions. Please try again.";
}

export function publicRejectionReason(details = {}, type = "adoption") {
  const savedReason = String(details?.rejectedReason || "").trim();
  if (savedReason) return savedReason;

  if (type === "surrender") {
    return String(details?.reviewNotes || "").trim();
  }

  return "";
}
