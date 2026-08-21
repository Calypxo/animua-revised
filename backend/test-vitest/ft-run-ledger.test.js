const {
  registerExactGeneratedPaths,
  registerExactGeneratedTargets,
  validateBatch1MutationInput,
  validateBatch3MutationInput,
  validateBatch5MutationInput,
  validateBatch7MutationInput,
  validateBatch8MutationInput,
  validateBatch9MutationInput,
  validateBatch10MutationInput,
  validateFinalBatchMutationInput,
} = require("../scripts/ft-baseline/ledger");
const { validateGeneratedStoragePath } = require("../scripts/ft-baseline/operations");

function ledgerHarness() {
  const ledger = {
    testData: true,
    testId: "FT_RUN_LEDGER",
    testBaseline: "FT_BASELINE_V1",
    generatedFirestorePaths: [],
    generatedAuthEmails: [],
    generatedStoragePaths: [],
  };
  const ledgerRef = { path: "ftRunLedgers/FT_BASELINE_V1" };
  const db = {
    collection: vi.fn(() => ({ doc: vi.fn(() => ledgerRef) })),
    runTransaction: vi.fn(async (callback) => callback({
      get: vi.fn(async () => ({ exists: true, data: () => ledger })),
      update: vi.fn((_ref, update) => {
        if (update.generatedFirestorePaths) {
          ledger.generatedFirestorePaths = [
            ...new Set([
              ...ledger.generatedFirestorePaths,
              ...update.generatedFirestorePaths.values,
            ]),
          ];
        }
        if (update.generatedAuthEmails) {
          ledger.generatedAuthEmails = [
            ...new Set([
              ...ledger.generatedAuthEmails,
              ...update.generatedAuthEmails.values,
            ]),
          ];
        }
        if (update.generatedStoragePaths) {
          ledger.generatedStoragePaths = [
            ...new Set([
              ...ledger.generatedStoragePaths,
              ...update.generatedStoragePaths.values,
            ]),
          ];
        }
      }),
    })),
  };
  const admin = {
    firestore: {
      FieldValue: {
        arrayUnion: (...values) => ({ values }),
        serverTimestamp: () => "server-time",
      },
    },
  };
  const manifest = {
    baselineId: "FT_BASELINE_V1",
    ledgerPath: "ftRunLedgers/FT_BASELINE_V1",
    documents: [{
      path: "ftRunLedgers/FT_BASELINE_V1",
      data: { testData: true, testId: "FT_RUN_LEDGER", testBaseline: "FT_BASELINE_V1" },
    }],
    generatedFirestorePolicy: {
      allowedCollections: ["compatibilityResults", "adoptions", "surrenderRequests", "announcements", "contactMessages", "auditLogs", "notifications"],
      documentIdPattern: /^(?:QR-\d{4}-[A-F0-9]{8}|SR-\d{4}-\d+|[A-Za-z0-9]{20})$/,
      inventoryTransactionIdPattern: /^[A-Za-z0-9]{20}$/,
    },
    storage: {
      fixtureObjects: [],
      generatedObjectPolicies: [{
        testId: "IT_023_ANNOUNCEMENT_IMAGE",
        pathPattern: /^announcements\/FT_ANNOUNCEMENT_DRAFT\/cover-\d{13}\.(?:jpg|png|webp)$/,
      }],
    },
    registrationAccount: {
      email: "registration@example.test",
      firestorePath: "users/registration@example.test",
    },
  };
  return { admin, db, ledger, manifest };
}

describe("FT generated-record ledger registration", () => {
  it("atomically and idempotently registers only exact approved paths", async () => {
    const harness = ledgerHarness();
    const paths = [
      "compatibilityResults/QR-2026-A1B2C3D4",
      "adoptions/AbCdEfGhIjKlMnOpQrSt",
      "surrenderRequests/SR-2026-123456",
      "contactMessages/ZyXwVuTsRqPoNmLkJiHg",
    ];

    await registerExactGeneratedPaths({ ...harness, paths });
    await registerExactGeneratedPaths({ ...harness, paths });

    expect(harness.ledger.generatedFirestorePaths).toEqual([...paths].sort());
    expect(harness.db.runTransaction).toHaveBeenCalledTimes(2);
  });

  it("rejects a collection or document ID outside the generated-record policy", async () => {
    const harness = ledgerHarness();
    await expect(registerExactGeneratedPaths({
      ...harness,
      paths: ["users/ordinary-user"],
    })).rejects.toThrow(/Unknown delete target/);
    expect(harness.db.runTransaction).not.toHaveBeenCalled();
  });

  it("registers only the exact generated FT user and matching Auth email", async () => {
    const harness = ledgerHarness();
    const result = await registerExactGeneratedTargets({
      ...harness,
      paths: ["users/registration@example.test"],
      authEmails: ["registration@example.test"],
    });

    expect(result).toEqual({
      registeredPaths: ["users/registration@example.test"],
      registeredAuthEmails: ["registration@example.test"],
      registeredStoragePaths: [],
    });
    expect(harness.ledger.generatedFirestorePaths).toEqual(["users/registration@example.test"]);
    expect(harness.ledger.generatedAuthEmails).toEqual(["registration@example.test"]);

    await expect(registerExactGeneratedTargets({
      ...harness,
      paths: ["users/ordinary@example.test"],
      authEmails: ["ordinary@example.test"],
    })).rejects.toThrow(/Unknown delete target|outside the exact FT generated account/);
  });

  it("registers only the exact IT-023 announcement Storage namespace", async () => {
    const harness = ledgerHarness();
    const storagePath = "announcements/FT_ANNOUNCEMENT_DRAFT/cover-1760000000000.png";
    const result = await registerExactGeneratedTargets({
      ...harness,
      storagePaths: [storagePath],
    });

    expect(result.registeredStoragePaths).toEqual([storagePath]);
    expect(harness.ledger.generatedStoragePaths).toEqual([storagePath]);
    expect(validateGeneratedStoragePath(storagePath, harness.manifest)).to.equal(storagePath);
    expect(validateGeneratedStoragePath(
      "announcements/FT_ANNOUNCEMENT_DRAFT/cover-1760000000001.jpg",
      harness.manifest,
    )).to.equal("announcements/FT_ANNOUNCEMENT_DRAFT/cover-1760000000001.jpg");
    expect(() => validateGeneratedStoragePath(
      "announcements/FT_ANNOUNCEMENT_PUBLISHED/cover-1760000000000.png",
      harness.manifest,
    )).to.throw(/Unknown Storage delete target/);
  });
});

describe("Batch 1 generated-record ownership validation", () => {
  it("accepts only the exact intake, readiness, and medical fixtures", () => {
    expect(validateBatch1MutationInput({
      kind: "intakeConversion",
      primaryId: "FT_INTAKE_CONVERT_CANDIDATE",
    })).toEqual({
      kind: "intakeConversion",
      primaryId: "FT_INTAKE_CONVERT_CANDIDATE",
    });
    expect(validateBatch1MutationInput({
      kind: "animalReadiness",
      primaryId: "FT_ANIMAL_QUARANTINE_CLEARED",
    })).toEqual({
      kind: "animalReadiness",
      primaryId: "FT_ANIMAL_QUARANTINE_CLEARED",
    });
    expect(validateBatch1MutationInput({
      kind: "medicalInventory",
      primaryId: "FT_ANIMAL_QUARANTINE_EMPTY",
      inventoryItemId: "FT_TEST_MEDICINE_01",
      medicalRecordId: "MR-123456",
      quantity: 3,
    })).toMatchObject({ quantity: 3, medicalRecordId: "MR-123456" });

    expect(() => validateBatch1MutationInput({
      kind: "medicalInventory",
      primaryId: "ordinary-animal",
      inventoryItemId: "FT_TEST_MEDICINE_01",
      medicalRecordId: "MR-123456",
      quantity: 3,
    })).toThrow(/restricted to the Batch 1 animal fixtures/);
  });

  it("requires an exact movement fixture and a transaction only for successful movements", () => {
    expect(validateBatch1MutationInput({
      kind: "inventoryMovement",
      primaryId: "FT_TEST_BATCH_IN_01",
      movementType: "in",
      transactionId: "AbCdEfGhIjKlMnOpQrSt",
      quantity: 7,
      responseStatus: 201,
    })).toMatchObject({ movementType: "in", responseStatus: 201 });
    expect(validateBatch1MutationInput({
      kind: "inventoryMovement",
      primaryId: "FT_TEST_BATCH_OUT_02",
      movementType: "out",
      transactionId: "",
      quantity: 31,
      responseStatus: 409,
    })).toMatchObject({ movementType: "out", responseStatus: 409 });

    expect(() => validateBatch1MutationInput({
      kind: "inventoryMovement",
      primaryId: "FT_TEST_BATCH_OUT_02",
      movementType: "out",
      transactionId: "unexpected",
      quantity: 31,
      responseStatus: 409,
    })).toThrow(/requires exactly one transaction identifier/);
  });
});

describe("Batch 3 generated-record ownership validation", () => {
  it("accepts only the controlled adoption, announcement, and contact fixtures", () => {
    expect(validateBatch3MutationInput({
      kind: "adoptionDecision",
      primaryId: "FT_ADOPTION_APPROVE_CANDIDATE",
    })).toEqual({
      kind: "adoptionDecision",
      primaryId: "FT_ADOPTION_APPROVE_CANDIDATE",
    });
    expect(validateBatch3MutationInput({
      kind: "adoptionFinalization",
      primaryId: "FT_ADOPTION_FINALIZE_ELIGIBLE",
    })).toMatchObject({ kind: "adoptionFinalization" });
    expect(validateBatch3MutationInput({
      kind: "announcementPublish",
      primaryId: "FT_ANNOUNCEMENT_DRAFT",
    })).toMatchObject({ kind: "announcementPublish" });
    expect(validateBatch3MutationInput({
      kind: "contactReply",
      primaryId: "FT_CONTACT_NEW",
    })).toMatchObject({ kind: "contactReply" });

    expect(() => validateBatch3MutationInput({
      kind: "adoptionFinalization",
      primaryId: "FT_ADOPTION_FINALIZE_BLOCKED",
    })).toThrow(/uncontrolled Batch 3 ledger mutation/);
  });
});

describe("Batch 7 generated-record ownership validation", () => {
  it("accepts only the controlled intake draft and rejection workflows", () => {
    expect(validateBatch7MutationInput({
      kind: "intakeDraft",
      primaryId: "INT-2026-009",
      minimum: 2,
    })).toEqual({
      kind: "intakeDraft",
      primaryId: "INT-2026-009",
      minimum: 2,
    });
    expect(validateBatch7MutationInput({
      kind: "intakeRejection",
      primaryId: "FT_INTAKE_REJECT_CANDIDATE",
    })).toEqual({
      kind: "intakeRejection",
      primaryId: "FT_INTAKE_REJECT_CANDIDATE",
    });
    expect(() => validateBatch7MutationInput({
      kind: "intakeRejection",
      primaryId: "FT_INTAKE_PENDING",
    })).toThrow(/uncontrolled Batch 7 ledger mutation/);
  });
});

describe("Batch 8 generated-record ownership validation", () => {
  it("accepts only the exact animal fixtures and generated medical identifiers", () => {
    expect(validateBatch8MutationInput({
      kind: "animalBasicEdit",
      primaryId: "FT_ANIMAL_PROFILE_EDIT",
    })).toEqual({ kind: "animalBasicEdit", primaryId: "FT_ANIMAL_PROFILE_EDIT" });
    expect(validateBatch8MutationInput({
      kind: "animalClearance",
      primaryId: "FT_ANIMAL_QUARANTINE_ASSESSED",
      medicalRecordId: "MR-123456",
    })).toMatchObject({ kind: "animalClearance", medicalRecordId: "MR-123456" });
    expect(() => validateBatch8MutationInput({
      kind: "animalArchive",
      primaryId: "FT_ANIMAL_ARCHIVED",
    })).toThrow(/uncontrolled Batch 8 ledger mutation/);
    expect(() => validateBatch8MutationInput({
      kind: "animalMedical",
      primaryId: "FT_ANIMAL_MEDICAL_HISTORY",
      medicalRecordId: "FT_MR_CHECKUP",
    })).toThrow(/generated MR identifier/);
  });
});

describe("Batch 9 generated-record ownership validation", () => {
  it("accepts only the exact inventory and compatibility fixtures", () => {
    expect(validateBatch9MutationInput({
      kind: "inventoryItem",
      primaryId: "ITM013X",
    })).toEqual({ kind: "inventoryItem", primaryId: "ITM013X", minimum: 2 });
    expect(validateBatch9MutationInput({
      kind: "compatibilityQuestionCreate",
      primaryId: "question-1760000000000",
    })).toMatchObject({ kind: "compatibilityQuestionCreate" });
    expect(validateBatch9MutationInput({
      kind: "compatibilityQuestionStatusOrder",
      primaryId: "energyLevel",
    })).toMatchObject({ kind: "compatibilityQuestionStatusOrder" });
    expect(() => validateBatch9MutationInput({
      kind: "inventoryItem",
      primaryId: "ITM014X",
    })).toThrow(/restricted to ITM013X/);
    expect(() => validateBatch9MutationInput({
      kind: "compatibilityQuestionPublish",
      primaryId: "energyLevel",
    })).toThrow(/restricted to exerciseNeeds/);
  });
});

describe("Batch 10 generated-record ownership validation", () => {
  it("accepts only generated announcement IDs and controlled phases", () => {
    expect(validateBatch10MutationInput({
      kind: "announcementCreateEdit",
      primaryId: "AbCdEfGhIjKlMnOpQrSt",
      phase: "edited",
    })).toEqual({
      kind: "announcementCreateEdit",
      primaryId: "AbCdEfGhIjKlMnOpQrSt",
      phase: "edited",
    });
    expect(validateBatch10MutationInput({
      kind: "announcementDelete",
      primaryId: "ZyXwVuTsRqPoNmLkJiHg",
      phase: "deleted",
    })).toMatchObject({ kind: "announcementDelete", phase: "deleted" });
    expect(() => validateBatch10MutationInput({
      kind: "announcementDelete",
      primaryId: "FT_ANNOUNCEMENT_DRAFT",
      phase: "deleted",
    })).toThrow(/uncontrolled Batch 10 ledger mutation/);
  });
});

describe("Final Batch generated-record ownership validation", () => {
  it("accepts only the controlled archive, account, and notification mutations", () => {
    expect(validateFinalBatchMutationInput({
      kind: "animalRestore",
      primaryId: "FT_ANIMAL_ARCHIVED",
    })).toEqual({ kind: "animalRestore", primaryId: "FT_ANIMAL_ARCHIVED" });
    expect(validateFinalBatchMutationInput({
      kind: "managementProfile",
      primaryId: "FT_MANAGEMENT_PROFILE_MUTABLE",
      phase: "restored",
    })).toMatchObject({ kind: "managementProfile", phase: "restored" });
    const startedAt = Date.now();
    expect(validateFinalBatchMutationInput({
      kind: "managementPassword",
      primaryId: "FT_MANAGEMENT_PROFILE_MUTABLE",
      phase: "changed",
      startedAt,
    })).toMatchObject({ kind: "managementPassword", phase: "changed", startedAt });
    expect(validateFinalBatchMutationInput({
      kind: "managementNotificationRead",
      primaryId: "AbCdEfGhIjKlMnOpQrSt",
      referenceId: "FT_CONTACT_REPLIED",
    })).toMatchObject({ kind: "managementNotificationRead" });
    expect(() => validateFinalBatchMutationInput({
      kind: "animalRestore",
      primaryId: "FT_ANIMAL_ARCHIVE_CANDIDATE",
    })).toThrow(/uncontrolled Final Batch ledger mutation/);
  });
});

describe("Batch 5 generated-record ownership validation", () => {
  it("accepts only a generated QR identifier for the controlled retake workflow", () => {
    expect(validateBatch5MutationInput({
      kind: "compatibilityQuizRetake",
      primaryId: "QR-2026-A1B2C3D4",
    })).toEqual({
      kind: "compatibilityQuizRetake",
      primaryId: "QR-2026-A1B2C3D4",
    });
    expect(() => validateBatch5MutationInput({
      kind: "compatibilityQuizRetake",
      primaryId: "FT_QUIZ_RESULT_ELIGIBLE",
    })).toThrow(/generated QR result identifier/);
    expect(() => validateBatch5MutationInput({
      kind: "compatibilityQuiz",
      primaryId: "QR-2026-A1B2C3D4",
    })).toThrow(/generated QR result identifier/);
  });
});
