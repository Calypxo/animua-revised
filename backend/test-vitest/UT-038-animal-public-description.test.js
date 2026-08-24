const { loadWithMocks, responseRecorder, snapshot } = require("./helpers/commonjs");

const records = new Map();
const directUpdate = vi.fn();
const addAuditLog = vi.fn().mockResolvedValue();

const makeRef = (collectionName, id = "generated") => ({
  id,
  get: vi.fn(async () => snapshot(records.get(`${collectionName}/${id}`), id)),
  update: directUpdate,
});

const db = {
  collection: vi.fn((name) => ({
    doc: (id) => makeRef(name, id),
    add: addAuditLog,
  })),
};

const admin = {
  firestore: {
    FieldValue: {
      serverTimestamp: () => "timestamp",
    },
  },
};

const controller = loadWithMocks("../src/controllers/animalController", {
  "../src/config/firebase": { db, admin, bucket: {} },
});

const user = { email: "staff@test.com", fullName: "Staff User" };

describe("Animal public description", () => {
  beforeEach(() => {
    records.clear();
    directUpdate.mockReset();
    addAuditLog.mockClear();
  });

  it("saves a trimmed public description", async () => {
    records.set("animals/A", {
      status: "Ready",
      identifyingDescription: "Brown dog",
    });
    const res = responseRecorder();

    await controller.updateAnimal({
      params: { id: "A" },
      body: { publicDescription: "  Calm and affectionate.  " },
      user,
    }, res);

    expect(res.statusCode).toBe(200);
    expect(directUpdate).toHaveBeenCalledWith(expect.objectContaining({
      publicDescription: "Calm and affectionate.",
    }));
  });

  it("rejects descriptions longer than 600 characters", async () => {
    records.set("animals/A", {
      status: "Ready",
      identifyingDescription: "Brown dog",
    });
    const res = responseRecorder();

    await controller.updateAnimal({
      params: { id: "A" },
      body: { publicDescription: "x".repeat(601) },
      user,
    }, res);

    expect(res.statusCode).toBe(400);
    expect(directUpdate).not.toHaveBeenCalled();
  });
});
