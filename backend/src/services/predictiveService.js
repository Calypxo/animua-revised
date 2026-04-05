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
  computeStockoutMetrics
} = require("../utils/predictiveUtils");

const DATA_FILE = path.join(__dirname, "../../data/Inventory.xlsx");

let rf = null;
let trees = null;
let trainingSummary = null;

function trainInventoryModel() {
  return new Promise((resolve, reject) => {
    try {
      const rows = readExcelRows(DATA_FILE);
      const { cleaned, skipped } = prepareTrainingRows(rows);

      if (!cleaned.length) {
        return reject(new Error("No valid training rows found in Inventory.xlsx"));
      }

      rf = new RandomForestClassifier({
        n_estimators: 50
      });

      rf.fit(cleaned, FEATURE_COLUMNS, TARGET_COLUMN, function (err, trainedTrees) {
        if (err) {
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
      reject(error);
    }
  });
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
      isAlert: predictedMovement === "Fast" && metrics.daysToStockout <= 10
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
  getInventoryItems
};