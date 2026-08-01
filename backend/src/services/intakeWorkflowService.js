const ADVANCEABLE_INTAKE_STATUSES = new Set(["Pending", "Approved"]);

function canAdvanceIntakeToProfiling(status) {
  return ADVANCEABLE_INTAKE_STATUSES.has(status);
}

function shouldAutoAdvanceIntake({ source, status }) {
  return source === "Approved Surrender" && status === "Pending";
}

module.exports = {
  canAdvanceIntakeToProfiling,
  shouldAutoAdvanceIntake,
};
