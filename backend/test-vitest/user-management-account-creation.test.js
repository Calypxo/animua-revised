const { loadWithMocks, responseRecorder, snapshot } = require("./helpers/commonjs");

const getUserByEmail = vi.fn();
const createAuthUser = vi.fn();
const deleteAuthUser = vi.fn();
const getUserDocument = vi.fn();
const createUserDocument = vi.fn();
const addAudit = vi.fn();

const userRef = {
  get: getUserDocument,
  create: createUserDocument,
};

const db = {
  collection: vi.fn((name) => {
    if (name === "users") return { doc: vi.fn(() => userRef) };
    if (name === "auditLogs") return { add: addAudit };
    throw new Error(`Unexpected collection: ${name}`);
  }),
};

const auth = {
  getUserByEmail,
  createUser: createAuthUser,
  deleteUser: deleteAuthUser,
};

const controller = loadWithMocks("../src/controllers/userController", {
  "../src/config/firebase": {
    db,
    admin: {
      auth: () => auth,
      firestore: { FieldValue: { serverTimestamp: () => "timestamp" } },
    },
  },
});

const request = () => ({
  body: {
    firstName: "Managed",
    lastName: "User",
    email: "Managed.User@example.test",
    password: "not-a-real-production-secret",
    role: "Staff",
    status: "Active",
  },
  user: { email: "admin@example.test", fullName: "Admin User" },
});

describe("User Management account creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserDocument.mockResolvedValue(snapshot(undefined));
    getUserByEmail.mockRejectedValue({ code: "auth/user-not-found" });
    createAuthUser.mockResolvedValue({ uid: "firebase-uid-1" });
    createUserDocument.mockResolvedValue();
    addAudit.mockResolvedValue();
    deleteAuthUser.mockResolvedValue();
  });

  it("creates Firebase Auth before the matching Firestore user document", async () => {
    const res = responseRecorder();
    await controller.createUser(request(), res);

    expect(res.statusCode).toBe(201);
    expect(createAuthUser).toHaveBeenCalledWith(expect.objectContaining({
      email: "managed.user@example.test",
      displayName: "Managed User",
      emailVerified: true,
      disabled: false,
    }));
    expect(createUserDocument).toHaveBeenCalledWith(expect.objectContaining({
      email: "managed.user@example.test",
      firebaseUid: "firebase-uid-1",
      role: "Staff",
      status: "Active",
    }));
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("deletes the newly created Auth identity when the Firestore create fails", async () => {
    createUserDocument.mockRejectedValueOnce(new Error("write failed"));
    const res = responseRecorder();
    await controller.createUser(request(), res);

    expect(res.statusCode).toBe(500);
    expect(deleteAuthUser).toHaveBeenCalledWith("firebase-uid-1");
  });

  it("returns a duplicate response without creating Firestore data", async () => {
    getUserByEmail.mockResolvedValueOnce({ uid: "existing-uid" });
    const res = responseRecorder();
    await controller.createUser(request(), res);

    expect(res.statusCode).toBe(409);
    expect(createAuthUser).not.toHaveBeenCalled();
    expect(createUserDocument).not.toHaveBeenCalled();
  });
});
