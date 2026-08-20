const { analyzeSurrenderReason, buildFallbackAnalysis, isValidAnalysis } = require("../src/services/surrenderNlpService");

describe("UT-013 — Node Surrender NLP", () => {
  it("Scenario 1 — returns a valid Relocation response unchanged", async () => {
    const expected = { sentiment: "Neutral", category: "Relocation", urgencyLabel: "Low", urgencyScore: 25, confidence: .96, keywords: ["aalis"], suggestedPriority: "Normal Priority", source: "Tagalog RoBERTa Transformer" };
    await expect(analyzeSurrenderReason("Aalis po kami.", async () => ({ ok: true, json: async () => expected }))).resolves.toEqual(expected);
  });
  it("Scenario 2 — produces Medical Critical 95 when the service throws", async () => {
    const result = await analyzeSurrenderReason("May sakit at dumudugo; agarang gamutan.", async () => { throw new Error("offline"); });
    expect(result).toMatchObject({ category: "Medical", urgencyLabel: "Critical", urgencyScore: 95 });
  });
  it("Scenario 3 — rejects a response missing a required field and uses fallback", async () => {
    const invalid = { sentiment: "Neutral", category: "Other", urgencyLabel: "Low", urgencyScore: 25 };
    expect(isValidAnalysis(invalid)).toBe(false);
    const result = await analyzeSurrenderReason("Ordinary reason", async () => ({ ok: true, json: async () => invalid }));
    expect(result.source).toMatch(/Node fallback/);
  });
  it("Scenario 4 — maps job-loss wording to Financial Medium 55", () => {
    expect(buildFallbackAnalysis("Wala na akong trabaho at hindi ko na kayang tustusan ang alaga.")).toMatchObject({ category: "Financial", urgencyLabel: "Medium", urgencyScore: 55 });
  });
  it("Scenario 5 — medical category and emergency urgency take precedence over relocation", () => {
    expect(buildFallbackAnalysis("Aalis kami pero dumudugo ang aso.")).toMatchObject({ category: "Medical", urgencyLabel: "Critical", urgencyScore: 95 });
  });
});
