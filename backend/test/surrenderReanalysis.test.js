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

const robertaAnalysis = {
  sentiment: "Neutral",
  category: "Relocation",
  urgencyLabel: "Low",
  urgencyScore: 25,
  confidence: 0.96,
  keywords: ["aalis"],
  suggestedPriority: "Normal Priority",
  source: "Tagalog RoBERTa Transformer",
};
let currentAnalysis = robertaAnalysis;

const requestUpdate = mockFunction(async () => undefined);
const requestGet = mockFunction(async () => ({
  exists: true,
  data: () => ({ surrenderReason: "Aalis po kami papuntang ibang bansa." }),
}));
const db = {
  collection: mockFunction(() => ({
    doc: mockFunction(() => ({
      get: requestGet,
      update: requestUpdate,
    })),
  })),
};

const { reanalyzeSurrenderRequest } = loadWithMocks("../src/controllers/surrenderController", {
  sharp: mockFunction(),
  "../src/config/firebase": { db },
  "../src/services/surrenderNlpService": {
    analyzeSurrenderReason: mockFunction(async () => currentAnalysis),
    buildFallbackAnalysis: mockFunction(),
  },
  "../src/services/requestDeadlineService": {
    buildApprovalDeadlineFields: mockFunction(),
    reconcileRequestDeadlines: mockFunction(),
    validateScheduleDate: mockFunction(),
  },
  "../src/services/notificationService": {
    createUserNotification: mockFunction(),
    createManagementNotification: mockFunction(),
  },
  "../src/services/surrenderWorkflowService": {
    isDirectSurrenderStatusAllowed: mockFunction(() => true),
  },
});

test("management can replace a stored fallback with Tagalog RoBERTa analysis", async () => {
  currentAnalysis = robertaAnalysis;
  const res = responseRecorder();

  await reanalyzeSurrenderRequest(
    { user: { role: "Admin" }, params: { id: "SR-2026-ROBERTA" } },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.nlp.source, "Tagalog RoBERTa Transformer");
  assert.equal(requestUpdate.mock.calls.at(-1)[0].nlp.source, "Tagalog RoBERTa Transformer");
});

test("a failed rerun keeps the stored analysis and asks management to retry", async () => {
  const updateCount = requestUpdate.mock.calls.length;
  currentAnalysis = {
    ...robertaAnalysis,
    confidence: 0,
    source: "Node fallback (Tagalog sentiment service unavailable)",
  };
  const res = responseRecorder();

  await reanalyzeSurrenderRequest(
    { user: { role: "Staff" }, params: { id: "SR-2026-ROBERTA" } },
    res
  );

  assert.equal(res.statusCode, 503);
  assert.match(res.body.message, /retry shortly/i);
  assert.equal(requestUpdate.mock.calls.length, updateCount);
});
