const {
  apiRequest,
  useIntegrationBaseline,
} = require("../../../support/integration");

const VALID_ITEM = "FT_TEST_PREDICT_OK";
const UNAVAILABLE_ITEM = "FT_TEST_PREDICT_UNAVAILABLE";

function persistentPredictionInput(item) {
  return {
    id: item.id,
    itemDescription: item.itemDescription,
    category: item.category,
    unit: item.unit,
    currentStock: item.currentStock,
    averageInventory: item.averageInventory,
    avgMonthlyUsage: item.avgMonthlyUsage,
    recencyDays: item.recencyDays,
    leadTimeDays: item.leadTimeDays,
    stockoutFrequency: item.stockoutFrequency,
    monthlyTurnoverRatio: item.monthlyTurnoverRatio,
  };
}

describe("IT-020 — Predictive Inventory Pipeline", () => {
  const context = useIntegrationBaseline();

  it("feeds live Firestore inventory into the trained model without persisting prediction side effects", () => {
    let beforeItems;
    let afterItems;
    let modelStatus;
    let predictionResponse;

    apiRequest({ path: "inventory", token: context.tokens.Admin }).then((response) => {
      expect(response.status).to.equal(200);
      beforeItems = (response.body?.items || []).filter((item) =>
        [VALID_ITEM, UNAVAILABLE_ITEM].includes(item.id),
      );
      expect(beforeItems.map((item) => item.id).sort()).to.deep.equal(
        [UNAVAILABLE_ITEM, VALID_ITEM].sort(),
      );
    });
    apiRequest({ path: "predictive/status", token: context.tokens.Admin }).then(
      (response) => {
        modelStatus = response;
      },
    );
    cy.then(() =>
      apiRequest({
        method: "POST",
        path: "predictive/items",
        token: context.tokens.Admin,
        body: { items: beforeItems },
      }).then((response) => {
        predictionResponse = response;
      }),
    );
    apiRequest({ path: "inventory", token: context.tokens.Admin }).then((response) => {
      afterItems = (response.body?.items || []).filter((item) =>
        [VALID_ITEM, UNAVAILABLE_ITEM].includes(item.id),
      );
    });

    cy.then(() => {
      expect(modelStatus?.status).to.equal(200);
      expect(modelStatus?.body?.modelLoaded).to.equal(true);
      expect(modelStatus?.body?.summary).to.include({
        trained: true,
        totalRowsInExcel: 81,
        rowsUsedForTraining: 81,
      });

      expect(predictionResponse?.status).to.equal(200);
      expect(predictionResponse?.body).to.include({
        success: true,
        source: "live-inventory",
        count: 2,
        predictedCount: 1,
        unavailableCount: 1,
      });
      const validPrediction = predictionResponse.body.items.find(
        (item) => item.itemId === VALID_ITEM,
      );
      const unavailablePrediction = predictionResponse.body.items.find(
        (item) => item.itemId === UNAVAILABLE_ITEM,
      );
      expect(validPrediction).to.include({
        itemId: VALID_ITEM,
        predictionAvailable: true,
        predictionSource: "random-forest",
      });
      expect(validPrediction.predictedMovement).to.be.oneOf(["Fast", "Slow"]);
      expect(validPrediction.actualCurrentStock).to.be.a("number");
      expect(validPrediction.stockoutRiskPercent).to.be.a("number");
      expect(validPrediction.daysToStockout).to.be.a("number");
      expect(validPrediction.isAlert).to.be.a("boolean");

      expect(unavailablePrediction).to.include({
        itemId: UNAVAILABLE_ITEM,
        predictionAvailable: false,
        predictionSource: "random-forest",
      });
      expect(unavailablePrediction.missingFeatures).to.be.an("array").and.not.be.empty;
      expect(unavailablePrediction.message).to.be.a("string").and.not.be.empty;

      const beforeById = Object.fromEntries(
        beforeItems.map((item) => [item.id, persistentPredictionInput(item)]),
      );
      const afterById = Object.fromEntries(
        afterItems.map((item) => [item.id, persistentPredictionInput(item)]),
      );
      expect(afterById).to.deep.equal(beforeById);
    });
  });
});
