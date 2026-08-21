const { loadWithMocks, responseRecorder, snapshot } = require("./helpers/commonjs");

const serverTimestamp = vi.fn(() => "server-time");
const admin = { firestore: { FieldValue: { serverTimestamp } } };

function storageServiceMock() {
  const getSignedReadUrl = vi.fn(async ({ path }) => path ? `https://signed.test/${path}` : "");
  const assertExpectedStoragePath = vi.fn((path, prefix) => {
    if (!String(path || "").startsWith(`${prefix}/`)) {
      const error = new Error("Stored image path does not belong to this record.");
      error.statusCode = 400;
      throw error;
    }
    return path;
  });
  return { getSignedReadUrl, assertExpectedStoragePath };
}

function animalHarness(animalData = { status: "Ready" }) {
  const update = vi.fn(async () => {});
  const files = new Map();
  const bucket = {
    name: "animua-ft.firebasestorage.app",
    file: vi.fn((path) => {
      if (!files.has(path)) {
        files.set(path, {
          path,
          save: vi.fn(async () => {}),
          delete: vi.fn(async () => {}),
        });
      }
      return files.get(path);
    }),
  };
  const reference = { get: vi.fn(async () => snapshot(animalData, "A-1")), update };
  const db = {
    collection: vi.fn(() => ({
      doc: vi.fn(() => reference),
      orderBy: vi.fn(() => ({
        get: vi.fn(async () => ({ docs: [{ id: "A-1", data: () => animalData }] })),
      })),
    })),
  };
  const signed = storageServiceMock();
  const controller = loadWithMocks("../src/controllers/animalController", {
    "../src/config/firebase": { db, admin, bucket },
    "../src/services/storageUrlService": signed,
  });
  return { controller, bucket, files, reference, update, signed };
}

function announcementHarness(announcementData = { status: "Draft", visibleToPublic: false }) {
  const update = vi.fn(async () => {});
  const remove = vi.fn(async () => {});
  const files = new Map();
  const bucket = {
    name: "animua-ft.firebasestorage.app",
    file: vi.fn((path) => {
      if (!files.has(path)) {
        files.set(path, {
          path,
          save: vi.fn(async () => {}),
          delete: vi.fn(async () => {}),
        });
      }
      return files.get(path);
    }),
  };
  const reference = {
    get: vi.fn(async () => snapshot(announcementData, "N-1")),
    update,
    delete: remove,
  };
  const db = {
    collection: vi.fn(() => ({
      doc: vi.fn(() => reference),
      get: vi.fn(async () => ({ docs: [{ id: "N-1", data: () => announcementData }] })),
    })),
  };
  const signed = storageServiceMock();
  const controller = loadWithMocks("../src/controllers/announcementController", {
    "../src/config/firebase": { db, admin, bucket },
    "../src/services/storageUrlService": signed,
    "../src/services/notificationService": { createNotificationForUsersBySetting: vi.fn() },
  });
  return { controller, bucket, files, reference, update, remove, signed };
}

describe("Private Cloud Storage signed URL service", () => {
  it("creates a read-only V4 URL that expires after 30 minutes", async () => {
    const getSignedUrl = vi.fn(async () => ["https://signed.test/animal"]);
    const storageBucket = {
      name: "animua-ft.firebasestorage.app",
      file: vi.fn(() => ({ getSignedUrl })),
    };
    const service = loadWithMocks("../src/services/storageUrlService", {
      "../src/config/firebase": { bucket: storageBucket },
    });
    const now = Date.UTC(2026, 7, 13);

    const result = await service.getSignedReadUrl({
      path: "animals/A-1/profile.jpg",
      expectedPrefix: "animals/A-1",
      storageBucket,
      now,
    });

    expect(result).toBe("https://signed.test/animal");
    expect(getSignedUrl).toHaveBeenCalledWith({
      action: "read",
      expires: now + 30 * 60 * 1000,
      version: "v4",
    });
  });

  it("supports same-bucket legacy URLs but rejects paths outside the record prefix", async () => {
    const getSignedUrl = vi.fn(async () => ["https://signed.test/legacy"]);
    const storageBucket = {
      name: "animua-ft.firebasestorage.app",
      file: vi.fn(() => ({ getSignedUrl })),
    };
    const service = loadWithMocks("../src/services/storageUrlService", {
      "../src/config/firebase": { bucket: storageBucket },
    });

    await expect(service.getSignedReadUrl({
      legacyUrl: "https://storage.googleapis.com/animua-ft.firebasestorage.app/animals/A-1/old.jpg",
      expectedPrefix: "animals/A-1",
      storageBucket,
    })).resolves.toBe("https://signed.test/legacy");
    expect(storageBucket.file).toHaveBeenCalledWith("animals/A-1/old.jpg");

    storageBucket.file.mockClear();
    await expect(service.getSignedReadUrl({
      path: "animals/A-2/private.jpg",
      expectedPrefix: "animals/A-1",
      storageBucket,
    })).resolves.toBe("");
    expect(storageBucket.file).not.toHaveBeenCalled();
  });
});

describe("Animal image privacy", () => {
  const managementUser = { role: "Staff", email: "staff@test.com" };

  it.each([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ])("uploads %s privately using a server-derived .%s extension", async (mimetype, extension) => {
    const { controller, bucket, files, update, signed } = animalHarness();
    const res = responseRecorder();
    await controller.uploadAnimalProfileImage({
      params: { id: "A-1" },
      file: {
        mimetype,
        originalname: "browser-controlled.exe",
        size: 10,
        buffer: Buffer.from("image"),
      },
      user: managementUser,
    }, res);

    expect(res.statusCode).toBe(200);
    const savedPath = bucket.file.mock.calls.find(([path]) => path.includes("profile-"))[0];
    expect(savedPath).toMatch(new RegExp(`^animals/A-1/profile-\\d+\\.${extension}$`));
    expect(files.get(savedPath).save).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({
      metadata: expect.objectContaining({ contentType: mimetype, cacheControl: "private, max-age=1800" }),
    }));
    expect(files.get(savedPath)).not.toHaveProperty("makePublic");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ photoPath: savedPath, photoURL: "" }));
    expect(signed.getSignedReadUrl).toHaveBeenCalledWith(expect.objectContaining({ path: savedPath }));
    expect(res.body.photoURL).toBe(`https://signed.test/${savedPath}`);
  });

  it.each([
    [{ mimetype: "image/gif", size: 10, buffer: Buffer.from("gif") }, /Only JPG/],
    [{ mimetype: "image/jpeg", size: 5 * 1024 * 1024 + 1, buffer: Buffer.from("large") }, /5 MB/],
  ])("rejects invalid animal uploads before writing Storage", async (file, message) => {
    const { controller, bucket, update } = animalHarness();
    const res = responseRecorder();
    await controller.uploadAnimalProfileImage({ params: { id: "A-1" }, file, user: managementUser }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(message);
    expect(bucket.file).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an animal deletion path outside that animal's folder", async () => {
    const { controller, bucket, update } = animalHarness({ photoPath: "animals/A-2/private.jpg" });
    const res = responseRecorder();
    await controller.deleteAnimalProfileImage({ params: { id: "A-1" }, user: managementUser }, res);
    expect(res.statusCode).toBe(400);
    expect(bucket.file).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("provides signed images to an authorized management animal view", async () => {
    const data = { status: "Quarantine", photoPath: "animals/A-1/internal.jpg" };
    const { controller, signed } = animalHarness(data);
    const res = responseRecorder();
    await controller.getAllAnimals({ query: {}, user: managementUser }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.animals[0].photoURL).toBe("https://signed.test/animals/A-1/internal.jpg");
    expect(res.body.animals[0]).not.toHaveProperty("photoPath");
    expect(signed.getSignedReadUrl).toHaveBeenCalledOnce();
  });
});

describe("Announcement image privacy", () => {
  const managementUser = { role: "Staff", email: "staff@test.com" };

  it("uploads an allowed cover privately and ignores the browser filename extension", async () => {
    const { controller, bucket, files, update, signed } = announcementHarness();
    const res = responseRecorder();
    await controller.uploadAnnouncementImage({
      params: { id: "N-1" },
      file: {
        mimetype: "image/webp",
        originalname: "fake.png.exe",
        size: 10,
        buffer: Buffer.from("image"),
      },
      user: managementUser,
    }, res);

    expect(res.statusCode).toBe(200);
    const savedPath = bucket.file.mock.calls.find(([path]) => path.includes("cover-"))[0];
    expect(savedPath).toMatch(/^announcements\/N-1\/cover-\d+\.webp$/);
    expect(files.get(savedPath).save).toHaveBeenCalled();
    expect(files.get(savedPath)).not.toHaveProperty("makePublic");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ imagePath: savedPath, imageUrl: "" }));
    expect(signed.getSignedReadUrl).toHaveBeenCalledWith(expect.objectContaining({ path: savedPath }));
  });

  it.each([
    [{ mimetype: "image/svg+xml", size: 10, buffer: Buffer.from("svg") }, /Only JPG/],
    [{ mimetype: "image/png", size: 5 * 1024 * 1024 + 1, buffer: Buffer.from("large") }, /5 MB/],
  ])("rejects invalid announcement uploads before writing Storage", async (file, message) => {
    const { controller, bucket, update } = announcementHarness();
    const res = responseRecorder();
    await controller.uploadAnnouncementImage({ params: { id: "N-1" }, file, user: managementUser }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(message);
    expect(bucket.file).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an announcement deletion path outside that announcement's folder", async () => {
    const { controller, bucket, update } = announcementHarness({
      imagePath: "announcements/N-2/private.jpg",
    });
    const res = responseRecorder();
    await controller.deleteAnnouncementImage({ params: { id: "N-1" }, user: managementUser }, res);
    expect(res.statusCode).toBe(400);
    expect(bucket.file).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("also rejects an unsafe cover path when deleting the announcement record", async () => {
    const { controller, bucket, remove } = announcementHarness({
      imagePath: "announcements/N-2/private.jpg",
    });
    const res = responseRecorder();
    await controller.deleteAnnouncement({
      params: { id: "N-1" },
      user: { role: "Admin", email: "admin@test.com" },
    }, res);
    expect(res.statusCode).toBe(400);
    expect(bucket.file).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("provides a signed draft cover to an authorized management user", async () => {
    const { controller, signed } = announcementHarness({
      status: "Draft",
      visibleToPublic: false,
      imagePath: "announcements/N-1/draft.jpg",
    });
    const res = responseRecorder();
    await controller.getAllAnnouncements({ user: managementUser }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.announcements[0].imageUrl).toBe("https://signed.test/announcements/N-1/draft.jpg");
    expect(res.body.announcements[0]).not.toHaveProperty("imagePath");
    expect(signed.getSignedReadUrl).toHaveBeenCalledOnce();
  });
});

describe("Public visibility is checked before signing", () => {
  it("signs only animals already eligible for the public pet list", async () => {
    const docs = [
      { id: "READY", data: () => ({ status: "Ready", photoPath: "animals/READY/photo.jpg" }) },
      { id: "INTERNAL", data: () => ({ status: "Quarantine", photoPath: "animals/INTERNAL/photo.jpg" }) },
    ];
    const db = { collection: vi.fn(() => ({ get: vi.fn(async () => ({ docs })) })) };
    const signed = storageServiceMock();
    const controller = loadWithMocks("../src/controllers/publicController", {
      "../src/config/firebase": { db, admin },
      "../src/services/storageUrlService": signed,
      "../src/controllers/dashboardController": { invalidateAttentionCache: vi.fn() },
      "../src/services/notificationService": { createUserNotification: vi.fn(), createManagementNotification: vi.fn() },
      "nodemailer": { createTransport: vi.fn(() => ({})) },
    });
    const res = responseRecorder();
    await controller.getPublicPets({ query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.pets.map((pet) => pet.id)).toEqual(["READY"]);
    expect(signed.getSignedReadUrl).toHaveBeenCalledOnce();
    expect(signed.getSignedReadUrl).toHaveBeenCalledWith(expect.objectContaining({
      path: "animals/READY/photo.jpg",
    }));
  });

  it("does not sign an internal animal requested through the public detail endpoint", async () => {
    const internal = { status: "Quarantine", photoPath: "animals/INTERNAL/photo.jpg" };
    const db = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({ get: vi.fn(async () => snapshot(internal, "INTERNAL")) })),
      })),
    };
    const signed = storageServiceMock();
    const controller = loadWithMocks("../src/controllers/publicController", {
      "../src/config/firebase": { db, admin },
      "../src/services/storageUrlService": signed,
      "../src/controllers/dashboardController": { invalidateAttentionCache: vi.fn() },
      "../src/services/notificationService": { createUserNotification: vi.fn(), createManagementNotification: vi.fn() },
      "nodemailer": { createTransport: vi.fn(() => ({})) },
    });
    const res = responseRecorder();
    await controller.getPublicPetById({ params: { id: "INTERNAL" } }, res);
    expect(res.statusCode).toBe(404);
    expect(signed.getSignedReadUrl).not.toHaveBeenCalled();
  });

  it("signs only published, public announcements", async () => {
    const docs = [
      { id: "PUBLIC", data: () => ({ status: "Published", visibleToPublic: true, imagePath: "announcements/PUBLIC/cover.jpg" }) },
      { id: "DRAFT", data: () => ({ status: "Draft", visibleToPublic: true, imagePath: "announcements/DRAFT/cover.jpg" }) },
      { id: "HIDDEN", data: () => ({ status: "Published", visibleToPublic: false, imagePath: "announcements/HIDDEN/cover.jpg" }) },
    ];
    const db = { collection: vi.fn(() => ({ get: vi.fn(async () => ({ docs })) })) };
    const signed = storageServiceMock();
    const controller = loadWithMocks("../src/controllers/announcementController", {
      "../src/config/firebase": { db, admin, bucket: {} },
      "../src/services/storageUrlService": signed,
      "../src/services/notificationService": { createNotificationForUsersBySetting: vi.fn() },
    });
    const res = responseRecorder();
    await controller.getPublicAnnouncements({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.announcements.map((item) => item.id)).toEqual(["PUBLIC"]);
    expect(signed.getSignedReadUrl).toHaveBeenCalledOnce();
    expect(signed.getSignedReadUrl).toHaveBeenCalledWith(expect.objectContaining({
      path: "announcements/PUBLIC/cover.jpg",
    }));
  });
});

describe("Existing image-route role authorization", () => {
  const invoke = (middleware, role) => {
    const next = vi.fn();
    const res = responseRecorder();
    middleware({ user: { role } }, res, next);
    return { next, res };
  };

  it("keeps animal image changes limited to Admin and Staff", () => {
    const handlers = { uploadAnimalProfileImage: vi.fn(), deleteAnimalProfileImage: vi.fn() };
    const router = loadWithMocks("../src/routes/animalRoutes", {
      "../src/controllers/animalController": new Proxy(handlers, { get: (target, key) => target[key] || vi.fn() }),
      "../src/middleware/authMiddleware": vi.fn(),
      "../src/middleware/uploadAnimalImage": vi.fn(),
    });
    const route = router.stack.find((layer) => layer.route?.path === "/:id/photo" && layer.route.methods.patch).route;
    const authorize = route.stack[0].handle;
    expect(invoke(authorize, "Admin").next).toHaveBeenCalledOnce();
    expect(invoke(authorize, "Staff").next).toHaveBeenCalledOnce();
    expect(invoke(authorize, "Veterinarian").res.statusCode).toBe(403);
  });

  it("keeps management announcement images limited to management roles", () => {
    const router = loadWithMocks("../src/routes/announcementRoutes", {
      "../src/controllers/announcementController": new Proxy({}, { get: () => vi.fn() }),
      "../src/middleware/authMiddleware": vi.fn(),
      "../src/middleware/uploadAnnouncementImage": vi.fn(),
    });
    const route = router.stack.find((layer) => layer.route?.path === "/:id/image" && layer.route.methods.patch).route;
    const authorize = route.stack[1].handle;
    for (const role of ["Admin", "Staff", "Veterinarian"]) {
      expect(invoke(authorize, role).next).toHaveBeenCalledOnce();
    }
    expect(invoke(authorize, "Public").res.statusCode).toBe(403);
  });
});
