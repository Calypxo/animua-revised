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

const requestWrite = mockFunction(async () => undefined);
const requestUpdate = mockFunction(async () => undefined);
const settingsRead = mockFunction(async () => ({ exists: false, data: () => ({}) }));

const db = {
  collection: mockFunction((name) => ({
    doc: mockFunction(() => ({
      get: name === "surrenderSettings" ? settingsRead : mockFunction(),
      set: requestWrite,
      update: requestUpdate,
    })),
  })),
};

const fallbackAnalysis = {
  sentiment: "Neutral",
  category: "Relocation",
  urgencyLabel: "Low",
  urgencyScore: 25,
  confidence: 0,
  keywords: ["lilipat"],
  suggestedPriority: "Normal Priority",
  source: "Node fallback (Tagalog sentiment service unavailable)",
};
const BACKGROUND_DELAY_MS = 150;
const analyzeSurrenderReason = mockFunction(() => new Promise((resolve) => {
  setTimeout(() => resolve(fallbackAnalysis), BACKGROUND_DELAY_MS);
}));
const createManagementNotification = mockFunction(() => new Promise((resolve) => {
  setTimeout(() => resolve(1), BACKGROUND_DELAY_MS);
}));

const { createSurrenderRequest } = loadWithMocks("../src/controllers/surrenderController", {
  sharp: mockFunction(),
  "../src/config/firebase": { db },
  "../src/services/surrenderNlpService": {
    analyzeSurrenderReason,
    buildFallbackAnalysis: mockFunction(() => fallbackAnalysis),
  },
  "../src/services/requestDeadlineService": {
    buildApprovalDeadlineFields: mockFunction(),
    reconcileRequestDeadlines: mockFunction(),
    validateScheduleDate: mockFunction(),
  },
  "../src/services/notificationService": {
    createUserNotification: mockFunction(),
    createManagementNotification,
  },
});

test("surrender submission responds without waiting for remote analysis or notifications", async () => {
  const image = "data:image/png;base64,QU5JTVVB";
  const req = {
    user: {
      email: "owner@example.com",
      fullName: "Public Owner",
      role: "Public",
    },
    body: {
      id: "SR-2026-FAST01",
      account: { name: "Public Owner" },
      owner: {
        contact: "09171234567",
        address: "123 Sample Street",
        barangay: "Pampang",
        city: "Angeles City",
        identityDocuments: {
          front: { name: "front.png", type: "image/png", size: 6, dataUrl: image },
          back: { name: "back.png", type: "image/png", size: 6, dataUrl: image },
        },
      },
      pet: { name: "Bantay", species: "Dog" },
      surrenderReason: "Lilipat po kami at hindi maisama ang aso.",
      agreement: { agreedToTerms: true },
    },
  };
  const res = responseRecorder();

  const result = await Promise.race([
    createSurrenderRequest(req, res),
    new Promise((_, reject) => setTimeout(() => reject(new Error("submission waited on background work")), 50)),
  ]);

  assert.equal(result, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.request.id, "SR-2026-FAST01");
  assert.deepEqual(res.body.request.nlp, fallbackAnalysis);
  assert.equal(requestWrite.mock.calls.length, 1);
  assert.equal(analyzeSurrenderReason.mock.calls.length, 1);
  assert.equal(createManagementNotification.mock.calls.length, 1);
});
