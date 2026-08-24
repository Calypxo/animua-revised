const { loadWithMocks, responseRecorder } = require("./helpers/commonjs");

const publicRef = { id: "PUBLIC" };
const managementRef = { id: "MANAGEMENT" };
const notificationDocs = [
  {
    id: "PUBLIC",
    ref: publicRef,
    data: () => ({
      userEmail: "admin@test.com",
      category: "application",
      title: "Application updated",
      read: false,
      createdAt: "2026-08-24T10:00:00.000Z",
    }),
  },
  {
    id: "MANAGEMENT",
    ref: managementRef,
    data: () => ({
      userEmail: "admin@test.com",
      category: "management",
      title: "New surrender request received",
      read: false,
      createdAt: "2026-08-24T11:00:00.000Z",
    }),
  },
];

const notificationQuery = {
  where: vi.fn(function where() { return this; }),
  get: vi.fn(async () => ({ docs: notificationDocs, size: notificationDocs.length })),
};
const batchUpdate = vi.fn();
const batchCommit = vi.fn(async () => {});
const db = {
  collection: vi.fn((name) => {
    if (name === "notifications") return notificationQuery;
    if (name === "users") {
      return { doc: () => ({ get: vi.fn(async () => ({ exists: true, data: () => ({ notificationSettings: {} }) })) }) };
    }
    if (name === "events") {
      return {
        get: vi.fn(async () => ({
          docs: [{
            id: "EVENT",
            data: () => ({ type: "Event", title: "Vaccination drive", published: true, createdAt: "2026-08-24T09:00:00.000Z" }),
          }],
        })),
      };
    }
    return { get: vi.fn(async () => ({ docs: [] })) };
  }),
  batch: vi.fn(() => ({ update: batchUpdate, commit: batchCommit })),
};
const controller = loadWithMocks("../src/controllers/notificationController", {
  "../src/config/firebase": {
    db,
    admin: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } },
  },
  "../src/services/notificationService": {
    normalizeNotificationSettings: () => ({
      applicationUpdates: true,
      surrenderRequestUpdates: true,
      announcementsEvents: true,
    }),
  },
  "../src/services/pushNotificationService": {
    normalizeToken: vi.fn(),
    registerPushSubscription: vi.fn(),
    unregisterPushSubscription: vi.fn(),
  },
});

describe("Notification audience separation", () => {
  beforeEach(() => {
    notificationQuery.where.mockClear();
    notificationQuery.get.mockClear();
    batchUpdate.mockClear();
    batchCommit.mockClear();
  });

  it("keeps management alerts out of the public inbox while preserving public updates and events", async () => {
    const res = responseRecorder();
    await controller.getMyNotifications({
      user: { email: "admin@test.com", role: "Admin" },
      query: { audience: "public" },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.notifications.map((item) => item.id)).toEqual(["PUBLIC", "event-EVENT"]);
    expect(res.body.notifications.some((item) => item.category === "management")).toBe(false);
    expect(res.body.unreadCount).toBe(1);
  });

  it("returns only management alerts to the management attention center", async () => {
    const res = responseRecorder();
    await controller.getMyNotifications({
      user: { email: "admin@test.com", role: "Admin" },
      query: { audience: "management" },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.notifications.map((item) => item.id)).toEqual(["MANAGEMENT"]);
    expect(res.body.unreadCount).toBe(1);
  });

  it("marks only public notifications read from the public portal", async () => {
    const res = responseRecorder();
    await controller.markMyNotificationsRead({
      user: { email: "admin@test.com", role: "Admin" },
      query: { audience: "public" },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.updated).toBe(1);
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    expect(batchUpdate).toHaveBeenCalledWith(publicRef, expect.any(Object));
    expect(batchUpdate).not.toHaveBeenCalledWith(managementRef, expect.any(Object));
  });
});
