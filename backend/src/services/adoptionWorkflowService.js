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
};
