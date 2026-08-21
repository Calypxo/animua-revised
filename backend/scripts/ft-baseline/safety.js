const APPROVED_PROJECT_ID = "animua-ft";
const PRODUCTION_PROJECT_ID = "animua-angelescity";
const APPROVED_STORAGE_BUCKET = "animua-ft.firebasestorage.app";
const EMULATOR_VARIABLES = [
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "FIREBASE_STORAGE_EMULATOR_HOST",
];

function clean(value) {
  return String(value || "").trim();
}

function abort(message) {
  const error = new Error(`FT baseline safety check failed: ${message}`);
  error.code = "FT_BASELINE_SAFETY_ABORT";
  throw error;
}

function validateEnvironmentSafety(env = process.env) {
  const appEnvironment = clean(env.APP_ENVIRONMENT);
  const activeProjectId = clean(env.FIREBASE_PROJECT_ID);
  const functionalityProjectId = clean(env.FUNCTIONALITY_TEST_PROJECT_ID);
  const storageBucket = clean(env.FIREBASE_STORAGE_BUCKET);
  const clientEmail = clean(env.FIREBASE_CLIENT_EMAIL).toLowerCase();
  const emailProjectId = clientEmail.match(/@([^.@]+)\.iam\.gserviceaccount\.com$/)?.[1] || "";
  const explicitServiceAccountProjectId = clean(env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID);
  if (
    explicitServiceAccountProjectId &&
    emailProjectId &&
    explicitServiceAccountProjectId !== emailProjectId
  ) {
    abort("the explicit service-account project ID does not match its email domain.");
  }
  const serviceAccountProjectId = explicitServiceAccountProjectId || emailProjectId;

  if (appEnvironment !== "functionality-testing") {
    abort("APP_ENVIRONMENT must be exactly functionality-testing.");
  }
  if (activeProjectId === PRODUCTION_PROJECT_ID || functionalityProjectId === PRODUCTION_PROJECT_ID) {
    abort(`the production project ${PRODUCTION_PROJECT_ID} is forbidden.`);
  }
  if (activeProjectId !== functionalityProjectId) {
    abort("FIREBASE_PROJECT_ID must equal FUNCTIONALITY_TEST_PROJECT_ID.");
  }
  if (activeProjectId !== APPROVED_PROJECT_ID) {
    abort(`the only approved project is ${APPROVED_PROJECT_ID}.`);
  }
  if (serviceAccountProjectId !== APPROVED_PROJECT_ID) {
    abort("the service-account project ID must identify animua-ft.");
  }
  if (!clientEmail.endsWith(`@${APPROVED_PROJECT_ID}.iam.gserviceaccount.com`)) {
    abort("the Firebase service-account email does not belong to animua-ft.");
  }
  if (storageBucket !== APPROVED_STORAGE_BUCKET) {
    abort(`FIREBASE_STORAGE_BUCKET must be ${APPROVED_STORAGE_BUCKET}.`);
  }
  const enabledEmulator = EMULATOR_VARIABLES.find((name) => clean(env[name]));
  if (enabledEmulator) {
    abort(`${enabledEmulator} must be unset.`);
  }

  return Object.freeze({
    projectId: APPROVED_PROJECT_ID,
    serviceAccountProjectId,
    storageBucket: APPROVED_STORAGE_BUCKET,
  });
}

function validateRuntimeSafety({ firebaseEnvironment, bucketName, appProjectId }, expected) {
  if (!expected || expected.projectId !== APPROVED_PROJECT_ID) {
    abort("validated environment context is required before Firebase initialization.");
  }
  if (firebaseEnvironment?.projectId !== APPROVED_PROJECT_ID) {
    abort("initialized Firebase project does not match animua-ft.");
  }
  if (firebaseEnvironment?.serviceAccount?.projectId !== APPROVED_PROJECT_ID) {
    abort("initialized service-account project does not match animua-ft.");
  }
  if (appProjectId !== APPROVED_PROJECT_ID) {
    abort("Firebase Admin app project does not match animua-ft.");
  }
  if (bucketName !== APPROVED_STORAGE_BUCKET) {
    abort("initialized Storage bucket is not the approved animua-ft bucket.");
  }
  if (firebaseEnvironment?.useFirebaseEmulators) {
    abort("Firebase Emulator mode is enabled.");
  }
  return true;
}

module.exports = {
  APPROVED_PROJECT_ID,
  APPROVED_STORAGE_BUCKET,
  PRODUCTION_PROJECT_ID,
  EMULATOR_VARIABLES,
  validateEnvironmentSafety,
  validateRuntimeSafety,
};
