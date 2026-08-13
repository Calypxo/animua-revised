const { loadWithMocks, responseRecorder, snapshot } = require("./helpers/commonjs");

function inventoryHarness(initial = {}) {
  const records = new Map(Object.entries(initial));
  const transactions = new Map();
  let generated = 0;

  const makeTransactionRef = (itemId, transactionId = `txn-${++generated}`) => ({
    id: transactionId,
    _path: `inventoryItems/${itemId}/transactions/${transactionId}`,
  });
  const makeItemRef = (itemId) => ({
    id: itemId,
    _path: `inventoryItems/${itemId}`,
    get: vi.fn(async () => snapshot(records.get(itemId), itemId)),
    create: vi.fn(async (data) => records.set(itemId, data)),
    update: vi.fn(async (updates) => records.set(itemId, { ...records.get(itemId), ...updates })),
    collection: vi.fn(() => ({
      doc: vi.fn(() => makeTransactionRef(itemId)),
      get: vi.fn(async () => ({
        docs: [...transactions.entries()]
          .filter(([path]) => path.startsWith(`inventoryItems/${itemId}/transactions/`))
          .map(([path, data]) => ({ id: path.split("/").at(-1), data: () => data })),
      })),
    })),
  });
  const db = {
    collection: vi.fn(() => ({
      doc: vi.fn(makeItemRef),
      get: vi.fn(async () => ({
        docs: [...records.entries()].map(([id, data]) => ({ id, data: () => data })),
      })),
    })),
    runTransaction: vi.fn(async (callback) => callback({
      get: async (reference) => snapshot(records.get(reference.id), reference.id),
      update: (reference, updates) => records.set(reference.id, { ...records.get(reference.id), ...updates }),
      set: (reference, data) => transactions.set(reference._path, data),
    })),
  };
  const admin = { firestore: { FieldValue: { serverTimestamp: () => "server-time" } } };
  const controller = loadWithMocks("../src/controllers/inventoryController", {
    "../src/config/firebase": { db, admin },
  });
  return { controller, records, transactions };
}

const managementUser = {
  id: "staff@test.com",
  email: "staff@test.com",
  fullName: "Authorized Staff",
  role: "Staff",
};

describe("Firestore browser-removal inventory API", () => {
  it("rejects invalid stock-in and stock-out quantities", async () => {
    const { controller } = inventoryHarness({ ITEM: { id: "ITEM", currentStock: 5 } });
    for (const qty of [0, -1, 1.5, "invalid"]) {
      const res = responseRecorder();
      await controller.stockIn({ params: { id: "ITEM" }, body: { qty }, user: managementUser }, res);
      expect(res.statusCode).toBe(400);
    }
  });

  it("rejects an excessive stock-out without creating a transaction", async () => {
    const { controller, records, transactions } = inventoryHarness({
      ITEM: { id: "ITEM", currentStock: 2 },
    });
    const res = responseRecorder();
    await controller.stockOut({ params: { id: "ITEM" }, body: { qty: 3 }, user: managementUser }, res);
    expect(res.statusCode).toBe(409);
    expect(records.get("ITEM").currentStock).toBe(2);
    expect(transactions.size).toBe(0);
  });

  it("updates stock and creates a transaction using the authenticated actor", async () => {
    const { controller, records, transactions } = inventoryHarness({
      ITEM: { id: "ITEM", currentStock: 5 },
    });
    const res = responseRecorder();
    await controller.stockOut({
      params: { id: "ITEM" },
      body: { qty: 2, staff: "Forged Browser Name", notes: "Used", predictionUpdates: { stockStatus: "Low", role: "Admin" } },
      user: managementUser,
    }, res);
    expect(res.statusCode).toBe(201);
    expect(records.get("ITEM")).toMatchObject({ currentStock: 3, stockStatus: "Low" });
    expect(records.get("ITEM").role).toBeUndefined();
    expect([...transactions.values()][0]).toMatchObject({
      type: "out",
      qty: 2,
      staff: "Authorized Staff",
      staffEmail: "staff@test.com",
    });
  });
});

describe("Inventory route authorization", () => {
  const handlers = Object.fromEntries([
    "listInventoryItems", "getInventoryItem", "createInventoryItem", "updateInventoryItem",
    "stockIn", "stockOut", "listInventoryTransactions",
  ].map((name) => [name, vi.fn()]));
  const router = loadWithMocks("../src/routes/inventoryRoutes", {
    "../src/controllers/inventoryController": handlers,
    "../src/middleware/authMiddleware": vi.fn((_req, _res, next) => next()),
  });
  const route = (path, method) => router.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods[method]
  ).route;
  const authorize = (path, method) => route(path, method).stack[0].handle;

  it("denies Public and Veterinarian inventory mutations", () => {
    for (const role of ["Public", "Veterinarian"]) {
      const res = responseRecorder();
      authorize("/:id/stock-out", "post")({ user: { role } }, res, vi.fn());
      expect(res.statusCode).toBe(403);
    }
  });

  it("allows Staff and Admin mutations and Veterinarian reads", () => {
    for (const role of ["Staff", "Admin"]) {
      const next = vi.fn();
      authorize("/:id/stock-in", "post")({ user: { role } }, responseRecorder(), next);
      expect(next).toHaveBeenCalledOnce();
    }
    const vetNext = vi.fn();
    authorize("/", "get")({ user: { role: "Veterinarian" } }, responseRecorder(), vetNext);
    expect(vetNext).toHaveBeenCalledOnce();
  });
});

describe("Email verification synchronization endpoint", () => {
  it("updates only verification metadata after Firebase identity verification", async () => {
    const update = vi.fn();
    const get = vi.fn(async () => snapshot({ firebaseUid: "uid-1", role: "Public", status: "Active" }, "user@test.com"));
    const db = { collection: vi.fn(() => ({ doc: vi.fn(() => ({ get, update })) })) };
    const verifyIdToken = vi.fn(async () => ({ uid: "uid-1" }));
    const getUser = vi.fn(async () => ({ uid: "uid-1", email: "User@Test.com", emailVerified: true }));
    const admin = {
      auth: () => ({ verifyIdToken, getUser }),
      firestore: { FieldValue: { serverTimestamp: () => "server-time" } },
    };
    const controller = loadWithMocks("../src/controllers/authController", {
      "../src/config/firebase": { db, admin },
      "nodemailer": { createTransport: vi.fn(() => ({})) },
    });
    const res = responseRecorder();
    await controller.syncEmailVerification({
      body: { firebaseIdToken: "valid", role: "Admin", status: "Active", permissions: ["all"] },
    }, res);
    expect(res.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith({ emailVerified: true, updatedAt: "server-time" });
  });
});

describe("Public adopted-story projection", () => {
  it("returns homepage fields without private animal fields", async () => {
    const animal = {
      status: "Adopted",
      species: "Dog",
      breed: "Mixed",
      sex: "Female",
      adoptedName: "Maya",
      photoURL: "safe.jpg",
      medicalRecords: [{ diagnosis: "private" }],
      archivedBy: "private@test.com",
    };
    const db = { collection: vi.fn(() => ({ get: vi.fn(async () => ({ docs: [{ id: "A-1", data: () => animal }] })) })) };
    const controller = loadWithMocks("../src/controllers/publicController", {
      "../src/config/firebase": { db, admin: {} },
      "../src/controllers/dashboardController": { invalidateAttentionCache: vi.fn() },
      "../src/services/notificationService": { createUserNotification: vi.fn(), createManagementNotification: vi.fn() },
      "nodemailer": { createTransport: vi.fn(() => ({})) },
    });
    const res = responseRecorder();
    await controller.getPublicAdoptedStories({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.stories).toHaveLength(1);
    expect(res.body.stories[0]).toMatchObject({ id: "A-1", species: "Dog", status: "Adopted" });
    expect(res.body.stories[0]).not.toHaveProperty("medicalRecords");
    expect(res.body.stories[0]).not.toHaveProperty("archivedBy");
  });
});
