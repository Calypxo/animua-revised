const XLSX = require("xlsx");

const FEATURE_COLUMNS = [
  "Category",
  "Current Stock",
  "Average Inventory",
  "Avg Monthly Usage",
  "Recency (Days)",
  "Lead Time (Days)",
  "Stockout Frequency",
  "Monthly Turnover Ratio"
];

const TARGET_COLUMN = "Movement Label";

function readExcelRows(filePath) {
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getCellValue(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (
      row[key] !== undefined &&
      row[key] !== null &&
      String(row[key]).trim() !== ""
    ) {
      return row[key];
    }
  }
  return "";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function prepareTrainingRows(rows) {
  const cleaned = [];
  let skipped = 0;

  for (const row of rows) {
    const movementLabel = cleanText(row[TARGET_COLUMN]);

    if (movementLabel !== "Fast" && movementLabel !== "Slow") {
      skipped++;
      continue;
    }

    const currentStock = toNumber(row["Current Stock"]);
    const averageInventory = toNumber(row["Average Inventory"]);
    const avgMonthlyUsage = toNumber(row["Avg Monthly Usage"]);
    const recencyDays = toNumber(row["Recency (Days)"]);
    const leadTimeDays = toNumber(row["Lead Time (Days)"]);
    const stockoutFrequency = toNumber(row["Stockout Frequency"]);
    const monthlyTurnoverRatio = toNumber(row["Monthly Turnover Ratio"]);
    const category = cleanText(row["Category"]);

    const numericValues = [
      currentStock,
      averageInventory,
      avgMonthlyUsage,
      recencyDays,
      leadTimeDays,
      stockoutFrequency,
      monthlyTurnoverRatio
    ];

    if (!category || numericValues.some((v) => v === null)) {
      skipped++;
      continue;
    }

    cleaned.push({
      "Category": category,
      "Current Stock": currentStock,
      "Average Inventory": averageInventory,
      "Avg Monthly Usage": avgMonthlyUsage,
      "Recency (Days)": recencyDays,
      "Lead Time (Days)": leadTimeDays,
      "Stockout Frequency": stockoutFrequency,
      "Monthly Turnover Ratio": monthlyTurnoverRatio,
      "Movement Label": movementLabel
    });
  }

  return { cleaned, skipped };
}

function buildPredictionRow(payload) {
  const row = {
    "Category": cleanText(payload.category),
    "Current Stock": toNumber(payload.currentStock),
    "Average Inventory": toNumber(payload.averageInventory),
    "Avg Monthly Usage": toNumber(payload.avgMonthlyUsage),
    "Recency (Days)": toNumber(payload.recencyDays),
    "Lead Time (Days)": toNumber(payload.leadTimeDays),
    "Stockout Frequency": toNumber(payload.stockoutFrequency),
    "Monthly Turnover Ratio": toNumber(payload.monthlyTurnoverRatio)
  };

  if (!row["Category"]) {
    throw new Error("category is required.");
  }

  for (const feature of FEATURE_COLUMNS.slice(1)) {
    if (row[feature] === null) {
      throw new Error(`${feature} must be a valid number.`);
    }
  }

  return row;
}

function buildPredictionRowFromExcelRow(row) {
  const sample = {
    "Category": cleanText(row["Category"]),
    "Current Stock": toNumber(row["Current Stock"]) ?? 0,
    "Average Inventory": toNumber(row["Average Inventory"]) ?? 0,
    "Avg Monthly Usage": toNumber(row["Avg Monthly Usage"]) ?? 0,
    "Recency (Days)": toNumber(row["Recency (Days)"]) ?? 0,
    "Lead Time (Days)": toNumber(row["Lead Time (Days)"]) ?? 0,
    "Stockout Frequency": toNumber(row["Stockout Frequency"]) ?? 0,
    "Monthly Turnover Ratio": toNumber(row["Monthly Turnover Ratio"]) ?? 0
  };

  if (!sample["Category"]) return null;
  return sample;
}

function computeStockoutMetrics(currentStock, avgMonthlyUsage) {
  const stock = toNumber(currentStock) ?? 0;
  const monthlyUsage = toNumber(avgMonthlyUsage) ?? 0;

  if (monthlyUsage <= 0) {
    return {
      daysToStockout: 999,
      stockoutRiskPercent: 0
    };
  }

  const dailyUsage = monthlyUsage / 30;
  const rawDays = stock / dailyUsage;
  const daysToStockout = Number(rawDays.toFixed(1));

  let stockoutRiskPercent = Math.round(120 / (1 + daysToStockout / 4));
  stockoutRiskPercent = clamp(stockoutRiskPercent, 1, 100);

  return {
    daysToStockout,
    stockoutRiskPercent
  };
}

module.exports = {
  FEATURE_COLUMNS,
  TARGET_COLUMN,
  readExcelRows,
  cleanText,
  toNumber,
  getCellValue,
  clamp,
  prepareTrainingRows,
  buildPredictionRow,
  buildPredictionRowFromExcelRow,
  computeStockoutMetrics
};