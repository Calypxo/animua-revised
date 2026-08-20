const {
  APPROVED_PROJECT_ID,
  APPROVED_STORAGE_BUCKET,
  validateEnvironmentSafety,
  validateRuntimeSafety,
} = require("../scripts/ft-baseline/safety");
const {
  buildManifest,
  USER_DEFINITIONS,
  REGISTRATION_TEST_ID,
} = require("../scripts/ft-baseline/manifest");
const {
  dryRunPlan,
  resetBaseline,
  verifyBaseline,
  validateGeneratedDocumentPath,
  validateLedgerData,
} = require("../scripts/ft-baseline/operations");

function safeEnvironment() {
  const env = {
    APP_ENVIRONMENT: "functionality-testing",
    FIREBASE_PROJECT_ID: APPROVED_PROJECT_ID,
    FUNCTIONALITY_TEST_PROJECT_ID: APPROVED_PROJECT_ID,
    FIREBASE_SERVICE_ACCOUNT_PROJECT_ID: APPROVED_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: `firebase-adminsdk-test@${APPROVED_PROJECT_ID}.iam.gserviceaccount.com`,
    FIREBASE_STORAGE_BUCKET: APPROVED_STORAGE_BUCKET,
    FT_PUBLIC_PASSWORD: "not-a-real-public-password",
    FT_MANAGEMENT_PASSWORD: "not-a-real-management-password",
    FT_REGISTRATION_ACCOUNT_EMAIL: "ft-registration@example.test",
  };
  for (const [testId] of USER_DEFINITIONS) {
    env[`${testId}_EMAIL`] = `${testId.toLowerCase().replace(/_/g, ".")}@example.test`;
  }
  return env;
}

describe("Hosted FT baseline environment safety", () => {
  it("aborts for the production project", () => {
    const env = safeEnvironment();
    env.FIREBASE_PROJECT_ID = "animua-angelescity";
    env.FUNCTIONALITY_TEST_PROJECT_ID = "animua-angelescity";
    expect(() => validateEnvironmentSafety(env)).toThrow(/production project/);
  });

  it("aborts for mismatched active and functionality project IDs", () => {
    const env = safeEnvironment();
    env.FUNCTIONALITY_TEST_PROJECT_ID = "another-project";
    expect(() => validateEnvironmentSafety(env)).toThrow(/must equal/);
  });

  it.each([
    "FIRESTORE_EMULATOR_HOST",
    "FIREBASE_AUTH_EMULATOR_HOST",
    "FIREBASE_STORAGE_EMULATOR_HOST",
  ])("aborts when %s is enabled", (name) => {
    const env = safeEnvironment();
    env[name] = "127.0.0.1:9999";
    expect(() => validateEnvironmentSafety(env)).toThrow(/must be unset/);
  });

  it("aborts for the wrong service-account project", () => {
    const env = safeEnvironment();
    env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID = "wrong-project";
    expect(() => validateEnvironmentSafety(env)).toThrow(/service-account project/);
  });

  it("aborts for a service-account email from another project", () => {
    const env = safeEnvironment();
    delete env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID;
    env.FIREBASE_CLIENT_EMAIL = "firebase-adminsdk@other-project.iam.gserviceaccount.com";
    expect(() => validateEnvironmentSafety(env)).toThrow(/service-account project/);
  });

  it("aborts for the wrong Storage bucket", () => {
    const env = safeEnvironment();
    env.FIREBASE_STORAGE_BUCKET = "animua-angelescity.firebasestorage.app";
    expect(() => validateEnvironmentSafety(env)).toThrow(/FIREBASE_STORAGE_BUCKET/);
  });

  it("revalidates initialized Firebase project, service account, and bucket", () => {
    const expected = validateEnvironmentSafety(safeEnvironment());
    expect(() => validateRuntimeSafety({
      firebaseEnvironment: {
        projectId: APPROVED_PROJECT_ID,
        serviceAccount: { projectId: APPROVED_PROJECT_ID },
        useFirebaseEmulators: false,
      },
      bucketName: "wrong.appspot.com",
      appProjectId: APPROVED_PROJECT_ID,
    }, expected)).toThrow(/Storage bucket/);
  });
});

describe("FT baseline manifest and dry-run", () => {
  it("constructs the complete manifest without including FT_REGISTRATION_ACCOUNT", () => {
    const manifest = buildManifest({ env: safeEnvironment(), now: new Date("2026-08-13T00:00:00.000Z") });
    expect(manifest.users).toHaveLength(13);
    expect(manifest.users.map((user) => user.testId)).not.toContain(REGISTRATION_TEST_ID);
    expect(manifest.documents.map((entry) => entry.data.testId)).not.toContain(REGISTRATION_TEST_ID);
    expect(manifest.registrationAccount.testId).toBe(REGISTRATION_TEST_ID);
    expect(manifest.registrationAccount.otpFirestorePath).toBe(
      `emailVerificationOtps/${manifest.registrationAccount.email}`,
    );
    expect(manifest.transientCleanupDocuments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        testId: "FT_CLIENT_UNVERIFIED_EMAIL_OTP",
        path: `emailVerificationOtps/${manifest.users.find((user) => user.testId === "FT_CLIENT_UNVERIFIED").email}`,
      }),
      expect.objectContaining({
        testId: "FT_CLIENT_PROFILE_MUTABLE_PASSWORD_OTP",
        path: `passwordChangeOtps/${manifest.users.find((user) => user.testId === "FT_CLIENT_PROFILE_MUTABLE").email}`,
      }),
    ]));
    expect(manifest.documents.every((entry) => (
      entry.data.testData === true && entry.data.testBaseline === "FT_BASELINE_V1"
    ))).toBe(true);
    const savedResult = manifest.documents.find(
      (entry) => entry.path === "compatibilityResults/FT_QUIZ_RESULT_COOLDOWN"
    )?.data;
    expect(Object.keys(savedResult.preferences)).toHaveLength(18);
    expect(savedResult.filters).toEqual({
      preferredSpecies: "Any",
      preferredSex: "Any",
      needAllergyFriendly: "no",
      acceptSpecialNeeds: "yes",
    });
    expect(savedResult.questionSnapshot).toHaveLength(18);
    expect(savedResult.matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ animalId: "FT_ANIMAL_READY_DOG" }),
      expect.objectContaining({ animalId: "FT_ANIMAL_READY_CAT" }),
    ]));
  });

  it("dry-run creates a plan and performs zero Firebase calls", () => {
    const manifest = buildManifest({ env: safeEnvironment(), now: new Date("2026-08-13T00:00:00.000Z") });
    const firebase = { write: vi.fn(), read: vi.fn(), delete: vi.fn() };
    const plan = dryRunPlan(manifest, "dry-run");
    expect(plan.writes).toBe(0);
    expect(plan.storageUploads).toBe(0);
    expect(plan.registrationAccountExpectedAbsent).toBe(REGISTRATION_TEST_ID);
    expect(firebase.write).not.toHaveBeenCalled();
    expect(firebase.read).not.toHaveBeenCalled();
    expect(firebase.delete).not.toHaveBeenCalled();
  });
});

function missingAuthError() {
  return Object.assign(new Error("missing"), { code: "auth/user-not-found" });
}

function resetHarness() {
  const records = new Map([
    ["notifications/FT_BASE", { testData: true, testId: "FT_BASE", testBaseline: "FT_BASELINE_V1", value: "mutated" }],
    ["notifications/FT_RUN_ONE", { testData: true, testId: "FT_RUN_ONE", testBaseline: "FT_BASELINE_V1" }],
    ["notifications/ORDINARY", { value: "must survive" }],
    ["ftRunLedgers/FT_BASELINE_V1", {
      testData: true,
      testId: "FT_RUN_LEDGER",
      testBaseline: "FT_BASELINE_V1",
      generatedFirestorePaths: ["notifications/FT_RUN_ONE"],
      generatedAuthEmails: [],
      generatedStoragePaths: [],
    }],
  ]);
  const deleted = [];
  const written = [];
  const makeRef = (collection, id) => ({
    collection,
    id,
    path: `${collection}/${id}`,
    get: vi.fn(async () => ({ exists: records.has(`${collection}/${id}`), data: () => records.get(`${collection}/${id}`) })),
  });
  const db = {
    collection: vi.fn((collection) => ({ doc: vi.fn((id) => makeRef(collection, id)) })),
    batch: vi.fn(() => {
      const actions = [];
      return {
        set: vi.fn((ref, data) => actions.push(["set", ref, data])),
        delete: vi.fn((ref) => actions.push(["delete", ref])),
        commit: vi.fn(async () => {
          for (const [type, ref, data] of actions) {
            if (type === "set") {
              records.set(ref.path, data);
              written.push(ref.path);
            } else {
              records.delete(ref.path);
              deleted.push(ref.path);
            }
          }
        }),
      };
    }),
  };
  const auth = {
    getUser: vi.fn(async () => { throw missingAuthError(); }),
    getUserByEmail: vi.fn(async () => { throw missingAuthError(); }),
    deleteUser: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    setCustomUserClaims: vi.fn(),
  };
  const bucket = { file: vi.fn() };
  const baselineDocument = {
    collection: "notifications",
    id: "FT_BASE",
    path: "notifications/FT_BASE",
    data: { testData: true, testId: "FT_BASE", testBaseline: "FT_BASELINE_V1", value: "baseline" },
  };
  const ledgerDocument = {
    collection: "ftRunLedgers",
    id: "FT_BASELINE_V1",
    path: "ftRunLedgers/FT_BASELINE_V1",
    data: { testData: true, testId: "FT_RUN_LEDGER", testBaseline: "FT_BASELINE_V1", generatedFirestorePaths: [], generatedAuthEmails: [], generatedStoragePaths: [] },
  };
  const manifest = {
    baselineId: "FT_BASELINE_V1",
    users: [],
    documents: [baselineDocument, ledgerDocument],
    registrationAccount: { testId: REGISTRATION_TEST_ID, email: "registration@example.test" },
    transientCleanupDocuments: [
      {
        testId: "FT_CLIENT_UNVERIFIED_EMAIL_OTP",
        collection: "emailVerificationOtps",
        id: "unverified@example.test",
        path: "emailVerificationOtps/unverified@example.test",
      },
      {
        testId: "FT_CLIENT_PROFILE_MUTABLE_PASSWORD_OTP",
        collection: "passwordChangeOtps",
        id: "mutable@example.test",
        path: "passwordChangeOtps/mutable@example.test",
      },
    ],
    ledgerPath: "ftRunLedgers/FT_BASELINE_V1",
    storage: { fixtureObjects: [] },
    generatedFirestorePolicy: {
      allowedCollections: ["notifications"],
      documentIdPattern: /^(?:FT_RUN_[A-Za-z0-9_-]+|[A-Za-z0-9]{20})$/,
      inventoryTransactionIdPattern: /^(?:FT_RUN_[A-Za-z0-9_-]+|[A-Za-z0-9]{20})$/,
    },
  };
  return { adapter: { db, auth, bucket }, manifest, records, deleted, written };
}

describe("FT baseline reset target controls", () => {
  it("aborts an unknown Firestore or ledger delete target", () => {
    const { manifest } = resetHarness();
    expect(() => validateGeneratedDocumentPath("notifications/ORDINARY", manifest)).toThrow(/Unknown delete target/);
    expect(() => validateLedgerData({
      generatedFirestorePaths: ["users/FT_RUN_FORBIDDEN"],
      generatedAuthEmails: [],
      generatedStoragePaths: [],
    }, manifest)).toThrow(/Unknown delete target/);
  });

  it("deletes only the exact ledger-owned generated record and restores manifest records", async () => {
    const { adapter, manifest, records, deleted, written } = resetHarness();
    records.set("users/registration@example.test", { email: "registration@example.test" });
    records.set("emailVerificationOtps/registration@example.test", { otpHash: "ft-only" });
    records.set("emailVerificationOtps/unverified@example.test", { otpHash: "ft-email-otp" });
    records.set("passwordChangeOtps/mutable@example.test", { otpHash: "ft-password-otp" });
    records.set("emailVerificationOtps/ordinary@example.test", { otpHash: "must survive" });
    records.set("passwordChangeOtps/ordinary@example.test", { otpHash: "must survive" });
    await resetBaseline(adapter, manifest);
    expect(deleted.sort()).toEqual([
      "emailVerificationOtps/registration@example.test",
      "emailVerificationOtps/unverified@example.test",
      "notifications/FT_RUN_ONE",
      "passwordChangeOtps/mutable@example.test",
      "users/registration@example.test",
    ]);
    expect(written.sort()).toEqual(["ftRunLedgers/FT_BASELINE_V1", "notifications/FT_BASE"]);
    expect(records.get("notifications/FT_BASE").value).toBe("baseline");
    expect(records.get("notifications/ORDINARY")).toEqual({ value: "must survive" });
    expect(records.get("emailVerificationOtps/ordinary@example.test")).toEqual({ otpHash: "must survive" });
    expect(records.get("passwordChangeOtps/ordinary@example.test")).toEqual({ otpHash: "must survive" });
  });

  it("aborts before deletion when a ledger target lacks FT ownership markers", async () => {
    const { adapter, manifest, records, deleted } = resetHarness();
    records.set("notifications/FT_RUN_ONE", { testData: false, testId: "FT_RUN_ONE", testBaseline: "FT_BASELINE_V1" });
    await expect(resetBaseline(adapter, manifest)).rejects.toThrow(/ownership markers/);
    expect(deleted).toEqual([]);
  });

  it("verification fails while an exact ledger-owned generated record remains", async () => {
    const { adapter, manifest } = resetHarness();
    const result = await verifyBaseline(adapter, manifest);
    expect(result.valid).toBe(false);
    expect(result.generatedFirestoreRecords).toEqual({ registered: 1, existing: 1 });
    expect(result.invalid).toContain("Generated/notifications/FT_RUN_ONE");
  });
});
