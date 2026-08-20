const {
  isFunctionalityTestingEnvironment,
} = require("./requestDeadlineService");

const DEADLINE_RECONCILIATION_INTERVAL_MS = 15 * 60 * 1000;

function startAutomaticDeadlineReconciliation({
  env = process.env,
  reconcileRequestDeadlines,
  setIntervalFn = setInterval,
  logger = console,
} = {}) {
  if (typeof reconcileRequestDeadlines !== "function") {
    throw new TypeError("reconcileRequestDeadlines must be a function.");
  }

  if (isFunctionalityTestingEnvironment(env)) {
    logger.log("[functionality-testing] Automatic deadline reconciliation disabled.");
    return { enabled: false, initialPromise: null, timer: null };
  }

  const initialPromise = reconcileRequestDeadlines().catch((error) => {
    logger.error("Initial request deadline check failed:", error.message);
  });

  const timer = setIntervalFn(() => {
    reconcileRequestDeadlines().catch((error) => {
      logger.error("Scheduled request deadline check failed:", error.message);
    });
  }, DEADLINE_RECONCILIATION_INTERVAL_MS);
  if (typeof timer?.unref === "function") timer.unref();

  return { enabled: true, initialPromise, timer };
}

module.exports = {
  DEADLINE_RECONCILIATION_INTERVAL_MS,
  startAutomaticDeadlineReconciliation,
};
