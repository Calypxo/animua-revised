export function mergeInventoryPredictions(inventoryItems, response) {
  const predictions = Array.isArray(response?.items) ? response.items : [];
  const byId = new Map(
    predictions
      .filter((prediction) => prediction?.itemId)
      .map((prediction) => [String(prediction.itemId), prediction])
  );

  return inventoryItems.map((item) => {
    const prediction = byId.get(String(item.id));
    if (!prediction) {
      return {
        ...item,
        predictedMovement: null,
        predictionAvailable: false,
        predictionStatus: "unavailable",
        predictionMessage: "No Random Forest result was returned for this item.",
      };
    }
    if (!prediction.predictionAvailable) {
      return {
        ...item,
        predictedMovement: null,
        predictionAvailable: false,
        predictionStatus: "missing-data",
        predictionMessage: prediction.message || "Required model data is unavailable.",
        missingPredictionFeatures: prediction.missingFeatures || [],
      };
    }

    return {
      ...item,
      predictedMovement: prediction.predictedMovement,
      predictionAvailable: true,
      predictionStatus: "ready",
      predictionMessage: "Random Forest prediction from the current Firestore record.",
      predictionSource: prediction.predictionSource,
      predictedStockoutRiskPercent: prediction.stockoutRiskPercent,
      predictedDaysToStockout: prediction.daysToStockout,
      predictionDerivedFeatures: prediction.derivedFeatures || [],
    };
  });
}

export function markInventoryPredictionsUnavailable(inventoryItems, message) {
  return inventoryItems.map((item) => ({
    ...item,
    predictedMovement: null,
    predictionAvailable: false,
    predictionStatus: "unavailable",
    predictionMessage: message || "Random Forest prediction is unavailable.",
  }));
}
