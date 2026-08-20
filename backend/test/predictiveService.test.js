const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPredictionInputFromLiveItem,
} = require("../src/utils/predictiveUtils");
const {
  predictLiveInventoryItems,
  trainInventoryModel,
  getModelStatus,
} = require("../src/services/predictiveService");

function liveItem(overrides = {}) {
  return {
    id: "INV-001",
    name: "Test item",
    category: "Consumable",
    unit: "pcs",
    currentStock: 20,
    averageInventory: 40,
    avgMonthlyUsage: 10,
    recencyDays: 4,
    leadTimeDays: 7,
    stockoutFrequency: 1,
    monthlyTurnoverRatio: 0.25,
    ...overrides,
  };
}

const classifier = {
  predict(rows) {
    return rows.map((row) => row["Current Stock"] < 10 ? "Fast" : "Slow");
  },
};

test("a valid live inventory record produces a keyed prediction", () => {
  const result = predictLiveInventoryItems([liveItem()], {
    classifier,
    trainedTrees: [{}],
  });
  assert.equal(result.source, "live-inventory");
  assert.equal(result.predictedCount, 1);
  assert.deepEqual(result.items[0], {
    index: 0,
    itemId: "INV-001",
    itemDescription: "Test item",
    unit: "pcs",
    actualCurrentStock: 20,
    predictedMovement: "Slow",
    predictionAvailable: true,
    predictionSource: "random-forest",
    derivedFeatures: [],
    stockoutRiskPercent: 8,
    daysToStockout: 60,
    isAlert: false,
  });
});

test("live prediction aggregates valid tree votes when one tree cannot traverse the item", () => {
  const result = predictLiveInventoryItems([liveItem()], {
    classifier: {
      predict() {
        throw new Error("the forest-level fallback must not run");
      },
    },
    trainedTrees: [
      { predict: () => "Slow" },
      { predict: () => { throw new Error("missing categorical child"); } },
      { predict: () => "Slow" },
    ],
  });

  assert.equal(result.predictedCount, 1);
  assert.equal(result.items[0].predictedMovement, "Slow");
});

test("optional display fields may be missing and turnover is transparently derived", () => {
  const item = liveItem({ name: undefined, unit: undefined, monthlyTurnoverRatio: undefined });
  const input = buildPredictionInputFromLiveItem(item);
  assert.equal(input.itemDescription, "");
  assert.equal(input.unit, "");
  assert.equal(input.row["Monthly Turnover Ratio"], 0.25);
  assert.deepEqual(input.derivedFeatures, ["Monthly Turnover Ratio"]);
});

test("invalid numeric model features return an item-level unavailable result", () => {
  const result = predictLiveInventoryItems(
    [liveItem({ currentStock: "not-a-number" })],
    { classifier, trainedTrees: [{}] }
  );
  assert.equal(result.predictedCount, 0);
  assert.equal(result.unavailableCount, 1);
  assert.equal(result.items[0].itemId, "INV-001");
  assert.deepEqual(result.items[0].missingFeatures, ["Current Stock"]);
});

test("prediction fails explicitly when the model is not trained", () => {
  assert.throws(
    () => predictLiveInventoryItems([liveItem()], { classifier: null, trainedTrees: null }),
    (error) => error.code === "MODEL_NOT_TRAINED"
  );
});

test("empty training data leaves an explicit untrained status", async () => {
  await assert.rejects(
    trainInventoryModel({ readRows: () => [] }),
    /No valid training rows/
  );
  assert.equal(getModelStatus().modelLoaded, false);
  assert.equal(getModelStatus().summary.trained, false);
});

test("corrupt training data leaves an explicit untrained status", async () => {
  await assert.rejects(
    trainInventoryModel({ readRows: () => { throw new Error("corrupt workbook"); } }),
    /corrupt workbook/
  );
  assert.equal(getModelStatus().modelLoaded, false);
  assert.match(getModelStatus().summary.error, /corrupt workbook/);
});

test("predictions retain stable item ids even when input order changes", () => {
  const result = predictLiveInventoryItems(
    [liveItem({ id: "B", currentStock: 2 }), liveItem({ id: "A", currentStock: 20 })],
    { classifier, trainedTrees: [{}] }
  );
  assert.deepEqual(
    result.items.map(({ itemId, predictedMovement }) => [itemId, predictedMovement]),
    [["B", "Fast"], ["A", "Slow"]]
  );
});
