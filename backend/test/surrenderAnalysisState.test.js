const test = require("node:test");
const assert = require("node:assert/strict");
const { getSurrenderAnalysisState } = require("../src/services/surrenderAnalysisState");
const { loadWithMocks } = require("../test-vitest/helpers/commonjs");

const now = Date.parse("2026-09-15T01:00:00Z");
test("cold-start analysis is pending; interrupted or old attempts become retryable", () => {
  const record = { createdAt: new Date(now - 60_000).toISOString(), nlp: { source: "Local rules (RoBERTa analysis pending)" }, nlpStatus: "pending" };
  assert.equal(getSurrenderAnalysisState(record, now), "pending");
  assert.equal(getSurrenderAnalysisState(record, now + 150_000), "fallback");
  assert.equal(getSurrenderAnalysisState({ ...record, nlpStatus: "fallback" }, now), "fallback");
  assert.equal(getSurrenderAnalysisState({ ...record, nlp: { source: "Node fallback (Tagalog sentiment service unavailable)" } }, now), "pending");
  assert.equal(getSurrenderAnalysisState({ nlp: record.nlp }, now), "fallback");
});

test("a completed model result takes precedence over a late background failure", () => {
  assert.equal(getSurrenderAnalysisState({ nlpStatus: "fallback", nlp: { source: "Tagalog RoBERTa Transformer" } }, now), "completed");
});

const reads = [];
const controller = loadWithMocks("../src/controllers/surrenderController", {
  "../src/config/firebase": { db: {
    collection: () => ({ doc: id => ({ id }) }),
    getAll: async (...args) => {
      reads.push(args);
      return [{ id: "SR-1", exists: true, data: () => ({ nlp: { source: "Tagalog RoBERTa Transformer" }, nlpAnalyzedAt: "2026-09-15T01:00:00Z", owner: { email: "private@example.com" }, surrenderReason: "Private reason" }) }, { id: "SR-missing", exists: false }];
    },
  } },
});
const response = () => ({ statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, set(name, value) { this.headers[name] = value; return this; }, json(body) { this.body = body; return this; } });

test("analysis refresh reads only model fields and returns no owner data or reason", async () => {
  const res = response();
  await controller.getSurrenderAnalysisStatuses({ query: { ids: "SR-1,SR-missing" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.deepEqual(reads.at(-1).at(-1), { fieldMask: ["nlp", "nlpStatus", "nlpRequestedAt", "nlpAnalyzedAt", "createdAt"] });
  assert.deepEqual(res.body.requests, [{ id: "SR-1", nlp: { source: "Tagalog RoBERTa Transformer" }, nlpStatus: "completed", nlpAnalyzedAt: "2026-09-15T01:00:00Z" }]);
});

test("analysis refresh rejects invalid or excessive IDs without database reads", async () => {
  const before = reads.length;
  for (const ids of ["", "../users", Array.from({ length: 31 }, (_, i) => `SR-${i}`).join(",")]) {
    const res = response();
    await controller.getSurrenderAnalysisStatuses({ query: { ids } }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(reads.length, before);
});
