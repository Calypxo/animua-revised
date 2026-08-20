const fs = require("node:fs");
const path = require("node:path");

const {
  validateEnvironmentSafety,
  validateRuntimeSafety,
} = require("./safety");
const { buildManifest } = require("./manifest");
const {
  assertOwnedDocument,
  validateGeneratedDocumentPath,
  validateGeneratedStoragePath,
  validateLedgerData,
} = require("./operations");

const MUTATIONS = Object.freeze({
  compatibilityQuiz: {
    primaryCollection: "compatibilityResults",
    notificationRecipients: [
      "FT_ADMIN_ACTIVE",
      "FT_STAFF_ACTIVE",
      "FT_VET_ACTIVE",
      "FT_MANAGEMENT_PROFILE_MUTABLE",
    ],
  },
  compatibilityQuizRetake: {
    primaryCollection: "compatibilityResults",
    notificationRecipients: [
      "FT_ADMIN_ACTIVE",
      "FT_STAFF_ACTIVE",
      "FT_VET_ACTIVE",
      "FT_MANAGEMENT_PROFILE_MUTABLE",
    ],
    notificationType: "compatibility_quiz_completed",
  },
  adoptionApplication: {
    primaryCollection: "adoptions",
    notificationRecipients: [
      "FT_ADMIN_ACTIVE",
      "FT_STAFF_ACTIVE",
      "FT_MANAGEMENT_PROFILE_MUTABLE",
    ],
    auditDetails: "POST /api/adoptions completed with status 201.",
    auditAction: "adoption.created",
  },
  adoptionPickup: {
    auditDetails: "PATCH /api/adoptions/my-applications/FT_ADOPTION_APPROVED/pickup-schedule completed with status 200.",
    auditAction: "adoption.scheduled",
  },
  surrenderRequest: {
    primaryCollection: "surrenderRequests",
    notificationRecipients: [
      "FT_ADMIN_ACTIVE",
      "FT_STAFF_ACTIVE",
      "FT_MANAGEMENT_PROFILE_MUTABLE",
    ],
    auditDetails: "POST /api/surrenders completed with status 201.",
    auditAction: "surrender.created",
  },
  integrationSurrenderRequest: {
    primaryCollection: "surrenderRequests",
    notificationRecipients: [
      "FT_ADMIN_ACTIVE",
      "FT_STAFF_ACTIVE",
      "FT_MANAGEMENT_PROFILE_MUTABLE",
    ],
    notificationType: "surrender_request_created",
    auditDetails: "POST /api/surrenders completed with status 201.",
    auditAction: "surrender.created",
    auditTargetMatchesPrimary: true,
  },
  surrenderAppointment: {
    auditDetails: "PATCH /api/surrenders/my-requests/FT_SURRENDER_APPROVED/appointment completed with status 200.",
    auditAction: "surrender.scheduled",
  },
  contactInquiry: {
    primaryCollection: "contactMessages",
    notificationRecipients: [
      "FT_ADMIN_ACTIVE",
      "FT_STAFF_ACTIVE",
      "FT_MANAGEMENT_PROFILE_MUTABLE",
    ],
    auditDetails: "POST /api/public/contact completed with status 201.",
    auditAction: "contact.created",
  },
  contactFollowUp: {
    auditDetails: "POST /api/public/contact/FT_CONTACT_REPLIED/follow-up completed with status 200.",
    auditAction: "contact.follow_up_added",
  },
  passwordChange: {
    auditAction: "account.password_changed",
    actor: "FT_CLIENT_PROFILE_MUTABLE",
  },
  userAccount: {
    actor: "FT_ADMIN_ACTIVE",
  },
  userStatus: {
    actor: "FT_ADMIN_ACTIVE",
    target: "FT_MANAGEMENT_PROFILE_MUTABLE",
  },
  surrenderDecision: {
    actor: "FT_ADMIN_ACTIVE",
  },
  intakeFromSurrender: {
    actor: "FT_ADMIN_ACTIVE",
    surrenderId: "FT_SURRENDER_INTAKE_ELIGIBLE",
  },
  adoptionDecision: {
    actor: "FT_ADMIN_ACTIVE",
  },
  adoptionFinalization: {
    actor: "FT_ADMIN_ACTIVE",
    eligibleId: "FT_ADOPTION_FINALIZE_ELIGIBLE",
    blockedId: "FT_ADOPTION_FINALIZE_BLOCKED",
  },
  announcementPublish: {
    actor: "FT_ADMIN_ACTIVE",
    announcementId: "FT_ANNOUNCEMENT_DRAFT",
    disabledRecipient: "FT_CLIENT_NOTIFICATIONS",
  },
  contactReply: {
    actor: "FT_ADMIN_ACTIVE",
    contactId: "FT_CONTACT_NEW",
    recipient: "FT_CLIENT_ACTIVE",
  },
  announcementCreateEdit: { actor: "FT_ADMIN_ACTIVE" },
  announcementDelete: { actor: "FT_ADMIN_ACTIVE", restrictedActor: "FT_STAFF_ACTIVE" },
  animalBasicEdit: { actor: "FT_ADMIN_ACTIVE", auditAction: "animal.updated" },
  animalPhoto: { actor: "FT_ADMIN_ACTIVE" },
  animalQuarantine: { actor: "FT_ADMIN_ACTIVE", auditAction: "animal.sent_to_quarantine" },
  animalBehavioral: { actor: "FT_ADMIN_ACTIVE", auditAction: "animal.behavioral_assessment" },
  animalMedical: { actor: "FT_ADMIN_ACTIVE", auditAction: "animal.medical_record_added" },
  animalClearance: { actor: "FT_ADMIN_ACTIVE", auditAction: "animal.medical_record_added" },
  animalArchive: { actor: "FT_ADMIN_ACTIVE", auditAction: "animal.archived" },
  animalRestore: { actor: "FT_ADMIN_ACTIVE", auditAction: "animal.restored" },
  managementProfile: { actor: "FT_MANAGEMENT_PROFILE_MUTABLE", auditAction: "account.profile_updated" },
  managementPassword: { actor: "FT_MANAGEMENT_PROFILE_MUTABLE", auditAction: "account.password_changed" },
  managementNotificationRead: { actor: "FT_MANAGEMENT_PROFILE_MUTABLE", auditAction: "notification.marked_read" },
});

const BATCH_1_FIXTURES = Object.freeze({
  intakeConversion: "FT_INTAKE_CONVERT_CANDIDATE",
  readinessAnimals: new Set([
    "FT_ANIMAL_QUARANTINE_CLEARED",
    "FT_ANIMAL_QUARANTINE_ASSESSED",
  ]),
  medicalAnimals: new Set([
    "FT_ANIMAL_QUARANTINE_EMPTY",
    "FT_ANIMAL_MEDICAL_HISTORY",
  ]),
  medicalInventory: "FT_TEST_MEDICINE_01",
  movementItems: new Set([
    "FT_TEST_BATCH_IN_01",
    "FT_TEST_BATCH_IN_02",
    "FT_TEST_BATCH_OUT_01",
    "FT_TEST_BATCH_OUT_02",
  ]),
});

const BATCH_3_FIXTURES = Object.freeze({
  adoptionDecisions: new Set([
    "FT_ADOPTION_APPROVE_CANDIDATE",
    "FT_ADOPTION_REJECT_CANDIDATE",
  ]),
  adoptionFinalization: "FT_ADOPTION_FINALIZE_ELIGIBLE",
  announcementPublish: "FT_ANNOUNCEMENT_DRAFT",
  contactReply: "FT_CONTACT_NEW",
});

const BATCH_7_FIXTURES = Object.freeze({
  intakeRejection: "FT_INTAKE_REJECT_CANDIDATE",
});

const BATCH_8_FIXTURES = Object.freeze({
  animalBasicEdit: "FT_ANIMAL_PROFILE_EDIT",
  animalPhoto: "FT_ANIMAL_PROFILE_EDIT",
  animalQuarantine: "FT_ANIMAL_PROFILING",
  animalBehavioral: "FT_ANIMAL_QUARANTINE_EMPTY",
  animalMedical: "FT_ANIMAL_MEDICAL_HISTORY",
  animalClearance: "FT_ANIMAL_QUARANTINE_ASSESSED",
  animalArchive: "FT_ANIMAL_ARCHIVE_CANDIDATE",
});

const BATCH_9_FIXTURES = Object.freeze({
  inventoryItem: "ITM013X",
  compatibilitySettings: "compatibilityQuiz",
  compatibilityRetakeOverride: "FT_CLIENT_QUIZ_COOLDOWN",
  compatibilityQuestionStatusOrder: "energyLevel",
  compatibilityQuestionPublish: "exerciseNeeds",
});

const BATCH_10_FIXTURES = Object.freeze({
  announcementCreateEdit: {
    title: "FT-069 Controlled Announcement",
    createdCaption: "FT-069 controlled announcement created through the management UI.",
    editedCaption: "FT-069 controlled announcement edited through the management UI.",
  },
  announcementDelete: {
    title: "FT-071 Deletable Announcement",
    createdCaption: "FT-071 controlled announcement created for deletion.",
  },
});

const FINAL_BATCH_FIXTURES = Object.freeze({
  animalRestore: "FT_ANIMAL_ARCHIVED",
  managementAccount: "FT_MANAGEMENT_PROFILE_MUTABLE",
  managementNotificationRelatedId: "FT_CONTACT_REPLIED",
  managementNotificationType: "contact_message_created",
  updatedProfileName: "FT Management Profile Updated",
});

function validateBatch5MutationInput(input = {}) {
  const kind = clean(input.kind);
  const primaryId = clean(input.primaryId);
  if (kind !== "compatibilityQuizRetake" || !/^QR-\d{4}-[A-F0-9]{8}$/.test(primaryId)) {
    throw new Error("Batch 5 quiz registration requires the generated QR result identifier.");
  }
  return { kind, primaryId };
}

let hostedContextPromise;

function clean(value) {
  return String(value || "").trim();
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return number;
}

function validateBatch1MutationInput(input = {}) {
  const kind = clean(input.kind);
  const primaryId = clean(input.primaryId);

  if (kind === "intakeConversion") {
    if (primaryId !== BATCH_1_FIXTURES.intakeConversion) {
      throw new Error("Intake conversion registration is restricted to FT_INTAKE_CONVERT_CANDIDATE.");
    }
    return { kind, primaryId };
  }

  if (kind === "animalReadiness") {
    if (!BATCH_1_FIXTURES.readinessAnimals.has(primaryId)) {
      throw new Error("Animal readiness registration is restricted to the Batch 1 quarantine fixtures.");
    }
    return { kind, primaryId };
  }

  if (kind === "medicalInventory") {
    const inventoryItemId = clean(input.inventoryItemId);
    const medicalRecordId = clean(input.medicalRecordId);
    const quantity = positiveInteger(input.quantity, "Medical inventory quantity");
    if (!BATCH_1_FIXTURES.medicalAnimals.has(primaryId)) {
      throw new Error("Medical integration registration is restricted to the Batch 1 animal fixtures.");
    }
    if (inventoryItemId !== BATCH_1_FIXTURES.medicalInventory) {
      throw new Error("Medical integration registration is restricted to FT_TEST_MEDICINE_01.");
    }
    if (!/^MR-\d+$/.test(medicalRecordId)) {
      throw new Error("Medical integration registration requires the generated MR identifier.");
    }
    return { kind, primaryId, inventoryItemId, medicalRecordId, quantity };
  }

  if (kind === "inventoryMovement") {
    const movementType = clean(input.movementType);
    const transactionId = clean(input.transactionId);
    const quantity = positiveInteger(input.quantity, "Inventory movement quantity");
    const responseStatus = Number(input.responseStatus);
    if (!BATCH_1_FIXTURES.movementItems.has(primaryId)) {
      throw new Error("Inventory movement registration is restricted to the Batch 1 movement fixtures.");
    }
    if (!["in", "out"].includes(movementType)) {
      throw new Error("Inventory movement type must be in or out.");
    }
    if (![201, 409].includes(responseStatus)) {
      throw new Error("Inventory movement registration requires response status 201 or 409.");
    }
    if ((responseStatus === 201) !== Boolean(transactionId)) {
      throw new Error("Successful inventory movement registration requires exactly one transaction identifier.");
    }
    return { kind, primaryId, movementType, transactionId, quantity, responseStatus };
  }

  throw new Error(`Unsupported Batch 1 ledger mutation: ${kind || "(empty)"}.`);
}

function validateBatch9MutationInput(input = {}) {
  const kind = clean(input.kind);
  const primaryId = clean(input.primaryId);
  if (kind === "inventoryItem") {
    if (primaryId !== BATCH_9_FIXTURES.inventoryItem) {
      throw new Error("Batch 9 inventory item registration is restricted to ITM013X.");
    }
    const minimum = Number(input.minimum ?? 2);
    if (![1, 2].includes(minimum)) {
      throw new Error("Batch 9 inventory item registration requires audit minimum 1 or 2.");
    }
    return { kind, primaryId, minimum };
  } else if (kind === "compatibilitySettings") {
    if (primaryId !== BATCH_9_FIXTURES.compatibilitySettings) {
      throw new Error("Batch 9 compatibility settings registration requires compatibilityQuiz.");
    }
  } else if (kind === "compatibilityRetakeOverride") {
    if (primaryId !== BATCH_9_FIXTURES.compatibilityRetakeOverride) {
      throw new Error("Batch 9 retake registration is restricted to FT_CLIENT_QUIZ_COOLDOWN.");
    }
  } else if (kind === "compatibilityQuestionCreate") {
    if (!/^question-\d{13}$/.test(primaryId)) {
      throw new Error("Batch 9 question creation registration requires the generated question identifier.");
    }
  } else if (kind === "compatibilityQuestionStatusOrder") {
    if (primaryId !== BATCH_9_FIXTURES.compatibilityQuestionStatusOrder) {
      throw new Error("Batch 9 question status/order registration is restricted to energyLevel.");
    }
  } else if (kind === "compatibilityQuestionPublish") {
    if (primaryId !== BATCH_9_FIXTURES.compatibilityQuestionPublish) {
      throw new Error("Batch 9 question publishing registration is restricted to exerciseNeeds.");
    }
  } else {
    throw new Error(`Unsupported Batch 9 ledger mutation: ${kind || "(empty)"}.`);
  }
  return { kind, primaryId };
}

function validateBatch3MutationInput(input = {}) {
  const kind = clean(input.kind);
  const primaryId = clean(input.primaryId);

  if (kind === "adoptionDecision" && BATCH_3_FIXTURES.adoptionDecisions.has(primaryId)) {
    return { kind, primaryId };
  }
  if (kind === "adoptionFinalization" && primaryId === BATCH_3_FIXTURES.adoptionFinalization) {
    return { kind, primaryId };
  }
  if (kind === "announcementPublish" && primaryId === BATCH_3_FIXTURES.announcementPublish) {
    return { kind, primaryId };
  }
  if (kind === "contactReply" && primaryId === BATCH_3_FIXTURES.contactReply) {
    return { kind, primaryId };
  }

  throw new Error(`Unsupported or uncontrolled Batch 3 ledger mutation: ${kind || "(empty)"}.`);
}

function validateBatch10MutationInput(input = {}) {
  const kind = clean(input.kind);
  const primaryId = clean(input.primaryId);
  const phase = clean(input.phase);
  const phases = kind === "announcementCreateEdit"
    ? new Set(["created", "edited"])
    : kind === "announcementDelete"
      ? new Set(["created", "deleted"])
      : new Set();
  if (!/^[A-Za-z0-9]{20}$/.test(primaryId) || !phases.has(phase)) {
    throw new Error(`Unsupported or uncontrolled Batch 10 ledger mutation: ${kind || "(empty)"}.`);
  }
  return { kind, primaryId, phase };
}

function validateFinalBatchMutationInput(input = {}) {
  const kind = clean(input.kind);
  const primaryId = clean(input.primaryId);
  const phase = clean(input.phase);

  if (kind === "animalRestore" && primaryId === FINAL_BATCH_FIXTURES.animalRestore) {
    return { kind, primaryId };
  }
  if (["managementProfile", "managementPassword"].includes(kind)) {
    const phases = kind === "managementProfile"
      ? new Set(["updated", "restored"])
      : new Set(["changed", "restored"]);
    if (primaryId === FINAL_BATCH_FIXTURES.managementAccount && phases.has(phase)) {
      if (kind === "managementPassword") {
        const startedAt = Number(input.startedAt);
        const now = Date.now();
        if (!Number.isInteger(startedAt) || startedAt < now - 10 * 60 * 1000 || startedAt > now + 60 * 1000) {
          throw new Error("The controlled management password mutation requires a recent start timestamp.");
        }
        return { kind, primaryId, phase, startedAt };
      }
      return { kind, primaryId, phase };
    }
  }
  if (kind === "managementNotificationRead") {
    const referenceId = clean(input.referenceId);
    if (/^[A-Za-z0-9]{20}$/.test(primaryId) &&
      referenceId === FINAL_BATCH_FIXTURES.managementNotificationRelatedId) {
      return { kind, primaryId, referenceId };
    }
  }

  throw new Error(`Unsupported or uncontrolled Final Batch ledger mutation: ${kind || "(empty)"}.`);
}

function validateBatch7MutationInput(input = {}) {
  const kind = clean(input.kind);
  const primaryId = clean(input.primaryId);

  if (kind === "intakeDraft") {
    const minimum = input.minimum === undefined ? 1 : Number(input.minimum);
    if (!/^INT-\d{4}-\d{3,}$/.test(primaryId) || ![1, 2].includes(minimum)) {
      throw new Error("Batch 7 draft registration requires a generated INT identifier and audit minimum 1 or 2.");
    }
    return { kind, primaryId, minimum };
  }

  if (kind === "intakeRejection" && primaryId === BATCH_7_FIXTURES.intakeRejection) {
    return { kind, primaryId };
  }

  throw new Error(`Unsupported or uncontrolled Batch 7 ledger mutation: ${kind || "(empty)"}.`);
}

function validateBatch8MutationInput(input = {}) {
  const kind = clean(input.kind);
  const primaryId = clean(input.primaryId);
  if (BATCH_8_FIXTURES[kind] !== primaryId) {
    throw new Error(`Unsupported or uncontrolled Batch 8 ledger mutation: ${kind || "(empty)"}.`);
  }
  if (["animalMedical", "animalClearance"].includes(kind)) {
    const medicalRecordId = clean(input.medicalRecordId);
    if (!/^MR-\d+$/.test(medicalRecordId)) {
      throw new Error("Batch 8 medical registration requires the generated MR identifier.");
    }
    return { kind, primaryId, medicalRecordId };
  }
  return { kind, primaryId };
}

function loadFunctionalityEnvironment(env = process.env) {
  const environmentFile = env.ANIMUA_ENV_FILE || ".env.test";
  const environmentPath = path.resolve(__dirname, "..", "..", environmentFile);
  if (!fs.existsSync(environmentPath)) {
    throw new Error(`FT run ledger requires ${environmentFile}.`);
  }
  const result = require("dotenv").config({ path: environmentPath, override: false });
  if (result.error) throw result.error;
}

async function createHostedContext() {
  loadFunctionalityEnvironment();
  const expected = validateEnvironmentSafety(process.env);
  const manifest = buildManifest({ env: process.env, now: new Date() });
  const { admin, db, bucket, firebaseEnvironment } = require("../../src/config/firebase");
  validateRuntimeSafety({
    firebaseEnvironment,
    bucketName: bucket.name,
    appProjectId: admin.app().options.projectId,
  }, expected);
  return { admin, db, bucket, manifest };
}

function getHostedContext() {
  if (!hostedContextPromise) hostedContextPromise = createHostedContext();
  return hostedContextPromise;
}

function userEmail(manifest, testId) {
  return manifest.users.find((user) => user.testId === testId)?.email || "";
}

function documentPath(snapshot) {
  return `${snapshot.ref.parent.id}/${snapshot.id}`;
}

async function queryUntil({ db, collection, field, value, minimum = 1, timeoutMs = 5000 }) {
  const deadline = Date.now() + timeoutMs;
  let snapshot;
  do {
    snapshot = await db.collection(collection).where(field, "==", value).get();
    if (snapshot.size >= minimum) return snapshot.docs;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Timed out locating generated ${collection} records for FT ledger registration.`);
}

async function queryUntilMatching({ predicate, minimum = 1, ...options }) {
  const deadline = Date.now() + (options.timeoutMs || 5000);
  do {
    const documents = await queryUntil({ ...options, minimum: 0, timeoutMs: 1 });
    const matches = documents.filter((document) => predicate(document.data() || {}));
    if (matches.length >= minimum) return matches;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Timed out locating generated ${options.collection} records for FT ledger registration.`);
}

async function queryInventoryTransactionsUntil({
  db,
  itemId,
  field,
  value,
  minimum = 1,
  timeoutMs = 5000,
}) {
  const deadline = Date.now() + timeoutMs;
  do {
    const snapshot = await db
      .collection("inventoryItems")
      .doc(itemId)
      .collection("transactions")
      .where(field, "==", value)
      .get();
    if (snapshot.size >= minimum) return snapshot.docs;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Timed out locating generated inventory transactions for ${itemId}.`);
}

async function registerExactGeneratedTargets({
  db,
  admin,
  manifest,
  paths = [],
  authEmails = [],
  storagePaths = [],
}) {
  const uniquePaths = [...new Set(paths.map(clean).filter(Boolean))].sort();
  const uniqueAuthEmails = [...new Set(authEmails.map((value) => clean(value).toLowerCase()).filter(Boolean))].sort();
  const uniqueStoragePaths = [...new Set(storagePaths.map(clean).filter(Boolean))].sort();
  uniquePaths.forEach((item) => validateGeneratedDocumentPath(item, manifest));
  uniqueStoragePaths.forEach((item) => validateGeneratedStoragePath(item, manifest));
  const approvedAuthEmails = new Set([manifest.registrationAccount.email]);
  uniqueAuthEmails.forEach((email) => {
    if (!approvedAuthEmails.has(email)) {
      throw new Error("Refusing to register an Auth identity outside the exact FT generated account.");
    }
  });
  if (!uniquePaths.length && !uniqueAuthEmails.length && !uniqueStoragePaths.length) {
    return { registeredPaths: [], registeredAuthEmails: [], registeredStoragePaths: [] };
  }

  const ledgerRef = db.collection("ftRunLedgers").doc(manifest.baselineId);
  await db.runTransaction(async (transaction) => {
    const ledgerSnapshot = await transaction.get(ledgerRef);
    const ledgerEntry = manifest.documents.find((entry) => entry.path === manifest.ledgerPath);
    if (!ledgerEntry || !ledgerSnapshot.exists) {
      throw new Error("The controlled FT run ledger is missing.");
    }
    assertOwnedDocument(ledgerEntry, ledgerSnapshot);
    validateLedgerData(ledgerSnapshot.data(), manifest);
    const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (uniquePaths.length) {
      update.generatedFirestorePaths = admin.firestore.FieldValue.arrayUnion(...uniquePaths);
    }
    if (uniqueAuthEmails.length) {
      update.generatedAuthEmails = admin.firestore.FieldValue.arrayUnion(...uniqueAuthEmails);
    }
    if (uniqueStoragePaths.length) {
      update.generatedStoragePaths = admin.firestore.FieldValue.arrayUnion(...uniqueStoragePaths);
    }
    transaction.update(ledgerRef, update);
  });
  return {
    registeredPaths: uniquePaths,
    registeredAuthEmails: uniqueAuthEmails,
    registeredStoragePaths: uniqueStoragePaths,
  };
}

async function registerExactGeneratedPaths(options) {
  const result = await registerExactGeneratedTargets(options);
  return result.registeredPaths;
}

function assertCompatibilityResult(data, id, manifest) {
  const expectedEmail = userEmail(manifest, "FT_CLIENT_QUIZ_NEW");
  if (
    data.resultId !== id ||
    clean(data.userId).toLowerCase() !== expectedEmail ||
    clean(data.userEmail).toLowerCase() !== expectedEmail
  ) {
    throw new Error("Refusing to register a compatibility result not owned by FT_CLIENT_QUIZ_NEW.");
  }
}

function assertCompatibilityRetakeResult(data, id, manifest) {
  const expectedEmail = userEmail(manifest, "FT_CLIENT_QUIZ_ELIGIBLE");
  const allowedAnimalIds = new Set(manifest.documents
    .filter((entry) => entry.collection === "animals" &&
      ["Ready", "Ready for Adoption"].includes(entry.data.status))
    .map((entry) => entry.id));
  const matches = Array.isArray(data.matches) ? data.matches : [];
  if (
    data.resultId !== id ||
    clean(data.userId).toLowerCase() !== expectedEmail ||
    clean(data.userEmail).toLowerCase() !== expectedEmail ||
    data.isLatest !== true ||
    Object.keys(data.preferences || {}).length !== 18 ||
    Object.values(data.preferences || {}).some((value) => value !== 3) ||
    data.filters?.preferredSpecies !== "Any" ||
    data.filters?.preferredSex !== "Any" ||
    data.filters?.needAllergyFriendly !== "no" ||
    data.filters?.acceptSpecialNeeds !== "yes" ||
    !matches.length ||
    matches.some((match) =>
      !allowedAnimalIds.has(match.animalId) ||
      !Number.isFinite(match.compatibilityScore) ||
      !Number.isFinite(match.compatibilityPercent) ||
      match.compatibilityScore < 0 || match.compatibilityScore > 1 ||
      match.compatibilityPercent < 0 || match.compatibilityPercent > 100)
  ) {
    throw new Error("Refusing to register a compatibility result not owned by IT-019.");
  }
}

function assertAdoption(data, manifest) {
  const expectedEmail = userEmail(manifest, "FT_CLIENT_ACTIVE");
  const ownerEmail = clean(data.account?.email || data.applicant?.email).toLowerCase();
  if (
    ownerEmail !== expectedEmail ||
    data.pet_id !== "FT_ANIMAL_READY_DOG" ||
    data.applicant?.occupation !== "Functionality Tester" ||
    data.other_information?.why_adopt !== "I can provide a safe and permanent home."
  ) {
    throw new Error("Refusing to register an adoption not owned by the FT-014 workflow.");
  }
}

function assertSurrenderRequest(data, id, manifest) {
  const expectedEmail = userEmail(manifest, "FT_CLIENT_ACTIVE");
  if (
    data.id !== id ||
    clean(data.account?.email).toLowerCase() !== expectedEmail ||
    clean(data.owner?.email).toLowerCase() !== expectedEmail ||
    data.owner?.city !== "Angeles City" ||
    data.owner?.barangay !== "Pampang" ||
    data.pet?.name !== "FT-018 Surrender Animal" ||
    data.surrenderReason !== "FT-018 deterministic surrender reason for formal functionality testing." ||
    data.agreement?.agreedToTerms !== true ||
    data.status !== "Pending"
  ) {
    throw new Error("Refusing to register a surrender request not owned by the FT-018 workflow.");
  }
}

function assertIntegrationSurrenderRequest(data, id, manifest) {
  const expectedEmail = userEmail(manifest, "FT_CLIENT_ACTIVE");
  if (
    data.id !== id ||
    clean(data.account?.email).toLowerCase() !== expectedEmail ||
    clean(data.owner?.email).toLowerCase() !== expectedEmail ||
    data.owner?.city !== "Angeles City" ||
    data.owner?.barangay !== "Pampang" ||
    data.pet?.name !== "IT-010 Surrender Animal" ||
    data.surrenderReason !== "I am relocating and cannot bring my dog to our new home." ||
    data.agreement?.agreedToTerms !== true ||
    data.status !== "Pending"
  ) {
    throw new Error("Refusing to register a surrender request not owned by IT-010.");
  }
}

function assertContactInquiry(data, manifest) {
  const expectedEmail = userEmail(manifest, "FT_CLIENT_ACTIVE");
  if (
    clean(data.email).toLowerCase() !== expectedEmail ||
    data.subject !== "FT-022 Deterministic Contact Inquiry" ||
    data.message !== "FT-022 deterministic contact inquiry submitted through the real public form." ||
    data.status !== "New" ||
    data.source !== "Contact Us Page"
  ) {
    throw new Error("Refusing to register a contact message not owned by the FT-022 workflow.");
  }
}

function assertNotifications(documents, primaryId, definition, manifest) {
  const recipients = new Set(
    definition.notificationRecipients.map((testId) => userEmail(manifest, testId)),
  );
  for (const document of documents) {
    const data = document.data() || {};
    if (
      data.referenceId !== primaryId ||
      data.metadata?.relatedResourceId !== primaryId ||
      (definition.notificationType && data.type !== definition.notificationType) ||
      !recipients.has(clean(data.userEmail).toLowerCase())
    ) {
      throw new Error("Refusing to register a notification outside the controlled FT mutation.");
    }
  }
}

function assertAuditLogs(documents, definition, manifest, primaryId = "") {
  const expectedEmail = userEmail(manifest, definition.actor || "FT_CLIENT_ACTIVE");
  for (const document of documents) {
    const data = document.data() || {};
    if (
      clean(data.performedBy).toLowerCase() !== expectedEmail ||
      data.details !== definition.auditDetails ||
      data.action !== definition.auditAction ||
      (definition.auditTargetMatchesPrimary && data.targetId !== primaryId)
    ) {
      throw new Error("Refusing to register an audit log outside the controlled FT mutation.");
    }
  }
}

function assertPasswordChangeAuditLogs(documents, definition, manifest) {
  const expectedEmail = userEmail(manifest, definition.actor);
  for (const document of documents) {
    const data = document.data() || {};
    if (
      clean(data.performedBy).toLowerCase() !== expectedEmail ||
      clean(data.targetId).toLowerCase() !== expectedEmail ||
      data.action !== definition.auditAction ||
      data.module !== "Account Settings" ||
      data.after?.passwordChanged !== true
    ) {
      throw new Error("Refusing to register an audit log outside the controlled FT password change.");
    }
  }
}

async function collectMutationPaths({ db, manifest, kind, primaryId = "" }) {
  const definition = MUTATIONS[kind];
  if (!definition) throw new Error(`Unsupported FT ledger mutation: ${kind || "(empty)"}.`);
  const paths = [];

  if (kind === "passwordChange") {
    const expectedEmail = userEmail(manifest, definition.actor);
    const candidateDocuments = await queryUntil({
      db,
      collection: "auditLogs",
      field: "performedBy",
      value: expectedEmail,
    });
    const auditDocuments = candidateDocuments.filter(
      (document) => document.data()?.action === definition.auditAction
    );
    if (!auditDocuments.length) {
      throw new Error("Timed out locating the generated password-change audit record.");
    }
    assertPasswordChangeAuditLogs(auditDocuments, definition, manifest);
    paths.push(...auditDocuments.map(documentPath));
  }

  if (definition.primaryCollection) {
    const id = clean(primaryId);
    validateGeneratedDocumentPath(`${definition.primaryCollection}/${id}`, manifest);
    const snapshot = await db.collection(definition.primaryCollection).doc(id).get();
    if (!snapshot.exists) throw new Error(`Generated ${definition.primaryCollection} record was not found.`);
    const data = snapshot.data() || {};
    if (kind === "compatibilityQuiz") assertCompatibilityResult(data, id, manifest);
    if (kind === "compatibilityQuizRetake") {
      assertCompatibilityRetakeResult(data, id, manifest);
    }
    if (kind === "adoptionApplication") assertAdoption(data, manifest);
    if (kind === "surrenderRequest") assertSurrenderRequest(data, id, manifest);
    if (kind === "integrationSurrenderRequest") {
      assertIntegrationSurrenderRequest(data, id, manifest);
    }
    if (kind === "contactInquiry") assertContactInquiry(data, manifest);
    paths.push(`${definition.primaryCollection}/${id}`);

    const notificationDocuments = await queryUntil({
      db,
      collection: "notifications",
      field: "referenceId",
      value: id,
      minimum: definition.notificationRecipients.length,
    });
    assertNotifications(notificationDocuments, id, definition, manifest);
    paths.push(...notificationDocuments.map(documentPath));
  }

  if (definition.auditDetails) {
    const auditDocuments = await queryUntil({
      db,
      collection: "auditLogs",
      field: "details",
      value: definition.auditDetails,
    });
    assertAuditLogs(auditDocuments, definition, manifest, primaryId);
    paths.push(...auditDocuments.map(documentPath));
  }

  return [...new Set(paths)].sort();
}

async function collectUserAccountTargets({ db, admin, manifest }) {
  const email = manifest.registrationAccount.email;
  const userSnapshot = await db.collection("users").doc(email).get();
  if (!userSnapshot.exists) throw new Error("The exact FT generated user document was not found.");
  const user = userSnapshot.data() || {};
  const expectedActor = userEmail(manifest, "FT_ADMIN_ACTIVE");
  if (
    clean(user.email).toLowerCase() !== email ||
    user.firstName !== "FT" ||
    !String(user.lastName || "").startsWith("Batch Six User") ||
    !["Staff", "Veterinarian"].includes(user.role) ||
    clean(user.createdBy).toLowerCase() !== expectedActor
  ) {
    throw new Error("Refusing to register a user document outside the controlled FT-030 identity.");
  }
  const auditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: email,
    predicate: (data) => ["user.created", "user.updated"].includes(data.action) &&
      clean(data.performedBy).toLowerCase() === expectedActor,
  });
  let authPresent = true;
  let authUid = "";
  try {
    const authUser = await admin.auth().getUserByEmail(email);
    authUid = authUser.uid;
  } catch (error) {
    if (error?.code === "auth/user-not-found") authPresent = false;
    else throw error;
  }
  return {
    paths: [manifest.registrationAccount.firestorePath, ...auditDocuments.map(documentPath)],
    authEmails: authPresent ? [email] : [],
    authPresent,
    authUid,
  };
}

async function inspectFtAnnouncementImage(input = {}) {
  const context = await getHostedContext();
  const { db, bucket, manifest } = context;
  const primaryId = clean(input.primaryId);
  if (primaryId !== "FT_ANNOUNCEMENT_DRAFT") {
    throw new Error("Storage inspection is restricted to FT_ANNOUNCEMENT_DRAFT.");
  }

  const announcementSnapshot = await db.collection("announcements").doc(primaryId).get();
  if (!announcementSnapshot.exists) {
    throw new Error("The controlled announcement fixture is missing.");
  }
  const announcement = announcementSnapshot.data() || {};
  const firestoreImagePath = clean(announcement.imagePath);
  const requestedPath = clean(input.storagePath);
  const storagePath = requestedPath || firestoreImagePath;

  if (!storagePath) {
    return {
      exists: false,
      storagePath: "",
      firestoreImagePath,
      firestoreImageUrl: clean(announcement.imageUrl),
      metadata: null,
    };
  }

  validateGeneratedStoragePath(storagePath, manifest);
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  let metadata = null;
  if (exists) {
    const [rawMetadata] = await file.getMetadata();
    metadata = {
      name: clean(rawMetadata.name),
      bucket: clean(rawMetadata.bucket),
      contentType: clean(rawMetadata.contentType),
      cacheControl: clean(rawMetadata.cacheControl),
      size: Number(rawMetadata.size || 0),
    };
  }

  return {
    exists,
    storagePath,
    firestoreImagePath,
    firestoreImageUrl: clean(announcement.imageUrl),
    metadata,
  };
}

async function collectAnnouncementImageTargets({ db, manifest, minimum = 1, ...input } = {}) {
  const inspection = await inspectFtAnnouncementImage(input);
  const expectedContentType = clean(input.expectedContentType) || "image/png";
  const expectedExtension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[expectedContentType];
  if (!expectedExtension) {
    throw new Error("Announcement image registration requires a supported image content type.");
  }
  if (!inspection.exists || inspection.firestoreImagePath !== inspection.storagePath) {
    throw new Error("The controlled announcement image is not synchronized with Storage.");
  }
  if (
    !new RegExp(`^announcements/FT_ANNOUNCEMENT_DRAFT/cover-\\d{13}\\.${expectedExtension}$`).test(inspection.storagePath) ||
    inspection.metadata?.name !== inspection.storagePath ||
    inspection.metadata?.contentType !== expectedContentType ||
    inspection.metadata?.cacheControl !== "private, max-age=1800" ||
    inspection.metadata?.size < 1
  ) {
    throw new Error("The controlled announcement image has unexpected Storage metadata.");
  }
  const auditMinimum = Number(minimum);
  if (![1, 2, 3, 4].includes(auditMinimum)) {
    throw new Error("Announcement image registration requires an audit minimum from 1 to 4.");
  }
  const actorEmail = userEmail(manifest, "FT_ADMIN_ACTIVE");
  const matchingAuditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: "FT_ANNOUNCEMENT_DRAFT",
    minimum: auditMinimum,
    predicate: (data) =>
      ["announcement.updated", "announcement.image_updated"].includes(data.action) &&
      data.status === "Success" &&
      clean(data.performedBy).toLowerCase() === actorEmail,
  });
  const auditDocuments = [...matchingAuditDocuments]
    .sort((left, right) => {
      const leftTime = left.data()?.timestamp?.toMillis?.() || 0;
      const rightTime = right.data()?.timestamp?.toMillis?.() || 0;
      return leftTime - rightTime;
    })
    .slice(-auditMinimum);
  return {
    paths: auditDocuments.map(documentPath),
    authEmails: [],
    storagePaths: [inspection.storagePath],
    storageObject: inspection,
  };
}

async function collectBatch10AnnouncementTargets({ db, admin, manifest, kind, primaryId, phase }) {
  const fixture = BATCH_10_FIXTURES[kind];
  const actorEmail = userEmail(manifest, MUTATIONS[kind].actor);
  const announcementRef = db.collection("announcements").doc(primaryId);
  const snapshot = await announcementRef.get();
  const mayBeDeleted = kind === "announcementDelete" && phase === "deleted";
  if (!snapshot.exists && !mayBeDeleted) {
    throw new Error("The controlled Batch 10 generated announcement was not found.");
  }
  if (snapshot.exists) {
    const announcement = snapshot.data() || {};
    const expectedCaption = phase === "edited" ? fixture.editedCaption : fixture.createdCaption;
    const expectedStatus = kind === "announcementDelete" ? "Published" : "Draft";
    const expectedVisibility = kind === "announcementDelete";
    if (
      announcement.title !== fixture.title ||
      announcement.caption !== expectedCaption ||
      announcement.status !== expectedStatus ||
      announcement.visibleToPublic !== expectedVisibility ||
      clean(announcement.createdBy).toLowerCase() !== actorEmail
    ) {
      throw new Error("Refusing to register an announcement outside the controlled Batch 10 workflow.");
    }
    await announcementRef.update({
      testData: true,
      testBaseline: manifest.baselineId,
      testId: primaryId,
      ledgerRegisteredAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  const createAudits = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "performedBy",
    value: actorEmail,
    predicate: (data) =>
      data.action === "announcement.created" &&
      data.module === "Announcements" &&
      data.status === "Success" &&
      data.targetName === fixture.title &&
      data.details === "POST /api/announcements completed with status 201.",
  });
  const paths = [`announcements/${primaryId}`, ...createAudits.map(documentPath)];

  if (phase === "edited") {
    const editAudits = await queryUntilMatching({
      db,
      collection: "auditLogs",
      field: "targetId",
      value: primaryId,
      predicate: (data) =>
        data.action === "announcement.updated" &&
        data.status === "Success" &&
        data.details === `PUT /api/announcements/${primaryId} completed with status 200.` &&
        clean(data.performedBy).toLowerCase() === actorEmail &&
        data.after?.caption === fixture.editedCaption,
    });
    paths.push(...editAudits.map(documentPath));
  }

  if (phase === "deleted") {
    const restrictedEmail = userEmail(manifest, MUTATIONS.announcementDelete.restrictedActor);
    const deleteAudits = await queryUntilMatching({
      db,
      collection: "auditLogs",
      field: "targetId",
      value: primaryId,
      minimum: 2,
      predicate: (data) => data.action === "announcement.deleted" && (
        (data.status === "Failed" &&
          data.details === `DELETE /api/announcements/${primaryId} completed with status 403.` &&
          clean(data.performedBy).toLowerCase() === restrictedEmail) ||
        (data.status === "Success" &&
          data.details === `DELETE /api/announcements/${primaryId} completed with status 200.` &&
          clean(data.performedBy).toLowerCase() === actorEmail)
      ),
    });
    if (deleteAudits.length !== 2) {
      throw new Error("The controlled Batch 10 deletion must have one rejected and one successful audit.");
    }
    paths.push(...deleteAudits.map(documentPath));
  }
  return { paths, authEmails: [] };
}

async function collectUserStatusTargets({ db, manifest, minimum = 2 }) {
  const definition = MUTATIONS.userStatus;
  const targetEmail = userEmail(manifest, definition.target);
  const actorEmail = userEmail(manifest, definition.actor);
  const auditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: targetEmail,
    minimum,
    predicate: (data) => ["user.deactivated", "user.activated"].includes(data.action) &&
      clean(data.performedBy).toLowerCase() === actorEmail,
  });
  return { paths: auditDocuments.map(documentPath), authEmails: [] };
}

async function collectSurrenderDecisionTargets({ db, manifest, primaryId }) {
  const expectedType = primaryId === "FT_SURRENDER_APPROVE_CANDIDATE"
    ? "surrender_approved"
    : primaryId === "FT_SURRENDER_REJECT_CANDIDATE"
      ? "surrender_rejected"
      : "";
  if (!expectedType) throw new Error("Unknown controlled FT surrender decision target.");
  const expectedEmail = userEmail(manifest, "FT_CLIENT_ACTIVE");
  const notifications = await queryUntilMatching({
    db,
    collection: "notifications",
    field: "referenceId",
    value: primaryId,
    predicate: (data) => data.type === expectedType &&
      clean(data.userEmail).toLowerCase() === expectedEmail,
  });
  const actorEmail = userEmail(manifest, MUTATIONS.surrenderDecision.actor);
  const expectedAction = primaryId === "FT_SURRENDER_APPROVE_CANDIDATE"
    ? "surrender.approved"
    : "surrender.rejected";
  const expectedDetails = `PATCH /api/surrenders/${primaryId}/status completed with status 200.`;
  const auditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    predicate: (data) => data.action === expectedAction &&
      data.details === expectedDetails &&
      clean(data.performedBy).toLowerCase() === actorEmail,
  });
  return {
    paths: [...notifications, ...auditDocuments].map(documentPath),
    authEmails: [],
  };
}

async function collectAdoptionDecisionTargets({ db, manifest, primaryId }) {
  const approved = primaryId === "FT_ADOPTION_APPROVE_CANDIDATE";
  const rejected = primaryId === "FT_ADOPTION_REJECT_CANDIDATE";
  if (!approved && !rejected) {
    throw new Error("Unknown controlled Batch 3 adoption decision target.");
  }

  const expectedEmail = userEmail(manifest, "FT_CLIENT_ACTIVE");
  const expectedType = approved ? "adoption_approved" : "adoption_rejected";
  const notificationDocuments = await queryUntilMatching({
    db,
    collection: "notifications",
    field: "referenceId",
    value: primaryId,
    predicate: (data) => data.type === expectedType &&
      clean(data.userEmail).toLowerCase() === expectedEmail,
  });

  const actorEmail = userEmail(manifest, MUTATIONS.adoptionDecision.actor);
  const routeAction = approved ? "approve" : "reject";
  const expectedAction = approved ? "adoption.approved" : "adoption.rejected";
  const expectedDetails = `PATCH /api/adoptions/${primaryId}/${routeAction} completed with status 200.`;
  const auditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    predicate: (data) => data.action === expectedAction &&
      data.status === "Success" &&
      data.details === expectedDetails &&
      clean(data.performedBy).toLowerCase() === actorEmail,
  });

  return {
    paths: [...notificationDocuments, ...auditDocuments].map(documentPath),
    authEmails: [],
  };
}

async function collectAdoptionFinalizationTargets({ db, manifest, primaryId }) {
  const definition = MUTATIONS.adoptionFinalization;
  if (primaryId !== definition.eligibleId) {
    throw new Error("Unknown controlled Batch 3 adoption finalization target.");
  }

  const recipientEmail = userEmail(manifest, "FT_CLIENT_ACTIVE");
  const notificationDocuments = await queryUntilMatching({
    db,
    collection: "notifications",
    field: "referenceId",
    value: primaryId,
    predicate: (data) => data.type === "adoption_finalized" &&
      clean(data.userEmail).toLowerCase() === recipientEmail,
  });
  if (notificationDocuments.length !== 1) {
    throw new Error("Adoption finalization must create exactly one client notification.");
  }

  const actorEmail = userEmail(manifest, definition.actor);
  const eligibleDetails = `PATCH /api/adoptions/${primaryId}/finalize completed with status`;
  const eligibleAudits = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    minimum: 1,
    predicate: (data) => data.action === "adoption.finalized" &&
      String(data.details || "").startsWith(eligibleDetails) &&
      clean(data.performedBy).toLowerCase() === actorEmail,
  });
  const successAudits = eligibleAudits.filter((document) => document.data()?.status === "Success");
  if (successAudits.length !== 1) {
    throw new Error("Adoption finalization must record exactly one successful audit.");
  }

  const blockedDetails = `PATCH /api/adoptions/${definition.blockedId}/finalize completed with status 400.`;
  const blockedAudits = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: definition.blockedId,
    predicate: (data) => data.action === "adoption.finalized" &&
      data.status === "Failed" &&
      data.details === blockedDetails &&
      clean(data.performedBy).toLowerCase() === actorEmail,
  });

  return {
    paths: [
      ...notificationDocuments,
      ...eligibleAudits,
      ...blockedAudits,
    ].map(documentPath),
    authEmails: [],
  };
}

async function collectIntakeDraftTargets({ db, manifest, primaryId, minimum }) {
  const intakePath = `intakeRecords/${primaryId}`;
  validateGeneratedDocumentPath(intakePath, manifest);
  const intakeSnapshot = await db.collection("intakeRecords").doc(primaryId).get();
  const intake = intakeSnapshot.data() || {};
  if (
    !intakeSnapshot.exists ||
    intake.status !== "Draft" ||
    intake.source !== "Rescue" ||
    !clean(intake.identifyingDescription).includes("FT-044") ||
    !clean(intake.intakeNotes).includes("FT-044")
  ) {
    throw new Error("Refusing to register a draft outside the controlled FT-044 workflow.");
  }

  const actorEmail = userEmail(manifest, "FT_ADMIN_ACTIVE");
  const auditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    minimum,
    predicate: (data) => ["intake.created", "intake.updated"].includes(data.action) &&
      clean(data.performedBy).toLowerCase() === actorEmail,
  });
  const actions = new Set(auditDocuments.map((document) => document.data()?.action));
  if (!actions.has("intake.created") || (minimum === 2 && !actions.has("intake.updated"))) {
    throw new Error("The controlled FT-044 draft audits are incomplete.");
  }
  return {
    paths: [intakePath, ...auditDocuments.map(documentPath)],
    authEmails: [],
  };
}

async function collectIntakeRejectionTargets({ db, manifest, primaryId }) {
  const intakeSnapshot = await db.collection("intakeRecords").doc(primaryId).get();
  const intake = intakeSnapshot.data() || {};
  if (
    !intakeSnapshot.exists ||
    intake.status !== "Rejected" ||
    !clean(intake.rejectedReason).includes("FT-045")
  ) {
    throw new Error("The controlled FT-045 intake was not rejected with its test reason.");
  }

  const actorEmail = userEmail(manifest, "FT_ADMIN_ACTIVE");
  const auditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    predicate: (data) => data.action === "intake.rejected" &&
      data.after?.status === "Rejected" &&
      clean(data.after?.reason).includes("FT-045") &&
      clean(data.performedBy).toLowerCase() === actorEmail,
  });
  return { paths: auditDocuments.map(documentPath), authEmails: [] };
}

async function collectAnnouncementPublishTargets({ db, manifest, primaryId }) {
  const definition = MUTATIONS.announcementPublish;
  if (primaryId !== definition.announcementId) {
    throw new Error("Unknown controlled Batch 3 announcement target.");
  }

  const disabledEmail = userEmail(manifest, definition.disabledRecipient);
  const disabledUser = await db.collection("users").doc(disabledEmail).get();
  if (
    !disabledUser.exists ||
    disabledUser.data()?.notificationSettings?.announcementsEvents !== false
  ) {
    throw new Error("The controlled notification-preference fixture was not disabled.");
  }

  const expectedRecipients = new Set(
    manifest.users
      .filter((user) => user.firestore.data.role === "Public" && user.email !== disabledEmail)
      .map((user) => user.email),
  );
  const notificationDocuments = await queryUntilMatching({
    db,
    collection: "notifications",
    field: "referenceId",
    value: primaryId,
    minimum: expectedRecipients.size,
    predicate: (data) => data.type === "event_announcement" &&
      expectedRecipients.has(clean(data.userEmail).toLowerCase()),
  });
  const actualRecipients = notificationDocuments.map(
    (document) => clean(document.data()?.userEmail).toLowerCase(),
  );
  if (
    notificationDocuments.length !== expectedRecipients.size ||
    new Set(actualRecipients).size !== expectedRecipients.size
  ) {
    throw new Error("Announcement publishing created missing or duplicate eligible notifications.");
  }

  const actorEmail = userEmail(manifest, definition.actor);
  const announcementAudits = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    predicate: (data) => data.action === "announcement.updated" &&
      data.status === "Success" &&
      data.details === `PUT /api/announcements/${primaryId} completed with status 200.` &&
      clean(data.performedBy).toLowerCase() === actorEmail,
  });
  const profileAudits = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: disabledEmail,
    predicate: (data) => data.action === "account.profile_updated" &&
      clean(data.performedBy).toLowerCase() === disabledEmail &&
      data.after?.notificationSettings?.announcementsEvents === false,
  });

  return {
    paths: [
      ...notificationDocuments,
      ...announcementAudits,
      ...profileAudits,
    ].map(documentPath),
    authEmails: [],
    notificationCount: notificationDocuments.length,
  };
}

async function collectContactReplyTargets({ db, manifest, primaryId }) {
  const definition = MUTATIONS.contactReply;
  if (primaryId !== definition.contactId) {
    throw new Error("Unknown controlled Batch 3 contact reply target.");
  }
  const recipientEmail = userEmail(manifest, definition.recipient);
  const notificationDocuments = await queryUntilMatching({
    db,
    collection: "notifications",
    field: "referenceId",
    value: primaryId,
    predicate: (data) => data.type === "contact_reply" &&
      clean(data.userEmail).toLowerCase() === recipientEmail,
  });
  if (notificationDocuments.length !== 1) {
    throw new Error("The controlled contact reply must create exactly one client notification.");
  }

  const actorEmail = userEmail(manifest, definition.actor);
  const auditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    predicate: (data) => data.action === "contact.replied" &&
      data.status === "Success" &&
      data.details === `POST /api/public/contact/${primaryId}/reply completed with status 200.` &&
      clean(data.performedBy).toLowerCase() === actorEmail,
  });

  return {
    paths: [...notificationDocuments, ...auditDocuments].map(documentPath),
    authEmails: [],
  };
}

async function collectIntakeFromSurrenderTargets({ db, manifest, primaryId }) {
  validateGeneratedDocumentPath(`intakeRecords/${primaryId}`, manifest);
  const intakeSnapshot = await db.collection("intakeRecords").doc(primaryId).get();
  if (!intakeSnapshot.exists) throw new Error("The generated surrender intake record was not found.");
  const intake = intakeSnapshot.data() || {};
  if (
    intake.surrenderRefId !== MUTATIONS.intakeFromSurrender.surrenderId ||
    intake.source !== "Approved Surrender"
  ) {
    throw new Error("Refusing to register an intake outside the controlled FT-037 surrender.");
  }
  const actorEmail = userEmail(manifest, MUTATIONS.intakeFromSurrender.actor);
  const auditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    predicate: (data) => ["intake.created", "intake.converted"].includes(data.action) &&
      clean(data.performedBy).toLowerCase() === actorEmail,
  });
  const paths = [`intakeRecords/${primaryId}`, ...auditDocuments.map(documentPath)];
  if (intake.animalProfileId) {
    const animalPath = `animals/${intake.animalProfileId}`;
    validateGeneratedDocumentPath(animalPath, manifest);
    const animalSnapshot = await db.collection("animals").doc(intake.animalProfileId).get();
    if (!animalSnapshot.exists || animalSnapshot.data()?.intakeId !== primaryId) {
      throw new Error("The generated animal profile is not linked to the controlled FT-037 intake.");
    }
    paths.push(animalPath);
  }
  return { paths, authEmails: [], animalProfileId: intake.animalProfileId || null };
}

async function collectIntakeConversionTargets({ db, manifest, primaryId }) {
  const actorEmail = userEmail(manifest, "FT_ADMIN_ACTIVE");
  const intakeSnapshot = await db.collection("intakeRecords").doc(primaryId).get();
  if (!intakeSnapshot.exists) throw new Error("The controlled intake conversion fixture is missing.");
  const intake = intakeSnapshot.data() || {};
  const animalProfileId = clean(intake.animalProfileId);
  if (intake.status !== "Converted" || !animalProfileId) {
    throw new Error("The controlled intake was not converted to an animal profile.");
  }

  const animalPath = `animals/${animalProfileId}`;
  validateGeneratedDocumentPath(animalPath, manifest);
  const animalSnapshot = await db.collection("animals").doc(animalProfileId).get();
  const animal = animalSnapshot.data() || {};
  if (
    !animalSnapshot.exists ||
    animal.intakeId !== primaryId ||
    animal.status !== "Profiling" ||
    animal.species !== intake.species ||
    animal.identifyingDescription !== intake.identifyingDescription
  ) {
    throw new Error("Refusing to register an animal outside the controlled IT-005 conversion.");
  }

  const auditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    predicate: (data) => data.action === "intake.converted" &&
      clean(data.performedBy).toLowerCase() === actorEmail &&
      data.after?.animalProfileId === animalProfileId,
  });

  return {
    paths: [animalPath, ...auditDocuments.map(documentPath)],
    authEmails: [],
    animalProfileId,
  };
}

async function collectBatch8AnimalTargets({ db, manifest, kind, primaryId, medicalRecordId }) {
  const definition = MUTATIONS[kind];
  const actorEmail = userEmail(manifest, definition.actor);
  const animalSnapshot = await db.collection("animals").doc(primaryId).get();
  if (!animalSnapshot.exists) throw new Error("The controlled Batch 8 animal fixture is missing.");
  const animal = animalSnapshot.data() || {};

  if (kind === "animalBasicEdit" && animal.notes !== "Batch 8 FT profile edit") {
    throw new Error("The controlled animal profile edit was not persisted.");
  }
  if (kind === "animalQuarantine" && animal.status !== "Quarantine") {
    throw new Error("The controlled animal was not placed in quarantine.");
  }
  if (kind === "animalBehavioral" && animal.behavioralNotes !== "Batch 8 FT behavioral assessment") {
    throw new Error("The controlled behavioral assessment was not persisted.");
  }
  if (kind === "animalArchive" && animal.status !== "Archived") {
    throw new Error("The controlled animal was not archived.");
  }
  if (["animalMedical", "animalClearance"].includes(kind)) {
    const record = (animal.medicalRecords || []).find(({ id }) => id === medicalRecordId);
    const expectedType = kind === "animalClearance" ? "Quarantine Clearance" : "Checkup";
    if (!record || record.type !== expectedType ||
      (kind === "animalClearance" && record.clearance !== "Cleared")) {
      throw new Error("The controlled Batch 8 medical effect was not persisted.");
    }
  }

  const auditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    predicate: (data) => data.action === definition.auditAction &&
      clean(data.performedBy).toLowerCase() === actorEmail &&
      (!medicalRecordId || data.after?.medicalRecordId === medicalRecordId),
  });
  return { paths: auditDocuments.map(documentPath), authEmails: [] };
}

async function collectAnimalPhotoTargets({ db, bucket, manifest, primaryId }) {
  const animalSnapshot = await db.collection("animals").doc(primaryId).get();
  if (!animalSnapshot.exists) throw new Error("The controlled Batch 8 photo fixture is missing.");
  const photoPath = clean(animalSnapshot.data()?.photoPath);
  validateGeneratedStoragePath(photoPath, manifest);
  const file = bucket.file(photoPath);
  const [exists] = await file.exists();
  if (!exists) throw new Error("The controlled animal photo was not synchronized with Storage.");
  const [metadata] = await file.getMetadata();
  if (clean(metadata.name) !== photoPath || metadata.contentType !== "image/png" || Number(metadata.size || 0) < 1) {
    throw new Error("The controlled animal photo has unexpected Storage metadata.");
  }
  return {
    paths: [],
    authEmails: [],
    storagePaths: [photoPath],
    storageObject: { storagePath: photoPath, contentType: metadata.contentType, size: Number(metadata.size) },
  };
}

async function collectAnimalReadinessTargets({ db, manifest, primaryId }) {
  const actorEmail = userEmail(manifest, "FT_ADMIN_ACTIVE");
  const animalSnapshot = await db.collection("animals").doc(primaryId).get();
  const animal = animalSnapshot.data() || {};
  if (
    !animalSnapshot.exists ||
    animal.status !== "Ready" ||
    animal.currentStage !== "adoption" ||
    animal.visibleToPublic !== true
  ) {
    throw new Error("Refusing to register readiness effects for an animal not transitioned by Batch 1.");
  }
  const auditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    predicate: (data) => data.action === "animal.marked_ready" &&
      clean(data.performedBy).toLowerCase() === actorEmail &&
      data.after?.status === "Ready" &&
      data.after?.visibleToPublic === true,
  });
  return { paths: auditDocuments.map(documentPath), authEmails: [] };
}

async function collectMedicalInventoryTargets({
  db,
  manifest,
  primaryId,
  inventoryItemId,
  medicalRecordId,
  quantity,
}) {
  const actorEmail = userEmail(manifest, "FT_ADMIN_ACTIVE");
  const [animalSnapshot, inventorySnapshot] = await Promise.all([
    db.collection("animals").doc(primaryId).get(),
    db.collection("inventoryItems").doc(inventoryItemId).get(),
  ]);
  if (!animalSnapshot.exists || !inventorySnapshot.exists) {
    throw new Error("The controlled medical or inventory fixture is missing.");
  }
  const medicalRecord = (animalSnapshot.data()?.medicalRecords || []).find(
    (record) => record.id === medicalRecordId,
  );
  if (
    !medicalRecord ||
    medicalRecord.inventoryItemId !== inventoryItemId ||
    Number(medicalRecord.quantityUsed) !== quantity
  ) {
    throw new Error("Refusing to register a medical record outside the controlled Batch 1 treatment.");
  }

  const transactionDocuments = await queryInventoryTransactionsUntil({
    db,
    itemId: inventoryItemId,
    field: "medicalRecordId",
    value: medicalRecordId,
  });
  for (const document of transactionDocuments) {
    const data = document.data() || {};
    if (
      data.type !== "out" ||
      Number(data.qty) !== quantity ||
      data.animalId !== primaryId
    ) {
      throw new Error("Refusing to register an unrelated medical inventory transaction.");
    }
  }

  const animalAudits = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    predicate: (data) => data.action === "animal.medical_record_added" &&
      clean(data.performedBy).toLowerCase() === actorEmail &&
      data.after?.medicalRecordId === medicalRecordId,
  });
  const inventoryAudits = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: inventoryItemId,
    predicate: (data) => data.action === "inventory.medical_stock_used" &&
      clean(data.performedBy).toLowerCase() === actorEmail &&
      data.after?.medicalRecordId === medicalRecordId &&
      data.after?.animalId === primaryId,
  });

  const transactionPaths = transactionDocuments.map(
    (document) => `inventoryItems/${inventoryItemId}/transactions/${document.id}`,
  );
  transactionPaths.forEach((item) => validateGeneratedDocumentPath(item, manifest));
  return {
    paths: [
      ...transactionPaths,
      ...animalAudits.map(documentPath),
      ...inventoryAudits.map(documentPath),
    ],
    authEmails: [],
  };
}

async function collectInventoryMovementTargets({
  db,
  manifest,
  primaryId,
  movementType,
  transactionId,
  quantity,
  responseStatus,
}) {
  const actorEmail = userEmail(manifest, "FT_ADMIN_ACTIVE");
  const paths = [];
  if (responseStatus === 201) {
    const transactionPath = `inventoryItems/${primaryId}/transactions/${transactionId}`;
    validateGeneratedDocumentPath(transactionPath, manifest);
    const transactionSnapshot = await db
      .collection("inventoryItems")
      .doc(primaryId)
      .collection("transactions")
      .doc(transactionId)
      .get();
    const transaction = transactionSnapshot.data() || {};
    if (
      !transactionSnapshot.exists ||
      transaction.type !== movementType ||
      Number(transaction.qty) !== quantity ||
      clean(transaction.staffEmail).toLowerCase() !== actorEmail
    ) {
      throw new Error("Refusing to register an unrelated inventory movement transaction.");
    }
    paths.push(transactionPath);
  }

  const expectedAction = `inventory.stock_${movementType}`;
  const expectedStatus = responseStatus < 400 ? "Success" : "Failed";
  const expectedDetails = `POST /api/inventory/${primaryId}/stock-${movementType} completed with status ${responseStatus}.`;
  const auditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    predicate: (data) => data.action === expectedAction &&
      data.status === expectedStatus &&
      data.details === expectedDetails &&
      clean(data.performedBy).toLowerCase() === actorEmail,
  });
  paths.push(...auditDocuments.map(documentPath));
  return { paths, authEmails: [] };
}

async function collectBatch9InventoryItemTargets({ db, manifest, primaryId, minimum }) {
  const actorEmail = userEmail(manifest, "FT_ADMIN_ACTIVE");
  const itemSnapshot = await db.collection("inventoryItems").doc(primaryId).get();
  const item = itemSnapshot.data() || {};
  if (
    !itemSnapshot.exists ||
    item.id !== primaryId ||
    item.name !== (minimum === 1 ? "Batch 9 FT Generated Item" : "Batch 9 FT Generated Item Edited") ||
    item.category !== "Consumable" ||
    Number(item.currentStock) !== (minimum === 1 ? 7 : 8) ||
    clean(item.createdByEmail).toLowerCase() !== actorEmail ||
    clean(item.updatedByEmail).toLowerCase() !== actorEmail
  ) {
    throw new Error("Refusing to register an unrelated generated inventory item.");
  }
  const auditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    minimum,
    predicate: (data) =>
      ["inventory.created", "inventory.updated"].includes(data.action) &&
      data.module === "Inventory" &&
      data.status === "Success" &&
      clean(data.performedBy).toLowerCase() === actorEmail &&
      data.details === `${data.action === "inventory.created" ? "POST /api/inventory" : `PUT /api/inventory/${primaryId}`} completed with status ${data.action === "inventory.created" ? 201 : 200}.`,
  });
  return {
    paths: [`inventoryItems/${primaryId}`, ...auditDocuments.map(documentPath)],
    authEmails: [],
  };
}

async function collectBatch9CompatibilityTargets({ db, manifest, kind, primaryId }) {
  const actorEmail = userEmail(manifest, "FT_ADMIN_ACTIVE");
  let action;
  if (kind === "compatibilitySettings") {
    const snapshot = await db.collection("quizSettings").doc("compatibilityQuiz").get();
    const settings = snapshot.data() || {};
    if (!snapshot.exists || settings.quizEnabled !== true || Number(settings.retakeCooldownDays) !== 31 || Number(settings.quizVersion) !== 1) {
      throw new Error("Refusing to register unrelated compatibility settings changes.");
    }
    action = "compatibility.settings_updated";
  } else if (kind === "compatibilityRetakeOverride") {
    const email = userEmail(manifest, primaryId);
    const snapshot = await db.collection("users").doc(email).get();
    const override = snapshot.data()?.quizRetakeOverrideAt?.toDate?.();
    if (!snapshot.exists || !override || Math.abs(Date.now() - override.getTime()) > 60000) {
      throw new Error("Refusing to register an unrelated compatibility retake override.");
    }
    action = "compatibility.immediate_retake_allowed";
    primaryId = email;
  } else {
    const snapshot = await db.collection("quizQuestionConfigs").doc("compatibilityQuiz").get();
    const config = snapshot.data() || {};
    const questions = Array.isArray(config.questions) ? config.questions : [];
    const question = questions.find((item) => item.id === primaryId);
    if (!snapshot.exists || Number(config.version) !== 2 || !question) {
      throw new Error("Refusing to register unrelated compatibility question changes.");
    }
    if (kind === "compatibilityQuestionCreate" && (
      question.active !== false ||
      question.label !== "Batch 9 FT Question Edited" ||
      question.text !== "Which controlled Batch 9 preference should be recorded?"
    )) {
      throw new Error("The generated Batch 9 compatibility question does not match the controlled draft.");
    }
    if (kind === "compatibilityQuestionStatusOrder" && (question.active !== false || Number(question.order) !== 2)) {
      throw new Error("The controlled compatibility question status/order change was not persisted.");
    }
    if (kind === "compatibilityQuestionPublish" && (
      question.active !== true ||
      question.label !== "Batch 9 Published Exercise Capacity" ||
      question.text !== "How much Batch 9 exercise can you provide each day?"
    )) {
      throw new Error("The controlled compatibility question publication was not persisted.");
    }
    action = "compatibility.questions_updated";
    primaryId = "compatibilityQuiz";
  }
  const auditDocuments = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    predicate: (data) =>
      data.action === action &&
      data.status === "Success" &&
      clean(data.performedBy).toLowerCase() === actorEmail,
  });
  return { paths: auditDocuments.map(documentPath), authEmails: [] };
}

async function collectFinalBatchTargets({ db, manifest, kind, primaryId, phase, referenceId, startedAt }) {
  const definition = MUTATIONS[kind];
  const actorEmail = userEmail(manifest, definition.actor);

  if (kind === "animalRestore") {
    const animal = await db.collection("animals").doc(primaryId).get();
    if (!animal.exists || animal.data()?.status !== "Ready") {
      throw new Error("The controlled archived animal was not restored to Ready.");
    }
    const audits = await queryUntilMatching({
      db,
      collection: "auditLogs",
      field: "targetId",
      value: primaryId,
      timeoutMs: 15000,
      predicate: (data) => data.action === definition.auditAction &&
        data.module === "Archived Records" &&
        data.before?.status === "Archived" &&
        data.after?.status === "Ready" &&
        clean(data.performedBy).toLowerCase() === actorEmail,
    });
    return { paths: audits.map(documentPath), authEmails: [] };
  }

  const account = manifest.users.find((user) => user.testId === FINAL_BATCH_FIXTURES.managementAccount);
  if (!account) throw new Error("The controlled mutable management account is missing.");
  const accountEmail = account.email;

  if (kind === "managementProfile") {
    const expectedBefore = phase === "updated"
      ? account.firestore.data.fullName
      : FINAL_BATCH_FIXTURES.updatedProfileName;
    const expectedAfter = phase === "updated"
      ? FINAL_BATCH_FIXTURES.updatedProfileName
      : account.firestore.data.fullName;
    const audits = await queryUntilMatching({
      db,
      collection: "auditLogs",
      field: "targetId",
      value: accountEmail,
      timeoutMs: 15000,
      predicate: (data) => data.action === definition.auditAction &&
        data.module === "Account Settings" &&
        data.before?.fullName === expectedBefore &&
        data.after?.fullName === expectedAfter &&
        clean(data.performedBy).toLowerCase() === actorEmail,
    });
    return { paths: audits.map(documentPath), authEmails: [] };
  }

  if (kind === "managementPassword") {
    const audits = await queryUntilMatching({
      db,
      collection: "auditLogs",
      field: "targetId",
      value: accountEmail,
      minimum: 1,
      timeoutMs: 15000,
      predicate: (data) => data.action === definition.auditAction &&
        data.module === "Account Settings" &&
        data.after?.passwordChanged === true &&
        (data.timestamp?.toMillis?.() || 0) >= startedAt &&
        clean(data.performedBy).toLowerCase() === actorEmail,
    });
    if (audits.length !== 1) {
      throw new Error(`Expected exactly 1 current management password audit record; found ${audits.length}.`);
    }
    return { paths: audits.map(documentPath), authEmails: [] };
  }

  const notification = await db.collection("notifications").doc(primaryId).get();
  const notificationData = notification.data() || {};
  if (!notification.exists || notificationData.referenceId !== referenceId ||
    notificationData.category !== "management" ||
    notificationData.type !== FINAL_BATCH_FIXTURES.managementNotificationType ||
    notificationData.metadata?.resourceType !== "contact_message" ||
    notificationData.metadata?.relatedResourceId !== referenceId ||
    clean(notificationData.userEmail).toLowerCase() !== accountEmail || notificationData.read !== true) {
    throw new Error("The controlled management notification was not marked read.");
  }
  const audits = await queryUntilMatching({
    db,
    collection: "auditLogs",
    field: "targetId",
    value: primaryId,
    timeoutMs: 15000,
    predicate: (data) => data.action === definition.auditAction &&
      data.module === "Notifications" &&
      data.status === "Success" &&
      data.details === `PATCH /api/notifications/${primaryId}/read completed with status 200.` &&
      clean(data.performedBy).toLowerCase() === actorEmail,
  });
  return { paths: audits.map(documentPath), authEmails: [] };
}

async function createFtManagementNotificationFixture() {
  const context = await getHostedContext();
  const { admin, db, manifest } = context;
  const relatedId = FINAL_BATCH_FIXTURES.managementNotificationRelatedId;
  const relatedSnapshot = await db.collection("contactMessages").doc(relatedId).get();
  if (!relatedSnapshot.exists || relatedSnapshot.data()?.testId !== relatedId) {
    throw new Error("The controlled FT-083 related contact fixture is missing.");
  }

  const recipient = userEmail(manifest, FINAL_BATCH_FIXTURES.managementAccount);
  if (!recipient) throw new Error("The controlled FT-083 management recipient is missing.");
  const notificationRef = db.collection("notifications").doc();
  const notificationPath = `notifications/${notificationRef.id}`;
  const registered = await registerExactGeneratedTargets({
    ...context,
    paths: [notificationPath],
  });
  await notificationRef.set({
    testData: true,
    testBaseline: manifest.baselineId,
    testId: notificationRef.id,
    userEmail: recipient,
    category: "management",
    type: FINAL_BATCH_FIXTURES.managementNotificationType,
    title: "New contact inquiry received",
    message: "FT Client Active sent an inquiry about FT Replied Inquiry.",
    link: "",
    referenceId: relatedId,
    metadata: {
      resourceType: "contact_message",
      relatedResourceId: relatedId,
    },
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {
    notificationId: notificationRef.id,
    relatedId,
    registeredPaths: registered.registeredPaths,
  };
}

async function registerCypressMutation(input = {}) {
  const context = await getHostedContext();
  const kind = clean(input.kind);
  const primaryId = clean(input.primaryId);
  let targets;
  if (kind === "userAccount") targets = await collectUserAccountTargets(context);
  else if (kind === "announcementImage") {
    targets = await collectAnnouncementImageTargets({ ...context, ...input });
  }
  else if (kind === "compatibilityQuizRetake") {
    const validated = validateBatch5MutationInput(input);
    const paths = await collectMutationPaths({
      db: context.db,
      manifest: context.manifest,
      ...validated,
    });
    targets = { paths, authEmails: [] };
  }
  else if (kind === "userStatus") {
    const minimum = input.minimum === undefined ? 2 : Number(input.minimum);
    if (![1, 2].includes(minimum)) {
      throw new Error("The controlled userStatus audit minimum must be 1 or 2.");
    }
    targets = await collectUserStatusTargets({ ...context, minimum });
  }
  else if (kind === "surrenderDecision") {
    targets = await collectSurrenderDecisionTargets({ ...context, primaryId });
  } else if (kind === "intakeFromSurrender") {
    targets = await collectIntakeFromSurrenderTargets({ ...context, primaryId });
  } else if ([
    "adoptionDecision",
    "adoptionFinalization",
    "announcementPublish",
    "contactReply",
  ].includes(kind)) {
    const validated = validateBatch3MutationInput(input);
    if (kind === "adoptionDecision") {
      targets = await collectAdoptionDecisionTargets({ ...context, ...validated });
    } else if (kind === "adoptionFinalization") {
      targets = await collectAdoptionFinalizationTargets({ ...context, ...validated });
    } else if (kind === "announcementPublish") {
      targets = await collectAnnouncementPublishTargets({ ...context, ...validated });
    } else {
      targets = await collectContactReplyTargets({ ...context, ...validated });
    }
  } else if ([
    "intakeConversion",
    "animalReadiness",
    "medicalInventory",
    "inventoryMovement",
  ].includes(kind)) {
    const validated = validateBatch1MutationInput(input);
    if (kind === "intakeConversion") {
      targets = await collectIntakeConversionTargets({ ...context, ...validated });
    } else if (kind === "animalReadiness") {
      targets = await collectAnimalReadinessTargets({ ...context, ...validated });
    } else if (kind === "medicalInventory") {
      targets = await collectMedicalInventoryTargets({ ...context, ...validated });
    } else {
      targets = await collectInventoryMovementTargets({ ...context, ...validated });
    }
  }
  else if (["intakeDraft", "intakeRejection"].includes(kind)) {
    const validated = validateBatch7MutationInput(input);
    if (kind === "intakeDraft") {
      targets = await collectIntakeDraftTargets({ ...context, ...validated });
    } else {
      targets = await collectIntakeRejectionTargets({ ...context, ...validated });
    }
  }
  else if (Object.prototype.hasOwnProperty.call(BATCH_8_FIXTURES, kind)) {
    const validated = validateBatch8MutationInput(input);
    if (kind === "animalPhoto") {
      targets = await collectAnimalPhotoTargets({ ...context, ...validated });
    } else {
      targets = await collectBatch8AnimalTargets({ ...context, ...validated });
    }
  }
  else if ([
    "inventoryItem",
    "compatibilitySettings",
    "compatibilityRetakeOverride",
    "compatibilityQuestionCreate",
    "compatibilityQuestionStatusOrder",
    "compatibilityQuestionPublish",
  ].includes(kind)) {
    const validated = validateBatch9MutationInput(input);
    if (kind === "inventoryItem") {
      targets = await collectBatch9InventoryItemTargets({ ...context, ...validated });
    } else {
      targets = await collectBatch9CompatibilityTargets({ ...context, ...validated });
    }
  }
  else if (["announcementCreateEdit", "announcementDelete"].includes(kind)) {
    const validated = validateBatch10MutationInput(input);
    targets = await collectBatch10AnnouncementTargets({ ...context, ...validated });
  }
  else if ([
    "animalRestore",
    "managementProfile",
    "managementPassword",
    "managementNotificationRead",
  ].includes(kind)) {
    const validated = validateFinalBatchMutationInput(input);
    targets = await collectFinalBatchTargets({ ...context, ...validated });
  }

  if (targets) {
    const registered = await registerExactGeneratedTargets({
      ...context,
      paths: targets.paths,
      authEmails: targets.authEmails,
      storagePaths: targets.storagePaths,
    });
    return {
      ...registered,
      authPresent: targets.authPresent,
      authUid: targets.authUid || null,
      animalProfileId: targets.animalProfileId || null,
      notificationCount: targets.notificationCount,
      storageObject: targets.storageObject || null,
    };
  }
  const paths = await collectMutationPaths({
    db: context.db,
    manifest: context.manifest,
    kind,
    primaryId,
  });
  const registeredPaths = await registerExactGeneratedPaths({ ...context, paths });
  return { registeredPaths };
}

async function recoverBatch3GeneratedRecords() {
  const context = await getHostedContext();
  const { db, manifest } = context;
  const registered = [];
  const baselinePaths = new Set(manifest.documents.map((entry) => entry.path));

  const quizEmail = userEmail(manifest, "FT_CLIENT_QUIZ_NEW");
  const quizSnapshot = await db.collection("compatibilityResults").where("userId", "==", quizEmail).get();
  for (const document of quizSnapshot.docs) {
    if (baselinePaths.has(documentPath(document))) continue;
    assertCompatibilityResult(document.data() || {}, document.id, manifest);
    registered.push(...(await collectMutationPaths({
      db,
      manifest,
      kind: "compatibilityQuiz",
      primaryId: document.id,
    })));
  }

  const adoptionEmail = userEmail(manifest, "FT_CLIENT_ACTIVE");
  const adoptionSnapshot = await db.collection("adoptions").where("account.email", "==", adoptionEmail).get();
  for (const document of adoptionSnapshot.docs) {
    if (baselinePaths.has(documentPath(document))) continue;
    try {
      assertAdoption(document.data() || {}, manifest);
    } catch (_error) {
      continue;
    }
    registered.push(...(await collectMutationPaths({
      db,
      manifest,
      kind: "adoptionApplication",
      primaryId: document.id,
    })));
  }

  for (const kind of ["adoptionPickup"]) {
    registered.push(...(await collectMutationPaths({ db, manifest, kind })));
  }

  const registeredPaths = await registerExactGeneratedPaths({
    ...context,
    paths: registered,
  });
  return { registeredPaths };
}

async function recoverBatch10FailedAnnouncementDelete() {
  const context = await getHostedContext();
  const { db, manifest } = context;
  const staffEmail = userEmail(manifest, "FT_STAFF_ACTIVE");
  const snapshot = await db.collection("auditLogs").where("performedBy", "==", staffEmail).get();
  const cutoff = Date.now() - 30 * 60 * 1000;
  const matches = snapshot.docs.filter((document) => {
    const data = document.data() || {};
    const targetId = clean(data.targetId);
    const timestamp = data.timestamp?.toMillis?.() || 0;
    return timestamp >= cutoff &&
      /^[A-Za-z0-9]{20}$/.test(targetId) &&
      data.action === "announcement.deleted" &&
      data.module === "Announcements" &&
      data.status === "Failed" &&
      data.targetName === targetId &&
      data.details === `DELETE /api/announcements/${targetId} completed with status 403.`;
  });
  if (matches.length > 1) {
    throw new Error("Refusing Batch 10 recovery: multiple recent failed announcement-delete audits matched.");
  }
  if (!matches.length) return { registeredPaths: [] };
  return registerExactGeneratedTargets({
    ...context,
    paths: matches.map(documentPath),
  });
}

async function recoverFinalBatchAccountAudits() {
  const context = await getHostedContext();
  const { db, manifest } = context;
  const accountEmail = userEmail(manifest, FINAL_BATCH_FIXTURES.managementAccount);
  const snapshot = await db.collection("auditLogs").where("performedBy", "==", accountEmail).get();
  const allowedNames = new Set([
    manifest.users.find((user) => user.testId === FINAL_BATCH_FIXTURES.managementAccount)?.firestore?.data?.fullName,
    FINAL_BATCH_FIXTURES.updatedProfileName,
  ]);
  const matches = snapshot.docs.filter((document) => {
    const data = document.data() || {};
    if (clean(data.targetId).toLowerCase() !== accountEmail || data.module !== "Account Settings") return false;
    if (data.action === MUTATIONS.managementPassword.auditAction) {
      return data.after?.passwordChanged === true;
    }
    if (data.action === MUTATIONS.managementProfile.auditAction) {
      return allowedNames.has(data.before?.fullName) && allowedNames.has(data.after?.fullName);
    }
    return false;
  });
  return registerExactGeneratedTargets({
    ...context,
    paths: matches.map(documentPath),
  });
}

module.exports = {
  MUTATIONS,
  validateBatch1MutationInput,
  validateBatch3MutationInput,
  validateBatch5MutationInput,
  validateBatch7MutationInput,
  validateBatch8MutationInput,
  validateBatch9MutationInput,
  validateBatch10MutationInput,
  validateFinalBatchMutationInput,
  collectMutationPaths,
  registerExactGeneratedPaths,
  registerExactGeneratedTargets,
  registerCypressMutation,
  createFtManagementNotificationFixture,
  inspectFtAnnouncementImage,
  recoverBatch3GeneratedRecords,
  recoverBatch10FailedAnnouncementDelete,
  recoverFinalBatchAccountAudits,
};
