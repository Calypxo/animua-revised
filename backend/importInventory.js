const admin = require("firebase-admin");
const XLSX = require("xlsx");
const path = require("path");

const serviceAccount = require("./service-account-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const workbook = XLSX.readFile(path.join(__dirname, "data", "Inventory.xlsx"));
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet);

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function computeMonthlyTurnoverRatio(avgMonthlyUsage, averageInventory) {
  if (!averageInventory || averageInventory === 0) return 0;
  return Number((avgMonthlyUsage / averageInventory).toFixed(2));
}

function computeReorderRisk(currentStock, avgMonthlyUsage, stockoutFrequency) {
  return currentStock < avgMonthlyUsage || stockoutFrequency > 0
    ? "Review"
    : "OK";
}

async function importInventory() {
  try {
    for (const row of rows) {
      const itemId = String(row["Item ID"] || "").trim();

      if (!itemId) {
        console.log("Skipped row: missing Item ID");
        continue;
      }

      const name = String(row["Item Name"] || "").trim();
      const quantity = toNumber(row["Quantity"]);
      const unit = String(row["Unit"] || "").trim();
      const category = String(row["Category"] || "").trim();
      const currentStock = toNumber(row["Current Stock"]);
      const averageInventory = toNumber(row["Average Inventory"]);
      const avgMonthlyUsage = toNumber(row["Avg Monthly Usage"]);
      const recencyDays = toNumber(row["Recency (Days)"]);
      const leadTimeDays = toNumber(row["Lead Time (Days)"]);
      const stockoutFrequency = toNumber(row["Stockout Frequency"]);

      const monthlyTurnoverRatio = computeMonthlyTurnoverRatio(
        avgMonthlyUsage,
        averageInventory
      );

      const movementLabel = String(row["Movement Label"] || "Slow").trim();
      const reorderRisk = computeReorderRisk(
        currentStock,
        avgMonthlyUsage,
        stockoutFrequency
      );

      const data = {
        id: itemId,
        name,
        quantity,
        unit,
        category,
        currentStock,
        averageInventory,
        avgMonthlyUsage,
        recencyDays,
        leadTimeDays,
        stockoutFrequency,
        monthlyTurnoverRatio,
        movementLabel,
        reorderRisk,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection("inventoryItems").doc(itemId).set(data);
      console.log(`Imported: ${itemId}`);
    }

    console.log("All inventory items imported successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Import failed:", error);
    process.exit(1);
  }
}

importInventory();