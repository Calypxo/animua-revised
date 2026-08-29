export function mergeSubmissionResults(adoptionItems = [], surrenderItems = []) {
  return [...adoptionItems, ...surrenderItems];
}

export function submissionLoadErrorMessage(error) {
  const detail = String(error?.message || "").trim();
  return detail
    ? `Unable to load your submissions. ${detail}`
    : "Unable to load your submissions. Please try again.";
}

export function applicationCompatibilityPresentation(details = {}) {
  const rawPercent = details?.compatibility?.matchPercent;
  const hasPercent = rawPercent !== null &&
    rawPercent !== undefined &&
    String(rawPercent).trim() !== "";
  const percent = Number(rawPercent);

  if (hasPercent && Number.isFinite(percent)) {
    return {
      label: `${percent}% Match`,
      iconClass: "fa-solid fa-check",
      stateClass: "is-assessed",
    };
  }

  return {
    label: "Not assessed",
    accessibleLabel: "Not assessed because the compatibility quiz was not taken",
    iconClass: "fa-solid fa-minus",
    stateClass: "is-unassessed",
  };
}

export function submissionDisplayStatus(item = {}, fallbackStatus = "") {
  const type = String(item.type || "").trim().toLowerCase();
  const details = item.details || {};
  const normalizedFallback = String(fallbackStatus || "").trim().toLowerCase();
  const isTerminal = ["converted", "finalized", "expired", "rejected", "withdrawn"]
    .some((status) => normalizedFallback.includes(status));

  if (!details.arrivalConfirmedAt || isTerminal) return fallbackStatus;
  if (type === "adoption") return "Pickup Confirmed";
  if (type === "surrender") return "Drop-off Confirmed";
  return fallbackStatus;
}
