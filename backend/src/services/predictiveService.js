const path = require("path");
const { RandomForestClassifier } = require("random-forest-classifier");
const {
  FEATURE_COLUMNS,
  TARGET_COLUMN,
  readExcelRows,
  cleanText,
  toNumber,
  getCellValue,
  prepareTrainingRows,
  buildPredictionRowFromExcelRow,
  buildPredictionInputFromLiveItem,
  computeStockoutMetrics
} = require("../utils/predictiveUtils");

const DATA_FILE = path.join(__dirname, "../../data/Inventory.xlsx");

let rf = null;
let trees = null;
let trainingSummary = null;

function predictMovement(row, classifier, trainedTrees) {
  const usableTrees = Array.isArray(trainedTrees)
    ? trainedTrees.filter((tree) => typeof tree?.predict === "function")
    : [];

  if (usableTrees.length) {
    const votes = usableTrees.flatMap((tree) => {
      try {
        const vote = tree.predict(row);
        return ["Fast", "Slow"].includes(vote) ? [vote] : [];
      } catch {
        return [];
      }
    });

    if (!votes.length) {
      throw new Error("No trained tree returned a supported movement label.");
    }

    const counts = votes.reduce(
      (result, vote) => ({ ...result, [vote]: result[vote] + 1 }),
      { Fast: 0, Slow: 0 },
    );
    return counts.Fast > counts.Slow ? "Fast" : "Slow";
  }

  const prediction = classifier.predict([row], trainedTrees);
  return Array.isArray(prediction) ? prediction[0] : prediction;
}

function recordTrainingFailure(error) {
  rf = null;
  trees = null;
  trainingSummary = {
    trained: false,
    error: error.message,
    failedAt: new Date().toISOString(),
  };
}

function trainInventoryModel({
  readRows = () => readExcelRows(DATA_FILE),
  classifierFactory = () => new RandomForestClassifier({ n_estimators: 50 }),
} = {}) {
  return new Promise((resolve, reject) => {
    try {
      rf = null;
      trees = null;
      const rows = readRows();
      const { cleaned, skipped } = prepareTrainingRows(rows);

      if (!cleaned.length) {
        const error = new Error("No valid training rows found in Inventory.xlsx");
        recordTrainingFailure(error);
        return reject(error);
      }

      rf = classifierFactory();

      rf.fit(cleaned, FEATURE_COLUMNS, TARGET_COLUMN, function (err, trainedTrees) {
        if (err) {
          recordTrainingFailure(err);
          return reject(err);
        }

        trees = trainedTrees;

        const fastCount = cleaned.filter(
          (item) => item[TARGET_COLUMN] === "Fast"
        ).length;

        const slowCount = cleaned.filter(
          (item) => item[TARGET_COLUMN] === "Slow"
        ).length;

        trainingSummary = {
          trained: true,
          totalRowsInExcel: rows.length,
          rowsUsedForTraining: cleaned.length,
          skippedRows: skipped,
          classDistribution: {
            Fast: fastCount,
            Slow: slowCount
          },
          trainedAt: new Date().toISOString()
        };

        resolve(trainingSummary);
      });
    } catch (error) {
      recordTrainingFailure(error);
      reject(error);
    }
  });
}

function predictLiveInventoryItems(
  items,
  { classifier = rf, trainedTrees = trees } = {}
) {
  if (!classifier || !trainedTrees) {
    const error = new Error("Model is not trained yet. Train the model first.");
    error.code = "MODEL_NOT_TRAINED";
    throw error;
  }
  if (!Array.isArray(items)) {
    const error = new Error("items must be an array of live inventory records.");
    error.code = "INVALID_REQUEST";
    throw error;
  }

  const results = items.map((item, index) => {
    const fallbackId = cleanText(item?.id ?? item?.docId ?? item?.itemId);
    try {
      const input = buildPredictionInputFromLiveItem(item);
      const predictedMovement = predictMovement(
        input.row,
        classifier,
        trainedTrees,
      );
      if (!["Fast", "Slow"].includes(predictedMovement)) {
        throw new Error("The model returned an unsupported movement label.");
      }
      const metrics = computeStockoutMetrics(
        input.row["Current Stock"],
        input.row["Avg Monthly Usage"]
      );
      return {
        index,
        itemId: input.itemId,
        itemDescription: input.itemDescription,
        unit: input.unit,
        actualCurrentStock: input.row["Current Stock"],
        predictedMovement,
        predictionAvailable: true,
        predictionSource: "random-forest",
        derivedFeatures: input.derivedFeatures,
        stockoutRiskPercent: metrics.stockoutRiskPercent,
        daysToStockout: metrics.daysToStockout,
        isAlert: predictedMovement === "Fast" && metrics.daysToStockout <= 14,
      };
    } catch (error) {
      return {
        index,
        itemId: error.itemId || fallbackId,
        predictionAvailable: false,
        predictionSource: "random-forest",
        missingFeatures: error.missingFeatures || [],
        message: error.message,
      };
    }
  });

  return {
    success: true,
    source: "live-inventory",
    count: results.length,
    predictedCount: results.filter((item) => item.predictionAvailable).length,
    unavailableCount: results.filter((item) => !item.predictionAvailable).length,
    items: results,
  };
}

function getModelStatus() {
  return {
    modelLoaded: !!trees,
    summary: trainingSummary
  };
}

function getInventoryItems() {
  if (!rf || !trees) {
    throw new Error("Model is not trained yet. Train the model first.");
  }

  const rows = readExcelRows(DATA_FILE);

  const items = rows.map((row, index) => {
    const itemId = getCellValue(row, ["Item ID", "ID"]);
    const itemDescription = getCellValue(row, [
      "Item Description",
      "Item Name",
      "Description",
      "Product Name"
    ]);
    const category = cleanText(row["Category"]);
    const currentStock = toNumber(row["Current Stock"]) ?? 0;
    const avgMonthlyUsage = toNumber(row["Avg Monthly Usage"]) ?? 0;

    const sample = buildPredictionRowFromExcelRow(row);
    let predictedMovement = "N/A";

    if (sample) {
      const prediction = rf.predict([sample], trees);
      predictedMovement = Array.isArray(prediction) ? prediction[0] : prediction;
    }

    const metrics = computeStockoutMetrics(currentStock, avgMonthlyUsage);

    return {
      rowNumber: index + 1,
      itemId,
      itemDescription,
      category,
      currentStock,
      predictedMovement,
      stockoutRiskPercent: metrics.stockoutRiskPercent,
      daysToStockout: metrics.daysToStockout,
      isAlert: predictedMovement === "Fast" && metrics.daysToStockout <= 14
    };
  });

  const alerts = items.filter((item) => item.isAlert);

  return {
    success: true,
    count: items.length,
    alertCount: alerts.length,
    alerts,
    items
  };
}

module.exports = {
  trainInventoryModel,
  getModelStatus,
  getInventoryItems,
  predictLiveInventoryItems,
};
