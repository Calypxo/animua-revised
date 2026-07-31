const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PYTHON_SENTIMENT_API_URL,
  analyzeSurrenderReason,
  buildFallbackAnalysis,
} = require("../src/services/surrenderNlpService");

test("uses port 8002 for surrender sentiment by default", () => {
  assert.equal(
    PYTHON_SENTIMENT_API_URL,
    "http://127.0.0.1:8002/analyze-surrender-sentiment"
  );
});

test("returns a valid Tagalog service response unchanged", async () => {
  const expected = {
    sentiment: "Neutral",
    category: "Relocation",
    urgencyLabel: "Low",
    urgencyScore: 25,
    confidence: 0.96,
    keywords: ["aalis"],
    suggestedPriority: "Normal Priority",
    source: "Tagalog RoBERTa Transformer",
  };
  const result = await analyzeSurrenderReason("Aalis po kami.", async () => ({
    ok: true,
    json: async () => expected,
  }));
  assert.deepEqual(result, expected);
});

test("service outage does not block a surrender submission", async () => {
  const result = await analyzeSurrenderReason(
    "May sakit at dumudugo ang aso. Kailangan ng agarang gamutan.",
    async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:8002");
    }
  );

  assert.equal(result.source, "Node fallback (Tagalog sentiment service unavailable)");
  assert.equal(result.category, "Medical");
  assert.equal(result.urgencyLabel, "Critical");
  assert.equal(result.urgencyScore, 95);
});

test("fallback preserves the surrender NLP response shape", () => {
  const result = buildFallbackAnalysis("Wala na akong trabaho at pagkain ng aso.");
  assert.deepEqual(Object.keys(result).sort(), [
    "category",
    "confidence",
    "keywords",
    "sentiment",
    "source",
    "suggestedPriority",
    "urgencyLabel",
    "urgencyScore",
  ]);
  assert.equal(result.category, "Financial");
});
