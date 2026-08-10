function getSurrenderConversionError(record = {}) {
  if (String(record.status || "") !== "Approved") {
    return "Only approved surrender requests can be converted.";
  }

  if (!record.arrivalConfirmedAt) {
    return "Confirm that the owner and animal arrived at the shelter before converting this request to intake.";
  }

  return "";
}

function isDirectSurrenderStatusAllowed(status) {
  return ["Pending", "Approved", "Rejected"].includes(String(status || ""));
}

module.exports = {
  getSurrenderConversionError,
  isDirectSurrenderStatusAllowed,
};
