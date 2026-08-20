const fs = require("node:fs");
const path = require("node:path");

const { validateEnvironmentSafety, validateRuntimeSafety } = require("./ft-baseline/safety");
const { buildManifest } = require("./ft-baseline/manifest");
const defaultOperations = require("./ft-baseline/operations");

const ALLOWED_MODES = new Set(["dry-run", "seed", "reset", "verify"]);

function loadEnvironment() {
  const environmentFile = process.env.ANIMUA_ENV_FILE || ".env.test";
  const environmentPath = path.resolve(__dirname, "..", environmentFile);
  if (!fs.existsSync(environmentPath)) {
    throw new Error(`FT baseline requires ${environmentFile}. Copy .env.test.example first.`);
  }
  const result = require("dotenv").config({ path: environmentPath, override: false });
  if (result.error) throw result.error;
}

function commandLabel(mode) {
  return mode === "dry-run"
    ? "Dry-run"
    : mode === "verify"
      ? "Verify"
      : mode[0].toUpperCase() + mode.slice(1);
}

function printPlan(plan, logger = console) {
  logger.log(`FT baseline: ${plan.baselineId}`);
  logger.log(`Mode: ${plan.mode}`);
  logger.log(`Auth accounts: ${plan.authAccounts.length}`);
  logger.log(`Auth test IDs: ${plan.authAccounts.join(", ")}`);
  for (const item of plan.firestore) logger.log(`Firestore ${item.collection}: ${item.count}`);
  const idsByCollection = plan.firestoreDocumentIds.reduce((groups, item) => {
    groups[item.collection] = groups[item.collection] || [];
    groups[item.collection].push(item.testId);
    return groups;
  }, {});
  for (const [collection, testIds] of Object.entries(idsByCollection).sort(([a], [b]) => a.localeCompare(b))) {
    logger.log(`${collection} test IDs: ${testIds.join(", ")}`);
  }
  logger.log(`Registration baseline account: ${plan.registrationAccountExpectedAbsent} (must remain absent)`);
  logger.log(`Storage uploads: ${plan.storageUploads}`);
  if (plan.mode === "dry-run") {
    logger.log("Dry-run hosted API calls: 0");
    logger.log("Dry-run writes: 0");
  } else {
    logger.log("Plan stage hosted API calls: 0");
    logger.log("Plan stage writes: 0");
    logger.log(`${commandLabel(plan.mode)} mutation phase: pending read-only preflight`);
  }
}

function printVerification(result, logger = console) {
  logger.log(`FT baseline: ${result.baselineId}`);
  logger.log(`Auth users: ${result.authUsers.valid}/${result.authUsers.expected}`);
  for (const [collection, count] of Object.entries(result.collections).sort(([a], [b]) => a.localeCompare(b))) {
    logger.log(`${collection}: ${count.valid}/${count.expected}`);
  }
  logger.log(`FT_REGISTRATION_ACCOUNT absent: ${result.registrationAccountAbsent ? "Yes" : "No"}`);
  logger.log(
    `Controlled transient OTP records absent: ${result.transientCleanupDocumentsAbsent ? "Yes" : "No"}`
  );
  logger.log(
    `Generated Firestore records pending cleanup: ` +
    `${result.generatedFirestoreRecords.existing}/${result.generatedFirestoreRecords.registered}`
  );
  logger.log(`Verification: ${result.valid ? "PASSED" : "FAILED"}`);
  if (!result.valid) {
    result.missing.forEach((item) => logger.error(`Missing: ${item}`));
    result.invalid.forEach((item) => logger.error(`Invalid marker/state: ${item}`));
  }
}

function phaseLogger(label, logger) {
  const messages = {
    "preflight:start": `${label} read-only preflight: STARTED`,
    "preflight:passed": `${label} read-only preflight: PASSED`,
    "cleanup:start": `${label} controlled cleanup: STARTED`,
    "cleanup:passed": `${label} controlled cleanup: PASSED`,
    "auth:start": `${label} Auth mutations: STARTED`,
    "auth:passed": `${label} Auth mutations: PASSED`,
    "firestore:start": `${label} Firestore mutations: STARTED`,
    "firestore:passed": `${label} Firestore mutations: PASSED`,
  };
  return (phase) => logger.log(messages[phase] || `${label} phase: ${phase}`);
}

async function executeBaselineMode({
  mode,
  manifest,
  adapter,
  logger = console,
  operations = defaultOperations,
}) {
  if (!ALLOWED_MODES.has(mode)) throw new Error("Use one of: dry-run, seed, reset, verify.");

  if (mode === "dry-run") {
    printPlan(operations.dryRunPlan(manifest, mode), logger);
    logger.log("Dry-run: PASSED");
    return { exitCode: 0, result: null };
  }
  if (mode === "verify") {
    const result = await operations.verifyBaseline(adapter, manifest);
    printVerification(result, logger);
    return { exitCode: result.valid ? 0 : 1, result };
  }

  printPlan(operations.dryRunPlan(manifest, mode), logger);
  const label = commandLabel(mode);
  const options = { onPhase: phaseLogger(label, logger) };
  const result = mode === "seed"
    ? await operations.seedBaseline(adapter, manifest, options)
    : await operations.resetBaseline(adapter, manifest, options);
  logger.log(
    `${label} mutation summary: Auth ${result.users}/${manifest.users.length}; ` +
    `Firestore ${result.documents}/${manifest.documents.length}; ` +
    `Auth created ${result.auth.created}, updated ${result.auth.updated}, ` +
    `repaired ${result.auth.repaired}, claims ${result.auth.claimsSet}; ` +
    `Firestore batches ${result.firestore.batchesCommitted}.`
  );
  logger.log(`${label}: PASSED`);
  return { exitCode: 0, result };
}

function printFailure(mode, error, logger = console) {
  const label = commandLabel(mode || "seed");
  const category = error.operationCategory || "Command";
  const testId = error.testId || "FT_BASELINE_V1";
  const providerCode = String(error.cause?.code || error.code || "UNKNOWN").trim();
  logger.error(`${label} failure category: ${category}`);
  logger.error(`${label} failure target: ${testId}`);
  logger.error(`${label} failure code: ${providerCode}`);
  logger.error(`${label}: FAILED`);
}

async function runBaselineMode(options) {
  try {
    return await executeBaselineMode(options);
  } catch (error) {
    printFailure(options.mode, error, options.logger);
    return { exitCode: 1, error };
  }
}

async function main() {
  const mode = String(process.argv[2] || "").trim().toLowerCase();
  try {
    if (!ALLOWED_MODES.has(mode)) throw new Error("Use one of: dry-run, seed, reset, verify.");
    loadEnvironment();
    const expected = validateEnvironmentSafety(process.env);
    const manifest = buildManifest({ env: process.env, now: new Date() });

    // Initialization is local configuration only. No hosted API call occurs
    // until seed/reset preflight or verify is explicitly selected.
    const { admin, db, bucket, firebaseEnvironment } = require("../src/config/firebase");
    validateRuntimeSafety({
      firebaseEnvironment,
      bucketName: bucket.name,
      appProjectId: admin.app().options.projectId,
    }, expected);
    const adapter = { admin, db, bucket, auth: admin.auth() };
    return await runBaselineMode({ mode, manifest, adapter, logger: console });
  } catch (error) {
    printFailure(mode, error, console);
    return { exitCode: 1, error };
  }
}

if (require.main === module) {
  main().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

module.exports = {
  ALLOWED_MODES,
  commandLabel,
  printPlan,
  printVerification,
  executeBaselineMode,
  runBaselineMode,
  main,
};
