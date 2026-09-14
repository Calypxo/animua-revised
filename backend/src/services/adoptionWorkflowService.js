function getAdoptionFinalizationError(adoption = {}) {
  if (adoption.status !== "Approved") {
    return "Only approved applications can be finalized.";
  }

  if (!String(adoption.arrivalConfirmedAt || "").trim()) {
    return "Shelter arrival must be confirmed before the adoption can be finalized.";
  }

  return "";
}

module.exports = {
  getAdoptionFinalizationError,
  ACTIVE_ADOPTION_STATUSES: ["Pending", "Under Review", "Approved"],
  ANIMAL_ADOPTED_CLOSURE_REASON: "This animal has been adopted by another applicant. Your application was closed because the animal is no longer available. This is not a rejection of your eligibility to adopt.",
};
