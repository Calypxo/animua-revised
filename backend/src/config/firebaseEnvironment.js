const DEFAULT_FIREBASE_PROJECT_ID = "animua-angelescity";
const DEFAULT_FIREBASE_STORAGE_BUCKET =
  "animua-angelescity.firebasestorage.app";

function clean(value) {
  return String(value || "").trim();
}

function resolveFirebaseEnvironment(env = process.env) {
  const appEnvironment = clean(env.APP_ENVIRONMENT || "normal-development")
    .toLowerCase();
  const functionalityTesting = appEnvironment === "functionality-testing";
  const functionalityTestProjectId = clean(
    env.FUNCTIONALITY_TEST_PROJECT_ID
  );
  const emulatorHosts = {
    firestore: clean(env.FIRESTORE_EMULATOR_HOST),
    auth: clean(env.FIREBASE_AUTH_EMULATOR_HOST),
    storage: clean(env.FIREBASE_STORAGE_EMULATOR_HOST),
  };
  const useFirebaseEmulators = Object.values(emulatorHosts).some(Boolean);
  const hostedProjectId = clean(env.FIREBASE_PROJECT_ID) ||
    DEFAULT_FIREBASE_PROJECT_ID;

  if (useFirebaseEmulators && (functionalityTesting || functionalityTestProjectId)) {
    throw new Error(
      "Firebase Emulator mode cannot be combined with hosted Functionality Testing configuration."
    );
  }

  if (functionalityTesting) {
    if (!functionalityTestProjectId) {
      throw new Error(
        "FUNCTIONALITY_TEST_PROJECT_ID is required for Functionality Testing."
      );
    }
    if (!clean(env.FIREBASE_PROJECT_ID)) {
      throw new Error(
        "FIREBASE_PROJECT_ID is required for hosted Functionality Testing."
      );
    }
    if (hostedProjectId !== functionalityTestProjectId) {
      throw new Error(
        "FIREBASE_PROJECT_ID does not match FUNCTIONALITY_TEST_PROJECT_ID."
      );
    }
  } else if (
    functionalityTestProjectId &&
    hostedProjectId === functionalityTestProjectId
  ) {
    throw new Error(
      "A Functionality Testing Firebase project requires APP_ENVIRONMENT=functionality-testing."
    );
  }

  const clientEmail = clean(env.FIREBASE_CLIENT_EMAIL);
  const privateKey = clean(env.FIREBASE_PRIVATE_KEY);
  const serviceAccountProjectId = clean(
    env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID
  ) || clientEmail.match(/@([^.@]+)\.iam\.gserviceaccount\.com$/)?.[1] || "";
  const hasAnyServiceAccountValue = Boolean(clientEmail || privateKey);
  const hasCompleteServiceAccount = Boolean(clientEmail && privateKey);

  if (hasAnyServiceAccountValue && !hasCompleteServiceAccount) {
    throw new Error(
      "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must be provided together."
    );
  }

  if (functionalityTesting && !hasCompleteServiceAccount) {
    throw new Error(
      "Hosted Functionality Testing requires dedicated Firebase service-account environment values."
    );
  }

  if (functionalityTesting && !clean(env.FIREBASE_STORAGE_BUCKET)) {
    throw new Error(
      "FIREBASE_STORAGE_BUCKET is required for hosted Functionality Testing."
    );
  }

  const projectId = useFirebaseEmulators
    ? clean(env.GCLOUD_PROJECT) || "demo-animua"
    : hostedProjectId;
  const storageBucket = useFirebaseEmulators
    ? `${projectId}.appspot.com`
    : clean(env.FIREBASE_STORAGE_BUCKET) || DEFAULT_FIREBASE_STORAGE_BUCKET;

  return {
    appEnvironment,
    functionalityTesting,
    functionalityTestProjectId,
    useFirebaseEmulators,
    emulatorHosts,
    projectId,
    storageBucket,
    serviceAccount: hasCompleteServiceAccount
      ? {
          projectId: serviceAccountProjectId || projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }
      : null,
  };
}

module.exports = {
  DEFAULT_FIREBASE_PROJECT_ID,
  DEFAULT_FIREBASE_STORAGE_BUCKET,
  resolveFirebaseEnvironment,
};
