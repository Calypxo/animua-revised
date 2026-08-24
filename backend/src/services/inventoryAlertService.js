const { createManagementNotification } = require("./notificationService");

const STOCK_LEVEL_PRIORITY = { OK: 0, Low: 1, Critical: 2 };

function normalizedStatus(value = "") {
  const status = String(value || "").trim().toLowerCase();
  if (status === "critical" || status === "out of stock") return "Critical";
  if (status === "low" || status === "low stock") return "Low";
  return "OK";
}

function inventoryStockLevel(item = {}, stockValue) {
  const stock = Number(stockValue ?? item.currentStock ?? item.quantity ?? item.stock ?? 0);
  const reorderPoint = Number(item.reorderPoint ?? item.minimumStock ?? item.minStock ?? 0);
  const criticalPoint = Number(
    item.criticalPoint ?? (reorderPoint > 0 ? Math.max(1, Math.floor(reorderPoint * .5)) : 0)
  );

  if (Number.isFinite(stock) && reorderPoint > 0) {
    if (stock <= criticalPoint) return "Critical";
    if (stock <= reorderPoint) return "Low";
    return "OK";
  }
  return normalizedStatus(item.stockStatus);
}

async function notifyIfInventoryLevelWorsened({
  itemId,
  item = {},
  beforeStock,
  afterStock,
  afterItem = {},
}) {
  const beforeLevel = inventoryStockLevel(item, beforeStock);
  const mergedAfter = { ...item, ...afterItem };
  const afterLevel = inventoryStockLevel(mergedAfter, afterStock);
  if (
    STOCK_LEVEL_PRIORITY[afterLevel] <= STOCK_LEVEL_PRIORITY[beforeLevel] ||
    !["Low", "Critical"].includes(afterLevel)
  ) return false;

  const itemName = String(item.itemDescription || item.name || itemId || "Inventory item");
  const unit = String(item.unit || "units");
  await createManagementNotification({
    roles: ["Admin", "Staff"],
    type: afterLevel === "Critical" ? "inventory_stock_critical" : "inventory_stock_low",
    resourceType: "inventory_item",
    relatedResourceId: String(itemId || item.id || ""),
    title: afterLevel === "Critical" ? "Critical inventory level" : "Low inventory level",
    message: `${itemName} has ${Number(afterStock || 0)} ${unit} remaining.`,
    metadata: {
      stockLevel: afterLevel,
      currentStock: Number(afterStock || 0),
    },
  });
  return true;
}

module.exports = {
  inventoryStockLevel,
  notifyIfInventoryLevelWorsened,
};
