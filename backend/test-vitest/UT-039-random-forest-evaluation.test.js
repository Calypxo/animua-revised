const {
  buildStratifiedFolds,
  calculateMetrics,
  createSeededRandom,
  summarizeFolds,
} = require("../scripts/evaluateRandomForest");

const row = (id, label) => ({ id, "Movement Label": label });

describe("UT-039 — Random Forest Evaluation Metrics", () => {
  it("creates deterministic stratified folds without losing or duplicating rows", () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, index) => row(`F-${index}`, "Fast")),
      ...Array.from({ length: 15 }, (_, index) => row(`S-${index}`, "Slow")),
    ];

    const first = buildStratifiedFolds(rows, 5, 42);
    const second = buildStratifiedFolds(rows, 5, 42);

    expect(first).toEqual(second);
    expect(first).toHaveLength(5);
    for (const fold of first) {
      expect(fold.filter((item) => item["Movement Label"] === "Fast")).toHaveLength(2);
      expect(fold.filter((item) => item["Movement Label"] === "Slow")).toHaveLength(3);
    }
    expect(new Set(first.flat().map((item) => item.id)).size).toBe(rows.length);
  });

  it("reports unavailable predictions as errors in accuracy, recall, and coverage", () => {
    const metrics = calculateMetrics([
      { actual: "Fast", predicted: "Fast" },
      { actual: "Fast", predicted: "Slow" },
      { actual: "Slow", predicted: "Slow" },
      { actual: "Slow", predicted: "Unavailable" },
    ]);

    expect(metrics).toMatchObject({
      total: 4,
      correct: 2,
      available: 3,
      unavailable: 1,
      coverage: 0.75,
      accuracy: 0.5,
      balancedAccuracy: 0.5,
    });
    expect(metrics.perClass.Fast).toMatchObject({
      precision: 1,
      recall: 0.5,
      f1: 0.666667,
    });
    expect(metrics.perClass.Slow).toMatchObject({
      precision: 0.5,
      recall: 0.5,
      f1: 0.5,
    });
    expect(metrics.confusionMatrix.rows).toEqual([
      { actual: "Fast", Fast: 1, Slow: 1, Unavailable: 0 },
      { actual: "Slow", Fast: 0, Slow: 1, Unavailable: 1 },
    ]);
  });

  it("summarizes fold metrics using reproducible population statistics", () => {
    const summary = summarizeFolds([
      {
        accuracy: 1,
        balancedAccuracy: 0.9,
        coverage: 1,
        macro: { f1: 0.8 },
      },
      {
        accuracy: 0.5,
        balancedAccuracy: 0.7,
        coverage: 0.75,
        macro: { f1: 0.6 },
      },
    ]);

    expect(summary.accuracy).toEqual({
      mean: 0.75,
      standardDeviation: 0.25,
      minimum: 0.5,
      maximum: 1,
    });
    expect(summary.macroF1).toEqual({
      mean: 0.7,
      standardDeviation: 0.1,
      minimum: 0.6,
      maximum: 0.8,
    });
  });

  it("generates the same pseudo-random sequence for the same seed", () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });
});
