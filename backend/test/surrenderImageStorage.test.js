const assert = require("node:assert/strict");
const test = require("node:test");
const { randomBytes } = require("node:crypto");
const sharp = require("sharp");
const { loadWithMocks } = require("../test-vitest/helpers/commonjs");
const imageService = loadWithMocks("../src/services/surrenderImageService", { sharp });

function controllerWithStorage(writes) {
  return loadWithMocks("../src/controllers/surrenderController", {
    "../src/config/firebase": {
      db: { collection: () => ({ doc: () => ({
        get: async () => ({ exists: false }),
        set: async (record) => {
          assert.ok(Buffer.byteLength(JSON.stringify(record)) < 1_048_576);
          writes.push(record);
        },
      }) }) },
    },
    "../src/services/surrenderImageService": imageService,
    "../src/services/surrenderNlpService": {
      buildFallbackAnalysis: () => ({ source: "test", urgencyLabel: "Low" }),
      analyzeSurrenderReason: async () => ({ source: "test" }),
    },
    "../src/services/notificationService": { createManagementNotification: async () => {} },
  }).createSurrenderRequest;
}

function requestFor(photo) {
  return {
    user: { email: "image-test@example.com", fullName: "Test Owner", role: "Public" },
    body: {
      owner: { contact: "09171234567", address: "Test Street", barangay: "Pampang", city: "Angeles City",
        identityDocuments: { front: photo, back: photo } },
      pet: { name: "Test Animal", species: "Dog", photoName: photo.name, photoType: photo.type, photoDataUrl: photo.dataUrl },
      surrenderReason: "Lilipat po kami at hindi maisama ang aso.",
      agreement: { agreedToTerms: true },
    },
  };
}

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test("older clients can submit three individually accepted photos exceeding the combined storage limit", async () => {
  const buffer = await sharp(randomBytes(900 * 700 * 3), { raw: { width: 900, height: 700, channels: 3 } })
    .jpeg({ quality: 70 }).toBuffer();
  const photo = { name: "photo.jpg", type: "image/jpeg", size: buffer.length, dataUrl: `data:image/jpeg;base64,${buffer.toString("base64")}` };
  assert.ok(photo.dataUrl.length <= 560000, "photo passes the existing individual ID limit");
  const req = requestFor(photo);
  assert.ok(Buffer.byteLength(JSON.stringify(req.body)) > 1_048_576, "reproduce the former combined-size failure");
  const writes = [];
  const res = response();
  await controllerWithStorage(writes)(req, res);
  assert.equal(res.statusCode, 201);
  assert.equal(writes.length, 1);
  const stored = writes[0];
  const images = [stored.owner.identityDocuments.front.dataUrl, stored.owner.identityDocuments.back.dataUrl, stored.pet.photoDataUrl];
  for (const dataUrl of images) {
    const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
    assert.ok(bytes.length <= imageService.MAX_STORED_IMAGE_BYTES);
    assert.equal((await sharp(bytes).metadata()).format, "jpeg");
  }
});

test("unreadable large images return an actionable error before storage", async () => {
  const writes = [];
  const res = response();
  await controllerWithStorage(writes)(requestFor({ name: "broken.jpg", type: "image/jpeg", dataUrl: `data:image/jpeg;base64,${Buffer.alloc(300000).toString("base64")}` }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "SURRENDER_IMAGE_PROCESSING_FAILED");
  assert.match(res.body.message, /front ID photo/);
  assert.equal(writes.length, 0);
});

test("excessive written details are rejected before the database write", async () => {
  const writes = [];
  const req = requestFor({ name: "tiny.png", type: "image/png", dataUrl: "data:image/png;base64,AAAA" });
  req.body.pet.vaccinationHistory = "Long details ".repeat(80000);
  const res = response();
  await controllerWithStorage(writes)(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "SURRENDER_REQUEST_TOO_LARGE");
  assert.equal(writes.length, 0);
});
