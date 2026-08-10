import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeInventoryPredictions,
  markInventoryPredictionsUnavailable,
} from "../src/management/inventoryPredictionMerge.js";

const inventory = [
  { id: "A", name: "Alpha", currentStock: 11, ruleBasedMovement: "Slow" },
  { id: "B", name: "Beta", currentStock: 4, ruleBasedMovement: "Fast" },
];

test("API failure leaves live Firestore inventory and stock values renderable", () => {
  const result = markInventoryPredictionsUnavailable(inventory, "API offline");
  assert.equal(result.length, 2);
  assert.equal(result[0].currentStock, 11);
  assert.equal(result[1].currentStock, 4);
  assert.equal(result[0].predictionAvailable, false);
  assert.equal(result[0].predictionMessage, "API offline");
});

test("prediction results map by stable item id rather than array position", () => {
  const result = mergeInventoryPredictions(inventory, {
    items: [
      { itemId: "B", predictionAvailable: true, predictedMovement: "Fast", predictionSource: "random-forest" },
      { itemId: "A", predictionAvailable: true, predictedMovement: "Slow", predictionSource: "random-forest" },
    ],
  });
  assert.deepEqual(
    result.map(({ id, predictedMovement }) => [id, predictedMovement]),
    [["A", "Slow"], ["B", "Fast"]]
  );
});

test("a missing per-item result cannot borrow another item's prediction", () => {
  const result = mergeInventoryPredictions(inventory, {
    items: [
      { itemId: "B", predictionAvailable: true, predictedMovement: "Fast" },
    ],
  });
  assert.equal(result[0].predictedMovement, null);
  assert.equal(result[0].predictionStatus, "unavailable");
  assert.equal(result[1].predictedMovement, "Fast");
});

test("missing model fields affect only their corresponding item", () => {
  const result = mergeInventoryPredictions(inventory, {
    items: [
      { itemId: "A", predictionAvailable: false, message: "Average Inventory is missing", missingFeatures: ["Average Inventory"] },
      { itemId: "B", predictionAvailable: true, predictedMovement: "Slow" },
    ],
  });
  assert.equal(result[0].predictionStatus, "missing-data");
  assert.deepEqual(result[0].missingPredictionFeatures, ["Average Inventory"]);
  assert.equal(result[1].predictionAvailable, true);
});
