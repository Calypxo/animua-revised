const {
  classifyManifestAuthUser,
  resetBaseline,
  seedBaseline,
} = require("../scripts/ft-baseline/operations");
const {
  executeBaselineMode,
  runBaselineMode,
} = require("../scripts/ftBaseline");

function missingAuthError() {
  return Object.assign(new Error("missing"), { code: "auth/user-not-found" });
}

function testUser(testId, suffix) {
  const email = `${suffix}@example.test`;
  const uid = `${testId.toLowerCase()}-v1`;
  return {
    testId,
    uid,
    email,
    password: "mock-password",
    auth: { email, displayName: testId, emailVerified: true, disabled: false },
    claims: { testData: true, testId, testBaseline: "FT_BASELINE_V1" },
    firestore: { path: `users/${email}` },
  };
}

function createSeedHarness({ users = [testUser("FT_CLIENT_ACTIVE", "active"), testUser("FT_STAFF_ACTIVE", "staff")] } = {}) {
  const events = [];
  const records = new Map();
  const authRecords = new Map();
  const documentEntries = users.map((user) => ({
    collection: "users",
    id: user.email,
    path: `users/${user.email}`,
    data: {
      testData: true,
      testId: user.testId,
      testBaseline: "FT_BASELINE_V1",
      email: user.email,
    },
  }));
  const makeRef = (collection, id) => ({
    collection,
    id,
    path: `${collection}/${id}`,
    get: vi.fn(async () => {
      events.push(`read:firestore:${collection}:${id}`);
      return { exists: records.has(`${collection}/${id}`), data: () => records.get(`${collection}/${id}`) };
    }),
  });
  const db = {
    collection: vi.fn((collection) => ({ doc: vi.fn((id) => makeRef(collection, id)) })),
    batch: vi.fn(() => {
      const writes = [];
      return {
        set: vi.fn((ref, data) => writes.push([ref, data])),
        commit: vi.fn(async () => {
          events.push("mutation:firestore:commit");
          for (const [ref, data] of writes) records.set(ref.path, data);
        }),
      };
    }),
  };
  const findByEmail = (email) => [...authRecords.values()].find(
    (record) => record.email.toLowerCase() === email.toLowerCase()
  );
  const auth = {
    getUser: vi.fn(async (uid) => {
      events.push(`read:auth:uid:${uid}`);
      if (!authRecords.has(uid)) throw missingAuthError();
      return authRecords.get(uid);
    }),
    getUserByEmail: vi.fn(async (email) => {
      events.push(`read:auth:email:${email}`);
      const record = findByEmail(email);
      if (!record) throw missingAuthError();
      return record;
    }),
    createUser: vi.fn(async (payload) => {
      events.push(`mutation:auth:create:${payload.uid}`);
      const record = {
        uid: payload.uid,
        email: payload.email,
        emailVerified: payload.emailVerified,
        disabled: payload.disabled,
        providerData: [{ providerId: "password" }],
        customClaims: {},
      };
      authRecords.set(payload.uid, record);
      return record;
    }),
    updateUser: vi.fn(async (uid, payload) => {
      events.push(`mutation:auth:update:${uid}`);
      const record = { ...authRecords.get(uid), ...payload, uid };
      authRecords.set(uid, record);
      return record;
    }),
    setCustomUserClaims: vi.fn(async (uid, claims) => {
      events.push(`mutation:auth:claims:${uid}`);
      authRecords.get(uid).customClaims = claims;
    }),
  };
  const manifest = {
    baselineId: "FT_BASELINE_V1",
    users,
    documents: documentEntries,
    registrationAccount: {
      testId: "FT_REGISTRATION_ACCOUNT",
      email: "registration@example.test",
    },
    storage: { fixtureObjects: [] },
    generatedFirestorePolicy: {
      allowedCollections: [],
      documentIdPattern: /^FT_RUN_/,
      inventoryTransactionIdPattern: /^FT_RUN_/,
    },
  };
  return {
    adapter: { db, auth, bucket: { file: vi.fn() } },
    manifest,
    events,
    records,
    authRecords,
    auth,
    db,
  };
}

function loggerRecorder() {
  const lines = [];
  return {
    lines,
    logger: {
      log: vi.fn((message) => lines.push(String(message))),
      error: vi.fn((message) => lines.push(String(message))),
    },
  };
}

function smallPlan(mode) {
  return {
    mode,
    baselineId: "FT_BASELINE_V1",
    authAccounts: ["FT_CLIENT_ACTIVE"],
    firestore: [{ collection: "users", count: 1 }],
    firestoreDocumentIds: [{ collection: "users", testId: "FT_CLIENT_ACTIVE" }],
    registrationAccountExpectedAbsent: "FT_REGISTRATION_ACCOUNT",
    storageUploads: 0,
    hostedCalls: 0,
    writes: 0,
  };
}

describe("FT baseline seed command regression", () => {
  it("continues from the plan into the seed mutation function", async () => {
    const { logger, lines } = loggerRecorder();
    const seed = vi.fn(async () => ({
      users: 1,
      documents: 1,
      auth: { created: 1, updated: 0, repaired: 0, claimsSet: 1 },
      firestore: { batchesCommitted: 1 },
    }));
    const result = await executeBaselineMode({
      mode: "seed",
      manifest: { users: [{}], documents: [{}] },
      adapter: {},
      logger,
      operations: { dryRunPlan: () => smallPlan("seed"), seedBaseline: seed },
    });
    expect(seed).toHaveBeenCalledOnce();
    expect(result.exitCode).toBe(0);
    expect(lines).toContain("Seed: PASSED");
  });

  it("dry-run performs no hosted reads or writes", async () => {
    const hosted = { verifyBaseline: vi.fn(), seedBaseline: vi.fn(), resetBaseline: vi.fn() };
    const result = await executeBaselineMode({
      mode: "dry-run",
      manifest: {},
      adapter: new Proxy({}, { get: () => { throw new Error("hosted access"); } }),
      logger: loggerRecorder().logger,
      operations: { ...hosted, dryRunPlan: () => smallPlan("dry-run") },
    });
    expect(result.exitCode).toBe(0);
    expect(hosted.verifyBaseline).not.toHaveBeenCalled();
    expect(hosted.seedBaseline).not.toHaveBeenCalled();
    expect(hosted.resetBaseline).not.toHaveBeenCalled();
  });

  it("prints success only after the awaited seed mutations finish", async () => {
    let finish;
    const pending = new Promise((resolve) => { finish = resolve; });
    const { logger, lines } = loggerRecorder();
    const execution = executeBaselineMode({
      mode: "seed",
      manifest: { users: [{}], documents: [{}] },
      adapter: {},
      logger,
      operations: {
        dryRunPlan: () => smallPlan("seed"),
        seedBaseline: async () => {
          await pending;
          return {
            users: 1,
            documents: 1,
            auth: { created: 1, updated: 0, repaired: 0, claimsSet: 1 },
            firestore: { batchesCommitted: 1 },
          };
        },
      },
    });
    await Promise.resolve();
    expect(lines).not.toContain("Seed: PASSED");
    finish();
    await execution;
    expect(lines.at(-1)).toBe("Seed: PASSED");
  });

  it("returns non-zero and never prints success when seed fails", async () => {
    const { logger, lines } = loggerRecorder();
    const result = await runBaselineMode({
      mode: "seed",
      manifest: { users: [{}], documents: [{}] },
      adapter: {},
      logger,
      operations: {
        dryRunPlan: () => smallPlan("seed"),
        seedBaseline: vi.fn(async () => {
          const error = new Error("hidden provider detail");
          error.operationCategory = "Auth account mutation";
          error.testId = "FT_CLIENT_ACTIVE";
          throw error;
        }),
      },
    });
    expect(result.exitCode).toBe(1);
    expect(lines).toContain("Seed failure category: Auth account mutation");
    expect(lines).toContain("Seed failure target: FT_CLIENT_ACTIVE");
    expect(lines).toContain("Seed: FAILED");
    expect(lines).not.toContain("Seed: PASSED");
    expect(lines.join(" ")).not.toContain("hidden provider detail");
  });
});

describe("FT baseline preflight and resumable Auth writes", () => {
  const noHash = async () => {};

  it("completes every hosted preflight read before the first mutation", async () => {
    const harness = createSeedHarness();
    await seedBaseline(harness.adapter, harness.manifest, { materializeUsers: noHash });
    const firstMutation = harness.events.findIndex((event) => event.startsWith("mutation:"));
    const lastRead = harness.events.reduce(
      (index, event, current) => event.startsWith("read:") ? current : index,
      -1
    );
    expect(lastRead).toBeLessThan(firstMutation);
    expect(harness.events.filter((event) => event.startsWith("read:")).length).toBeGreaterThan(0);
  });

  it("does not write Firestore when an Auth preflight read fails", async () => {
    const harness = createSeedHarness();
    const secondUid = harness.manifest.users[1].uid;
    harness.auth.getUser.mockImplementation(async (uid) => {
      harness.events.push(`read:auth:uid:${uid}`);
      if (uid === secondUid) throw Object.assign(new Error("provider unavailable"), { code: "auth/internal-error" });
      throw missingAuthError();
    });
    await expect(seedBaseline(harness.adapter, harness.manifest, { materializeUsers: noHash }))
      .rejects.toMatchObject({ operationCategory: "Auth preflight read", testId: "FT_STAFF_ACTIVE" });
    expect(harness.db.batch).not.toHaveBeenCalled();
    expect(harness.auth.createUser).not.toHaveBeenCalled();
  });

  it("does not silently succeed when the first Auth creation fails", async () => {
    const harness = createSeedHarness();
    harness.auth.createUser.mockRejectedValueOnce(new Error("create failed"));
    await expect(seedBaseline(harness.adapter, harness.manifest, { materializeUsers: noHash }))
      .rejects.toMatchObject({
        code: "FT_BASELINE_MUTATION_FAILED",
        operationCategory: "Auth account mutation",
        testId: "FT_CLIENT_ACTIVE",
      });
    expect(harness.db.batch).not.toHaveBeenCalled();
  });

  it("repairs the exact partially-created FT_CLIENT_ACTIVE account", async () => {
    const user = testUser("FT_CLIENT_ACTIVE", "active");
    const harness = createSeedHarness({ users: [user] });
    harness.authRecords.set(user.uid, {
      uid: user.uid,
      email: user.email,
      emailVerified: true,
      disabled: false,
      providerData: [{ providerId: "password" }],
      customClaims: {},
    });
    const result = await seedBaseline(harness.adapter, harness.manifest, { materializeUsers: noHash });
    expect(result.auth).toMatchObject({ created: 0, updated: 0, repaired: 1, claimsSet: 1 });
    expect(harness.auth.updateUser).toHaveBeenCalledWith(user.uid, expect.objectContaining({ email: user.email }));
    expect(harness.auth.setCustomUserClaims).toHaveBeenCalledWith(user.uid, user.claims);
    expect(harness.auth.createUser).not.toHaveBeenCalled();
  });

  it("reset uses the same exact-identity recovery for partial FT_CLIENT_ACTIVE", async () => {
    const user = testUser("FT_CLIENT_ACTIVE", "active");
    const harness = createSeedHarness({ users: [user] });
    harness.authRecords.set(user.uid, {
      uid: user.uid,
      email: user.email,
      emailVerified: true,
      disabled: false,
      providerData: [{ providerId: "password" }],
      customClaims: {},
    });
    const result = await resetBaseline(harness.adapter, harness.manifest, { materializeUsers: noHash });
    expect(result.auth.repaired).toBe(1);
    expect(harness.auth.updateUser).toHaveBeenCalledWith(user.uid, expect.any(Object));
    expect(harness.auth.setCustomUserClaims).toHaveBeenCalledWith(user.uid, user.claims);
  });

  it("aborts for a conflicting FT_CLIENT_ACTIVE identity before all writes", async () => {
    const user = testUser("FT_CLIENT_ACTIVE", "active");
    const harness = createSeedHarness({ users: [user] });
    harness.authRecords.set("unexpected-uid", {
      uid: "unexpected-uid",
      email: user.email,
      providerData: [{ providerId: "password" }],
      customClaims: {},
    });
    await expect(seedBaseline(harness.adapter, harness.manifest, { materializeUsers: noHash }))
      .rejects.toThrow(/collision.*manual review/i);
    expect(harness.auth.createUser).not.toHaveBeenCalled();
    expect(harness.auth.updateUser).not.toHaveBeenCalled();
    expect(harness.db.batch).not.toHaveBeenCalled();
  });

  it("aborts for a conflicting FT_CLIENT_ACTIVE Firestore record before repairing Auth", async () => {
    const user = testUser("FT_CLIENT_ACTIVE", "active");
    const harness = createSeedHarness({ users: [user] });
    harness.authRecords.set(user.uid, {
      uid: user.uid,
      email: user.email,
      emailVerified: true,
      disabled: false,
      providerData: [{ providerId: "password" }],
      customClaims: {},
    });
    harness.records.set(`users/${user.email}`, {
      email: user.email,
      role: "Client",
    });

    await expect(seedBaseline(harness.adapter, harness.manifest, { materializeUsers: noHash }))
      .rejects.toThrow(/unowned users record FT_CLIENT_ACTIVE/i);
    expect(harness.auth.updateUser).not.toHaveBeenCalled();
    expect(harness.auth.setCustomUserClaims).not.toHaveBeenCalled();
    expect(harness.db.batch).not.toHaveBeenCalled();
  });

  it("rejects an exact UID/email account with an unexpected linked provider", () => {
    const user = testUser("FT_CLIENT_ACTIVE", "active");
    const record = {
      uid: user.uid,
      email: user.email,
      providerData: [{ providerId: "google.com" }],
      customClaims: {},
    };
    expect(() => classifyManifestAuthUser(user, record, record, {
      baselineId: "FT_BASELINE_V1",
    })).toThrow(/Unexpected Auth identity.*manual review/);
  });

  it("awaits every Auth claim and Firestore commit before resolving", async () => {
    const harness = createSeedHarness({ users: [testUser("FT_CLIENT_ACTIVE", "active")] });
    let releaseClaims;
    let releaseCommit;
    harness.auth.setCustomUserClaims.mockImplementation(async (uid, claims) => {
      await new Promise((resolve) => { releaseClaims = () => {
        harness.authRecords.get(uid).customClaims = claims;
        resolve();
      }; });
    });
    const originalBatch = harness.db.batch.getMockImplementation();
    harness.db.batch.mockImplementation(() => {
      const batch = originalBatch();
      batch.commit.mockImplementation(async () => {
        await new Promise((resolve) => { releaseCommit = resolve; });
      });
      return batch;
    });
    let settled = false;
    const operation = seedBaseline(harness.adapter, harness.manifest, { materializeUsers: noHash })
      .then(() => { settled = true; });
    while (!releaseClaims) await Promise.resolve();
    expect(settled).toBe(false);
    releaseClaims();
    while (!releaseCommit) await Promise.resolve();
    expect(settled).toBe(false);
    releaseCommit();
    await operation;
    expect(settled).toBe(true);
  });
});
