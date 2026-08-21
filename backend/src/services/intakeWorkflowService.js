const ADVANCEABLE_INTAKE_STATUSES = new Set(["Pending", "Approved"]);

function canAdvanceIntakeToProfiling(status) {
  return ADVANCEABLE_INTAKE_STATUSES.has(status);
}

function shouldAutoAdvanceIntake({ source, status }) {
  return false;
}

module.exports = {
  canAdvanceIntakeToProfiling,
  shouldAutoAdvanceIntake,
};
