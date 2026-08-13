const {
  loadWithMocks,
  responseRecorder,
} = require("./helpers/commonjs");

const ORIGINAL_APP_ENVIRONMENT = process.env.APP_ENVIRONMENT;

function restoreEnvironment() {
  if (ORIGINAL_APP_ENVIRONMENT === undefined) delete process.env.APP_ENVIRONMENT;
  else process.env.APP_ENVIRONMENT = ORIGINAL_APP_ENVIRONMENT;
}

afterEach(() => {
  restoreEnvironment();
});

function loadDeadlineService(db) {
  return loadWithMocks("../src/services/requestDeadlineService", {
    "../src/config/firebase": { db },
  });
}

function approvedRecord() {
  return {
    status: "Approved",
    approvedAt: "2026-08-01T00:00:00.000Z",
    attendanceDeadlineAt: "2026-08-15T15:59:59.999Z",
    deadlineDays: 14,
    deadlineStatus: "Awaiting Appointment",
    deadlineReminderStage: "Approved",
    noShowRisk: false,
  };
}

function reconciliationHarness() {
  const update = vi.fn(async () => {});
  const get = vi.fn(async () => ({
    size: 1,
    docs: [{ data: () => approvedRecord(), ref: { update } }],
  }));
  const where = vi.fn(() => ({ get }));
  const db = { collection: vi.fn(() => ({ where })) };
  return { db, get, update, where };
}

function emptyQueryHarness() {
  const update = vi.fn(async () => {});
  const query = {
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    select: vi.fn(() => query),
    count: vi.fn(() => ({
      get: vi.fn(async () => ({ data: () => ({ count: 0 }) })),
    })),
    get: vi.fn(async () => ({ docs: [], size: 0 })),
    doc: vi.fn(() => ({
      get: vi.fn(async () => ({ exists: false })),
      update,
    })),
  };
  const db = { collection: vi.fn(() => query) };
  return { db, query, update };
}

function startupService() {
  return loadWithMocks("../src/services/startupDeadlineReconciliation", {
    "../src/services/requestDeadlineService": {
      isFunctionalityTestingEnvironment: (env = process.env) =>
        String(env.APP_ENVIRONMENT || "").trim().toLowerCase() === "functionality-testing",
    },
  });
}

describe("Functionality-testing deadline reconciliation guard", () => {
  it("returns before performing any Firestore read", async () => {
    process.env.APP_ENVIRONMENT = "functionality-testing";
    const db = { collection: vi.fn(() => { throw new Error("Firestore read attempted"); }) };
    const service = loadDeadlineService(db);

    const result = await service.reconcileRequestDeadlines();

    expect(result).toEqual({
      checked: 0,
      updated: 0,
      expired: 0,
      skipped: true,
      reason: "functionality-testing",
    });
    expect(db.collection).not.toHaveBeenCalled();
  });

  it("performs zero Firestore writes", async () => {
    process.env.APP_ENVIRONMENT = "functionality-testing";
    const harness = reconciliationHarness();
    const service = loadDeadlineService(harness.db);

    await service.reconcileRequestDeadlines("adoption", new Date("2026-08-16T00:00:00.000Z"));

    expect(harness.update).not.toHaveBeenCalled();
    expect(harness.get).not.toHaveBeenCalled();
  });

  it("still executes reconciliation in a normal development environment", async () => {
    process.env.APP_ENVIRONMENT = "normal-development";
    const harness = reconciliationHarness();
    const service = loadDeadlineService(harness.db);

    const result = await service.reconcileRequestDeadlines(
      "adoption",
      new Date("2026-08-08T00:05:00.000Z")
    );

    expect(result).toMatchObject({ checked: 1, updated: 1 });
    expect(harness.get).toHaveBeenCalledOnce();
    expect(harness.update).toHaveBeenCalledOnce();
  });

  it("keeps production reconciliation enabled", async () => {
    process.env.APP_ENVIRONMENT = "production";
    const harness = reconciliationHarness();
    const service = loadDeadlineService(harness.db);

    const result = await service.reconcileRequestDeadlines(
      "surrender",
      new Date("2026-08-16T00:00:00.000Z")
    );

    expect(result).toMatchObject({ checked: 1, updated: 1, expired: 1 });
    expect(harness.update).toHaveBeenCalledOnce();
  });
});

describe("Deadline reconciliation startup scheduling", () => {
  it("does not invoke initial reconciliation in functionality-testing", () => {
    const reconcile = vi.fn(async () => {});
    const setIntervalFn = vi.fn();

    const result = startupService().startAutomaticDeadlineReconciliation({
      env: { APP_ENVIRONMENT: "functionality-testing" },
      reconcileRequestDeadlines: reconcile,
      setIntervalFn,
      logger: { log: vi.fn(), error: vi.fn() },
    });

    expect(result.enabled).toBe(false);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("does not schedule the interval in functionality-testing", () => {
    const setIntervalFn = vi.fn();

    const result = startupService().startAutomaticDeadlineReconciliation({
      env: { APP_ENVIRONMENT: "functionality-testing" },
      reconcileRequestDeadlines: vi.fn(async () => {}),
      setIntervalFn,
      logger: { log: vi.fn(), error: vi.fn() },
    });

    expect(result.timer).toBeNull();
    expect(setIntervalFn).not.toHaveBeenCalled();
  });

  it("preserves the initial run and 15-minute interval normally", async () => {
    const reconcile = vi.fn(async () => ({ checked: 0, updated: 0, expired: 0 }));
    const timer = { unref: vi.fn() };
    const setIntervalFn = vi.fn(() => timer);
    const service = startupService();

    const result = service.startAutomaticDeadlineReconciliation({
      env: { APP_ENVIRONMENT: "normal-development" },
      reconcileRequestDeadlines: reconcile,
      setIntervalFn,
      logger: { log: vi.fn(), error: vi.fn() },
    });
    await result.initialPromise;

    expect(result.enabled).toBe(true);
    expect(reconcile).toHaveBeenCalledOnce();
    expect(setIntervalFn).toHaveBeenCalledWith(
      expect.any(Function),
      service.DEADLINE_RECONCILIATION_INTERVAL_MS
    );
    expect(timer.unref).toHaveBeenCalledOnce();
  });
});

describe("Read-triggered reconciliation and explicit workflows", () => {
  it("keeps adoption GET-triggered reconciliation write-free in functionality-testing", async () => {
    process.env.APP_ENVIRONMENT = "functionality-testing";
    const harness = emptyQueryHarness();
    const deadlines = loadDeadlineService(harness.db);
    const controller = loadWithMocks("../src/controllers/adoptionController", {
      "../src/config/firebase": { db: harness.db, admin: {} },
      "../src/services/requestDeadlineService": deadlines,
      "../src/services/storageUrlService": { getSignedReadUrl: vi.fn(async () => "") },
      "../src/services/notificationService": {
        createUserNotification: vi.fn(),
        createManagementNotification: vi.fn(),
      },
    });
    const response = responseRecorder();

    await controller.getAllAdoptions({ query: {} }, response);

    expect(response.statusCode).toBe(200);
    expect(harness.query.where).not.toHaveBeenCalled();
    expect(harness.update).not.toHaveBeenCalled();
  });

  it("keeps surrender GET-triggered reconciliation write-free in functionality-testing", async () => {
    process.env.APP_ENVIRONMENT = "functionality-testing";
    const harness = emptyQueryHarness();
    const deadlines = loadDeadlineService(harness.db);
    const controller = loadWithMocks("../src/controllers/surrenderController", {
      "../src/config/firebase": { db: harness.db },
      "../src/services/requestDeadlineService": deadlines,
      "../src/services/surrenderNlpService": { analyzeSurrenderReason: vi.fn() },
      "../src/services/notificationService": {
        createUserNotification: vi.fn(),
        createManagementNotification: vi.fn(),
      },
    });
    const response = responseRecorder();

    await controller.getAllSurrenderRequests({}, response);

    expect(response.statusCode).toBe(200);
    expect(harness.query.where).not.toHaveBeenCalled();
    expect(harness.update).not.toHaveBeenCalled();
  });

  it("keeps dashboard-triggered reconciliation write-free in functionality-testing", async () => {
    process.env.APP_ENVIRONMENT = "functionality-testing";
    const harness = emptyQueryHarness();
    const deadlines = loadDeadlineService(harness.db);
    const controller = loadWithMocks("../src/controllers/dashboardController", {
      "../src/config/firebase": { db: harness.db },
      "../src/services/requestDeadlineService": deadlines,
      "../src/services/dashboardMetricsService": { getCurrentAnimalProfiles: vi.fn(() => []) },
    });
    const response = responseRecorder();

    await controller.getAttentionSummary({ query: { refresh: "1" } }, response);

    expect(response.statusCode).toBe(200);
    expect(harness.update).not.toHaveBeenCalled();
  });

  it("leaves explicit deadline mutation handlers operational", async () => {
    process.env.APP_ENVIRONMENT = "functionality-testing";
    let record = approvedRecord();
    const update = vi.fn(async (changes) => { record = { ...record, ...changes }; });
    const reference = {
      get: vi.fn(async () => ({ exists: true, id: "FT_ADOPTION_APPROVED", data: () => record })),
      update,
    };
    const db = { collection: vi.fn(() => ({ doc: vi.fn(() => reference) })) };
    const deadlines = loadDeadlineService(db);
    const controller = loadWithMocks("../src/controllers/requestDeadlineController", {
      "../src/config/firebase": {
        db,
        admin: { firestore: { FieldValue: { arrayUnion: vi.fn((value) => value) } } },
      },
      "../src/services/requestDeadlineService": deadlines,
    });
    const response = responseRecorder();

    await controller.confirmAdoptionArrival({
      params: { id: "FT_ADOPTION_APPROVED" },
      user: { fullName: "FT Staff Active" },
      body: {},
    }, response);

    expect(response.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      deadlineStatus: "Arrival Confirmed",
      deadlineReminderStage: "Completed",
      noShowRisk: false,
    }));
  });
});
