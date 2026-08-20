const bcrypt = require("bcryptjs");

function operationError(message, code = "FT_BASELINE_OPERATION_ABORT") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function mutationError(category, testId, cause) {
  const error = operationError(
    `${category} failed for ${testId}.`,
    "FT_BASELINE_MUTATION_FAILED"
  );
  error.operationCategory = category;
  error.testId = testId;
  error.cause = cause;
  return error;
}

function ownershipError(category, testId, message) {
  const error = operationError(message);
  error.operationCategory = category;
  error.testId = testId;
  return error;
}

function isMissingAuthUser(error) {
  return ["auth/user-not-found", "auth/invalid-uid"].includes(error?.code);
}

function assertOwnedDocument(entry, snapshot) {
  if (!snapshot.exists) return;
  const data = snapshot.data() || {};
  if (data.testData !== true || data.testId !== entry.data.testId || data.testBaseline !== entry.data.testBaseline) {
    throw ownershipError(
      "Firestore ownership preflight",
      entry.data.testId,
      `Refusing to overwrite unowned ${entry.collection} record ${entry.data.testId}.`
    );
  }
}

function parseDocumentPath(path) {
  const parts = String(path || "").split("/");
  if (![2, 4].includes(parts.length) || parts.some((part) => !part || part === "." || part === "..")) {
    throw operationError(`Unknown delete target: ${path || "(empty)"}.`);
  }
  return { parts, collection: parts[0], id: parts[1] };
}

function validateGeneratedDocumentPath(path, manifest) {
  const parsed = parseDocumentPath(path);
  const policy = manifest.generatedFirestorePolicy;
  if (path === manifest.registrationAccount.firestorePath) return parsed;
  if (parsed.parts.length === 4) {
    const [collection, parentId, subcollection, documentId] = parsed.parts;
    const parentOwned = manifest.documents.some(
      (entry) => entry.collection === collection && entry.id === parentId
    );
    if (
      collection !== "inventoryItems" ||
      subcollection !== "transactions" ||
      !parentOwned ||
      !policy.inventoryTransactionIdPattern.test(documentId)
    ) {
      throw operationError(`Unknown delete target: ${path}.`);
    }
    return parsed;
  }
  if (!policy.allowedCollections.includes(parsed.collection) || !policy.documentIdPattern.test(parsed.id)) {
    throw operationError(`Unknown delete target: ${path}.`);
  }
  return parsed;
}

function generatedDocumentReference(db, parsed) {
  if (parsed.parts.length === 2) return db.collection(parsed.collection).doc(parsed.id);
  return db
    .collection(parsed.parts[0])
    .doc(parsed.parts[1])
    .collection(parsed.parts[2])
    .doc(parsed.parts[3]);
}

function validateGeneratedStoragePath(path, manifest) {
  const normalized = String(path || "").trim().replace(/^\/+/, "");
  if (!normalized || normalized.includes("\\") || normalized.split("/").includes("..")) {
    throw operationError(`Unknown Storage delete target: ${path || "(empty)"}.`);
  }
  const approvedPaths = new Set(
    manifest.storage.fixtureObjects.map((item) => item.path)
  );
  const generatedPolicy = (manifest.storage.generatedObjectPolicies || [])
    .find((policy) => policy.pathPattern.test(normalized));
  if (!approvedPaths.has(normalized) && !generatedPolicy) {
    throw operationError(`Unknown Storage delete target: ${normalized}.`);
  }
  return normalized;
}

function validateLedgerData(ledger, manifest) {
  const data = ledger || {};
  for (const name of ["generatedFirestorePaths", "generatedAuthEmails", "generatedStoragePaths"]) {
    if (!Array.isArray(data[name])) throw operationError(`FT run ledger field ${name} must be an array.`);
  }
  data.generatedFirestorePaths.forEach((path) => validateGeneratedDocumentPath(path, manifest));
  data.generatedStoragePaths.forEach((path) => validateGeneratedStoragePath(path, manifest));
  const approvedGeneratedAuthEmails = new Set([manifest.registrationAccount.email]);
  for (const email of data.generatedAuthEmails) {
    if (!approvedGeneratedAuthEmails.has(String(email || "").trim().toLowerCase())) {
      throw operationError(`Unknown Auth delete target recorded in the FT run ledger.`);
    }
  }
  return data;
}

async function getAuthUserByUid(auth, uid) {
  try {
    return await auth.getUser(uid);
  } catch (error) {
    if (isMissingAuthUser(error)) return null;
    throw error;
  }
}

async function getAuthUserByEmail(auth, email) {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if (isMissingAuthUser(error)) return null;
    throw error;
  }
}

function classifyManifestAuthUser(user, byUid, byEmail, manifest) {
  if (!byUid && !byEmail) return { state: "missing", record: null };
  if (byUid && byEmail && byUid.uid !== byEmail.uid) {
    throw ownershipError(
      "Auth ownership preflight",
      user.testId,
      `Conflicting Auth identities found for ${user.testId}.`
    );
  }

  const existing = byUid || byEmail;
  const existingEmail = String(existing.email || "").trim().toLowerCase();
  if (existing.uid !== user.uid || existingEmail !== user.email) {
    throw ownershipError(
      "Auth ownership preflight",
      user.testId,
      `Auth identity collision for ${user.testId}; manual review is required.`
    );
  }

  const providerIds = (existing.providerData || [])
    .map((provider) => String(provider?.providerId || "").trim())
    .filter(Boolean);
  const unexpectedProvider = providerIds.find((providerId) => providerId !== "password");
  const enrolledFactors = existing.multiFactor?.enrolledFactors || [];
  if (
    unexpectedProvider ||
    String(existing.phoneNumber || "").trim() ||
    String(existing.tenantId || "").trim() ||
    enrolledFactors.length
  ) {
    throw ownershipError(
      "Auth ownership preflight",
      user.testId,
      `Unexpected Auth identity is attached to ${user.testId}; manual review is required.`
    );
  }

  const claims = existing.customClaims || {};
  const claimKeys = Object.keys(claims);
  const claimsOwned =
    claims.testData === true &&
    claims.testId === user.testId &&
    claims.testBaseline === manifest.baselineId &&
    claimKeys.every((key) => ["testData", "testId", "testBaseline"].includes(key));
  if (claimsOwned) return { state: "owned", record: existing };
  if (claimKeys.length === 0) return { state: "repairable-partial", record: existing };

  throw ownershipError(
    "Auth ownership preflight",
    user.testId,
    `Conflicting Auth claims found for ${user.testId}; manual review is required.`
  );
}

async function preflightBaselineOwnership({ db, auth, bucket }, manifest, { includeResetCleanup = false } = {}) {
  const documentSnapshots = new Map();
  for (const entry of manifest.documents) {
    let snapshot;
    try {
      snapshot = await db.collection(entry.collection).doc(entry.id).get();
    } catch (error) {
      throw mutationError("Firestore preflight read", entry.data.testId, error);
    }
    assertOwnedDocument(entry, snapshot);
    documentSnapshots.set(entry.path, snapshot);
  }

  const authStates = new Map();
  for (const user of manifest.users) {
    let byUid;
    let byEmail;
    try {
      [byUid, byEmail] = await Promise.all([
        getAuthUserByUid(auth, user.uid),
        getAuthUserByEmail(auth, user.email),
      ]);
    } catch (error) {
      throw mutationError("Auth preflight read", user.testId, error);
    }
    authStates.set(
      user.testId,
      classifyManifestAuthUser(user, byUid, byEmail, manifest)
    );
  }

  const registrationRef = db.collection("users").doc(manifest.registrationAccount.email);
  const registrationOtpRef = db.collection("emailVerificationOtps").doc(manifest.registrationAccount.email);
  let registrationDoc;
  let registrationOtpDoc;
  let registrationAuth;
  try {
    [registrationDoc, registrationOtpDoc] = await Promise.all([
      registrationRef.get(),
      registrationOtpRef.get(),
    ]);
  } catch (error) {
    throw mutationError("Firestore preflight read", manifest.registrationAccount.testId, error);
  }
  try {
    registrationAuth = await getAuthUserByEmail(auth, manifest.registrationAccount.email);
  } catch (error) {
    throw mutationError("Auth preflight read", manifest.registrationAccount.testId, error);
  }
  if (!includeResetCleanup && (registrationDoc.exists || registrationOtpDoc.exists || registrationAuth)) {
    throw ownershipError(
      "Registration absence preflight",
      manifest.registrationAccount.testId,
      "FT_REGISTRATION_ACCOUNT and its exact OTP record must be absent before baseline seed."
    );
  }

  const transientDocuments = [];
  for (const entry of manifest.transientCleanupDocuments || []) {
    const ref = db.collection(entry.collection).doc(entry.id);
    let snapshot;
    try {
      snapshot = await ref.get();
    } catch (error) {
      throw mutationError("Firestore preflight read", entry.testId, error);
    }
    if (!includeResetCleanup && snapshot.exists) {
      throw ownershipError(
        "Transient FT record absence preflight",
        entry.testId,
        `${entry.path} must be absent before baseline seed.`
      );
    }
    transientDocuments.push({ entry, ref, snapshot });
  }

  const cleanup = {
    firestore: [],
    auth: [],
    storage: [],
    registrationRef,
    registrationDoc,
    registrationOtpRef,
    registrationOtpDoc,
    registrationAuth,
    transientDocuments,
  };
  if (!includeResetCleanup) return { documentSnapshots, authStates, cleanup };

  const ledgerEntry = manifest.documents.find((entry) => entry.path === manifest.ledgerPath);
  const ledgerSnapshot = documentSnapshots.get(manifest.ledgerPath);
  const ledger = ledgerSnapshot?.exists
    ? validateLedgerData(ledgerSnapshot.data(), manifest)
    : { generatedFirestorePaths: [], generatedAuthEmails: [], generatedStoragePaths: [] };

  for (const path of ledger.generatedFirestorePaths) {
    const parsed = validateGeneratedDocumentPath(path, manifest);
    const ref = generatedDocumentReference(db, parsed);
    let snapshot;
    try {
      snapshot = await ref.get();
    } catch (error) {
      throw mutationError("Firestore cleanup preflight read", parsed.id, error);
    }
    if (snapshot.exists) {
      const data = snapshot.data() || {};
      if (
        parsed.id.startsWith("FT_RUN_") &&
        (data.testData !== true || data.testBaseline !== manifest.baselineId || data.testId !== parsed.id)
      ) {
        throw operationError(`Ledger target ${path} does not have the required FT ownership markers.`);
      }
      cleanup.firestore.push(ref);
    }
  }

  for (const emailValue of ledger.generatedAuthEmails) {
    const email = String(emailValue).trim().toLowerCase();
    let authUser;
    try {
      authUser = await getAuthUserByEmail(auth, email);
    } catch (error) {
      throw mutationError("Auth cleanup preflight read", manifest.registrationAccount.testId, error);
    }
    if (authUser) cleanup.auth.push(authUser.uid);
  }

  for (const path of ledger.generatedStoragePaths) {
    const objectPath = validateGeneratedStoragePath(path, manifest);
    const file = bucket.file(objectPath);
    const fixture = manifest.storage.fixtureObjects.find((item) => item.path === objectPath);
    const generatedPolicy = (manifest.storage.generatedObjectPolicies || [])
      .find((item) => item.pathPattern.test(objectPath));
    let exists;
    let metadata;
    try {
      [exists] = await file.exists();
      if (exists) [metadata] = await file.getMetadata();
    } catch (error) {
      throw mutationError("Storage cleanup preflight read", fixture?.testId || manifest.baselineId, error);
    }
    if (!exists) continue;
    if (!generatedPolicy &&
      (metadata?.metadata?.testBaseline !== manifest.baselineId || metadata?.metadata?.testData !== "true")) {
      throw operationError(`Ledger Storage target ${objectPath} lacks FT ownership metadata.`);
    }
    cleanup.storage.push(file);
  }

  if (ledgerEntry && ledgerSnapshot?.exists) assertOwnedDocument(ledgerEntry, ledgerSnapshot);
  return { documentSnapshots, authStates, cleanup };
}

async function materializeUserDocuments(manifest) {
  const hashes = new Map();
  const documents = new Map(manifest.documents.map((entry) => [entry.path, entry]));
  for (const user of manifest.users) {
    if (!hashes.has(user.password)) hashes.set(user.password, await bcrypt.hash(user.password, 12));
    const entry = documents.get(user.firestore.path);
    entry.data = { ...entry.data, password: hashes.get(user.password), firebaseUid: user.uid };
  }
}

async function writeUsers(auth, users, authStates) {
  const summary = { created: 0, updated: 0, repaired: 0, claimsSet: 0 };
  for (const user of users) {
    const state = authStates.get(user.testId);
    if (!state) throw operationError(`Missing Auth preflight state for ${user.testId}.`);
    const payload = { ...user.auth, password: user.password };
    try {
      if (state.state === "missing") {
        await auth.createUser({ uid: user.uid, ...payload });
        summary.created += 1;
      } else {
        await auth.updateUser(user.uid, payload);
        if (state.state === "repairable-partial") summary.repaired += 1;
        else summary.updated += 1;
      }
    } catch (error) {
      throw mutationError("Auth account mutation", user.testId, error);
    }
    try {
      await auth.setCustomUserClaims(user.uid, user.claims);
      summary.claimsSet += 1;
    } catch (error) {
      throw mutationError("Auth ownership claims", user.testId, error);
    }
  }
  return summary;
}

async function writeDocuments(db, documents) {
  let batchesCommitted = 0;
  for (let offset = 0; offset < documents.length; offset += 400) {
    const batch = db.batch();
    for (const entry of documents.slice(offset, offset + 400)) {
      batch.set(db.collection(entry.collection).doc(entry.id), entry.data);
    }
    try {
      await batch.commit();
      batchesCommitted += 1;
    } catch (error) {
      throw mutationError(
        "Firestore baseline batch",
        `FT_BASELINE_V1_BATCH_${batchesCommitted + 1}`,
        error
      );
    }
  }
  return { documents: documents.length, batchesCommitted };
}

async function performCleanup({ db, auth }, manifest, cleanup) {
  const firestoreTargets = [...cleanup.firestore];
  if (cleanup.registrationDoc.exists) firestoreTargets.push(cleanup.registrationRef);
  if (cleanup.registrationOtpDoc.exists) firestoreTargets.push(cleanup.registrationOtpRef);
  for (const transient of cleanup.transientDocuments || []) {
    if (transient.snapshot.exists) firestoreTargets.push(transient.ref);
  }
  const uniqueFirestoreTargets = [
    ...new Map(firestoreTargets.map((ref) => [ref.path, ref])).values(),
  ];
  for (let offset = 0; offset < uniqueFirestoreTargets.length; offset += 400) {
    const batch = db.batch();
    uniqueFirestoreTargets.slice(offset, offset + 400).forEach((ref) => batch.delete(ref));
    try {
      await batch.commit();
    } catch (error) {
      throw mutationError("Firestore controlled cleanup", manifest.baselineId, error);
    }
  }
  const authTargets = [...cleanup.auth];
  if (cleanup.registrationAuth) authTargets.push(cleanup.registrationAuth.uid);
  for (const uid of new Set(authTargets)) {
    try {
      await auth.deleteUser(uid);
    } catch (error) {
      throw mutationError("Auth controlled cleanup", manifest.registrationAccount.testId, error);
    }
  }
  for (const file of cleanup.storage) {
    const fixture = manifest.storage.fixtureObjects.find((item) => item.path === file.name);
    const generatedPolicy = (manifest.storage.generatedObjectPolicies || [])
      .find((item) => item.pathPattern.test(file.name));
    try {
      await file.delete();
    } catch (error) {
      throw mutationError(
        "Storage controlled cleanup",
        fixture?.testId || generatedPolicy?.testId || manifest.baselineId,
        error
      );
    }
  }
}

function dryRunPlan(manifest, mode = "seed") {
  const counts = {};
  for (const entry of manifest.documents) counts[entry.collection] = (counts[entry.collection] || 0) + 1;
  return {
    mode,
    baselineId: manifest.baselineId,
    authAccounts: manifest.users.map((user) => user.testId),
    firestore: Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([collection, count]) => ({ collection, count })),
    firestoreDocumentIds: manifest.documents.map((entry) => ({
      collection: entry.collection,
      testId: entry.data.testId,
    })),
    registrationAccountExpectedAbsent: manifest.registrationAccount.testId,
    transientCleanupDocumentsExpectedAbsent: (manifest.transientCleanupDocuments || []).map(
      (entry) => entry.testId
    ),
    storageUploads: 0,
    hostedCalls: 0,
    writes: 0,
  };
}

async function seedBaseline(adapter, manifest, {
  onPhase = () => {},
  materializeUsers = materializeUserDocuments,
} = {}) {
  onPhase("preflight:start");
  const preflight = await preflightBaselineOwnership(adapter, manifest, { includeResetCleanup: false });
  onPhase("preflight:passed");
  await materializeUsers(manifest);
  onPhase("auth:start");
  const auth = await writeUsers(adapter.auth, manifest.users, preflight.authStates);
  onPhase("auth:passed");
  onPhase("firestore:start");
  const firestore = await writeDocuments(adapter.db, manifest.documents);
  onPhase("firestore:passed");
  return { mode: "seed", users: manifest.users.length, documents: manifest.documents.length, auth, firestore };
}

async function resetBaseline(adapter, manifest, {
  onPhase = () => {},
  materializeUsers = materializeUserDocuments,
} = {}) {
  onPhase("preflight:start");
  const { cleanup, authStates } = await preflightBaselineOwnership(adapter, manifest, { includeResetCleanup: true });
  onPhase("preflight:passed");
  await materializeUsers(manifest);
  onPhase("cleanup:start");
  await performCleanup(adapter, manifest, cleanup);
  onPhase("cleanup:passed");
  onPhase("auth:start");
  const auth = await writeUsers(adapter.auth, manifest.users, authStates);
  onPhase("auth:passed");
  onPhase("firestore:start");
  const firestore = await writeDocuments(adapter.db, manifest.documents);
  onPhase("firestore:passed");
  return {
    mode: "reset",
    users: manifest.users.length,
    documents: manifest.documents.length,
    deleted: cleanup.firestore.length + cleanup.auth.length + cleanup.storage.length +
      Number(cleanup.registrationDoc.exists) + Number(cleanup.registrationOtpDoc.exists) +
      Number(Boolean(cleanup.registrationAuth)) +
      (cleanup.transientDocuments || []).filter((entry) => entry.snapshot.exists).length,
    auth,
    firestore,
  };
}

async function verifyBaseline(adapter, manifest) {
  const collections = {};
  const missing = [];
  const invalid = [];
  for (const entry of manifest.documents) {
    collections[entry.collection] = collections[entry.collection] || { expected: 0, valid: 0 };
    collections[entry.collection].expected += 1;
    const snapshot = await adapter.db.collection(entry.collection).doc(entry.id).get();
    if (!snapshot.exists) {
      missing.push(`${entry.collection}/${entry.data.testId}`);
      continue;
    }
    const data = snapshot.data() || {};
    if (data.testData !== true || data.testId !== entry.data.testId || data.testBaseline !== manifest.baselineId) {
      invalid.push(`${entry.collection}/${entry.data.testId}`);
      continue;
    }
    collections[entry.collection].valid += 1;
  }
  let validAuthUsers = 0;
  for (const user of manifest.users) {
    const authUser = await getAuthUserByUid(adapter.auth, user.uid);
    const claims = authUser?.customClaims || {};
    const valid = authUser &&
      String(authUser.email || "").toLowerCase() === user.email &&
      authUser.emailVerified === user.auth.emailVerified &&
      authUser.disabled === user.auth.disabled &&
      claims.testData === true &&
      claims.testId === user.testId &&
      claims.testBaseline === manifest.baselineId;
    if (!authUser) missing.push(`Auth/${user.testId}`);
    else if (!valid) invalid.push(`Auth/${user.testId}`);
    else validAuthUsers += 1;
  }
  const [registrationDoc, registrationOtpDoc] = await Promise.all([
    adapter.db.collection("users").doc(manifest.registrationAccount.email).get(),
    adapter.db.collection("emailVerificationOtps").doc(manifest.registrationAccount.email).get(),
  ]);
  const registrationAuth = await getAuthUserByEmail(adapter.auth, manifest.registrationAccount.email);
  const registrationAbsent = !registrationDoc.exists && !registrationOtpDoc.exists && !registrationAuth;
  if (!registrationAbsent) invalid.push(`Absent/${manifest.registrationAccount.testId}`);
  let transientCleanupDocumentsAbsent = true;
  for (const entry of manifest.transientCleanupDocuments || []) {
    const snapshot = await adapter.db.collection(entry.collection).doc(entry.id).get();
    if (snapshot.exists) {
      transientCleanupDocumentsAbsent = false;
      invalid.push(`Absent/${entry.testId}`);
    }
  }
  const ledgerRef = adapter.db.collection("ftRunLedgers").doc(manifest.baselineId);
  const ledgerSnapshot = await ledgerRef.get();
  let ledgerPaths = [];
  let existingGeneratedRecords = 0;
  if (ledgerSnapshot.exists) {
    try {
      const ledger = validateLedgerData(ledgerSnapshot.data(), manifest);
      ledgerPaths = [...ledger.generatedFirestorePaths];
      for (const generatedPath of ledgerPaths) {
        const parsed = validateGeneratedDocumentPath(generatedPath, manifest);
        const snapshot = await generatedDocumentReference(adapter.db, parsed).get();
        if (snapshot.exists) {
          existingGeneratedRecords += 1;
          invalid.push(`Generated/${generatedPath}`);
        } else {
          invalid.push(`Ledger/${generatedPath}`);
        }
      }
      if (ledger.generatedAuthEmails.length || ledger.generatedStoragePaths.length) {
        invalid.push("Ledger/non-Firestore generated targets remain registered");
      }
    } catch (_error) {
      invalid.push(`Ledger/${manifest.baselineId} is invalid`);
    }
  }
  return {
    baselineId: manifest.baselineId,
    authUsers: { expected: manifest.users.length, valid: validAuthUsers },
    collections,
    registrationAccountAbsent: registrationAbsent,
    transientCleanupDocumentsAbsent,
    generatedFirestoreRecords: {
      registered: ledgerPaths.length,
      existing: existingGeneratedRecords,
    },
    missing,
    invalid,
    valid: missing.length === 0 && invalid.length === 0,
  };
}

module.exports = {
  assertOwnedDocument,
  validateGeneratedDocumentPath,
  validateGeneratedStoragePath,
  validateLedgerData,
  classifyManifestAuthUser,
  preflightBaselineOwnership,
  dryRunPlan,
  seedBaseline,
  resetBaseline,
  verifyBaseline,
};
