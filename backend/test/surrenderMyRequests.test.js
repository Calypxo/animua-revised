const assert = require("node:assert/strict");
const test = require("node:test");
const { loadWithMocks, responseRecorder } = require("../test-vitest/helpers/commonjs");

function mockFunction(implementation = () => undefined) {
  const calls = [];
  const wrapped = function wrappedMock(...args) {
    calls.push(args);
    return implementation.apply(this, args);
  };
  wrapped.mock = { calls };
  return wrapped;
}

global.vi = { fn: mockFunction };

const uploadedPhoto = "data:image/png;base64,QU5JTVVB";
const renderedThumbnail = "data:image/webp;base64,dGh1bWJuYWls";
const records = [
  {
    docId: "SR-2026-002",
    data: {
      account: { email: "owner@example.com" },
      pet: { name: "Miming", species: "Cat", photoDataUrl: uploadedPhoto },
      submittedAt: "2026-08-25",
      createdAt: "2026-08-25T09:00:00.000Z",
      status: "Pending",
    },
  },
  {
    docId: "SR-2026-001",
    data: {
      id: "SR-2026-001",
      account: { email: "owner@example.com" },
      pet: { name: "Brown", species: "Dog", photoDataUrl: uploadedPhoto },
      submittedAt: "2026-08-24",
      createdAt: "2026-08-24T09:00:00.000Z",
      status: "Approved",
    },
  },
];

const getRequests = mockFunction(async () => ({
  docs: records.map((record) => ({
    id: record.docId,
    data: () => record.data,
  })),
}));

const db = {
  collection: mockFunction(() => ({
    where: mockFunction(() => ({ get: getRequests })),
  })),
};

function sharpMock() {
  return {
    rotate() { return this; },
    resize() { return this; },
    webp() { return this; },
    async toBuffer() { return Buffer.from("thumbnail"); },
  };
}

const reconcileRequestDeadlines = mockFunction(async () => undefined);
const { getMySurrenderRequests } = loadWithMocks("../src/controllers/surrenderController", {
  sharp: sharpMock,
  "../src/config/firebase": { db },
  "../src/services/surrenderNlpService": { analyzeSurrenderReason: mockFunction() },
  "../src/services/requestDeadlineService": {
    buildApprovalDeadlineFields: mockFunction(),
    reconcileRequestDeadlines,
    validateScheduleDate: mockFunction(),
  },
  "../src/services/notificationService": {
    createUserNotification: mockFunction(),
    createManagementNotification: mockFunction(),
  },
});

test("my surrender requests resolve complete records, photos, and Firestore IDs", async () => {
  const res = responseRecorder();

  await getMySurrenderRequests({ user: { email: "owner@example.com" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.requests.length, 2);
  assert.deepEqual(
    res.body.requests.map((request) => request.id),
    ["SR-2026-002", "SR-2026-001"],
  );
  assert.deepEqual(
    res.body.requests.map((request) => request.pet.name),
    ["Miming", "Brown"],
  );
  assert.equal(res.body.requests[0].submittedAt, "2026-08-25");
  assert.equal(res.body.requests[0].pet.photoDataUrl, renderedThumbnail);
  assert.equal(reconcileRequestDeadlines.mock.calls.length, 1);
});
