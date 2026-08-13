const { admin, db } = require("../config/firebase");

const INVENTORY_COL = "inventoryItems";
const PREDICTION_FIELDS = new Set([
  "recencyDays",
  "stockoutFrequency",
  "monthlyTurnoverRatio",
  "ruleBasedMovement",
  "reorderRisk",
  "reorderPoint",
  "daysUntilStockout",
  "daysToRestock",
  "stockStatus",
]);
const BLOCKED_ITEM_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "createdBy",
  "createdByEmail",
  "updatedBy",
  "updatedByEmail",
  "transactions",
]);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeId(value) {
  return String(value || "").trim();
}

function validateQuantity(value) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw httpError(400, "Quantity must be a positive whole number.");
  }
  return quantity;
}

function getCurrentStock(item = {}) {
  const stock = Number(item.currentStock ?? item.quantity ?? item.stock ?? 0);
  if (!Number.isFinite(stock) || stock < 0) {
    throw httpError(409, "The inventory item has an invalid current stock value.");
  }
  return stock;
}

function sanitizePredictionUpdates(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => PREDICTION_FIELDS.has(key))
  );
}

function sanitizeItemInput(value = {}, { creating = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw httpError(400, "Inventory item data is required.");
  }

  const clean = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (key === "id" || key === "docId" || BLOCKED_ITEM_FIELDS.has(key)) continue;
    clean[key] = fieldValue;
  }

  if (creating) {
    const name = String(clean.name || clean.itemDescription || "").trim();
    if (!name) throw httpError(400, "Inventory item name is required.");
    const stock = Number(clean.currentStock ?? 0);
    if (!Number.isFinite(stock) || stock < 0) {
      throw httpError(400, "Current stock must be zero or greater.");
    }
    clean.currentStock = stock;
  } else if (Object.prototype.hasOwnProperty.call(clean, "currentStock")) {
    const stock = Number(clean.currentStock);
    if (!Number.isFinite(stock) || stock < 0) {
      throw httpError(400, "Current stock must be zero or greater.");
    }
    clean.currentStock = stock;
  }

  return clean;
}

function actorFields(user = {}, prefix = "updated") {
  const name = user.fullName || user.email || "Management user";
  return {
    [`${prefix}By`]: name,
    [`${prefix}ByEmail`]: user.email || user.id || "",
  };
}

function sendError(res, error, label) {
  console.error(`[${label}]`, error);
  return res.status(error.status || 500).json({
    message: error.status ? error.message : "Inventory operation failed.",
  });
}

exports.listInventoryItems = async (_req, res) => {
  try {
    const snapshot = await db.collection(INVENTORY_COL).get();
    return res.status(200).json({
      items: snapshot.docs.map((document) => ({
        docId: document.id,
        id: document.data().id || document.id,
        ...document.data(),
      })),
    });
  } catch (error) {
    return sendError(res, error, "listInventoryItems");
  }
};

exports.getInventoryItem = async (req, res) => {
  try {
    const itemId = normalizeId(req.params.id);
    const snapshot = await db.collection(INVENTORY_COL).doc(itemId).get();
    if (!snapshot.exists) throw httpError(404, "Item not found.");
    return res.status(200).json({
      item: { docId: snapshot.id, id: snapshot.data().id || snapshot.id, ...snapshot.data() },
    });
  } catch (error) {
    return sendError(res, error, "getInventoryItem");
  }
};

exports.createInventoryItem = async (req, res) => {
  try {
    const itemId = normalizeId(req.body?.id);
    if (!itemId) throw httpError(400, "Inventory item ID is required.");
    const data = sanitizeItemInput(req.body, { creating: true });
    const reference = db.collection(INVENTORY_COL).doc(itemId);
    const existing = await reference.get();
    if (existing.exists) throw httpError(409, "An inventory item with this ID already exists.");

    const item = {
      ...data,
      id: itemId,
      ...actorFields(req.user, "created"),
      ...actorFields(req.user, "updated"),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await reference.create(item);
    return res.status(201).json({ item: { docId: itemId, ...item } });
  } catch (error) {
    return sendError(res, error, "createInventoryItem");
  }
};

exports.updateInventoryItem = async (req, res) => {
  try {
    const itemId = normalizeId(req.params.id);
    const reference = db.collection(INVENTORY_COL).doc(itemId);
    const existing = await reference.get();
    if (!existing.exists) throw httpError(404, "Item not found.");
    const updates = {
      ...sanitizeItemInput(req.body),
      ...actorFields(req.user),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await reference.update(updates);
    return res.status(200).json({
      item: { docId: itemId, id: existing.data().id || itemId, ...existing.data(), ...updates },
    });
  } catch (error) {
    return sendError(res, error, "updateInventoryItem");
  }
};

async function performMovement(req, res, type) {
  try {
    const itemId = normalizeId(req.params.id);
    const quantity = validateQuantity(req.body?.qty);
    const itemReference = db.collection(INVENTORY_COL).doc(itemId);
    const transactionReference = itemReference.collection("transactions").doc();
    let result;

    await db.runTransaction(async (transaction) => {
      const itemSnapshot = await transaction.get(itemReference);
      if (!itemSnapshot.exists) throw httpError(404, "Item not found.");
      const currentStock = getCurrentStock(itemSnapshot.data());
      if (type === "out" && quantity > currentStock) {
        throw httpError(409, `Only ${currentStock} unit(s) are available.`);
      }

      const nextStock = type === "in" ? currentStock + quantity : currentStock - quantity;
      const predictionUpdates = sanitizePredictionUpdates(req.body?.predictionUpdates);
      const itemUpdates = {
        ...predictionUpdates,
        currentStock: nextStock,
        ...actorFields(req.user),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const movement = {
        type,
        qty: quantity,
        date: String(req.body?.date || "").trim(),
        supplier: String(req.body?.supplier || "").trim(),
        animal: String(req.body?.animal || "").trim(),
        procedure: String(req.body?.procedure || (type === "out" ? "General Use" : "")).trim(),
        notes: String(req.body?.notes || "").trim(),
        batchId: String(req.body?.batchId || "").trim(),
        staff: req.user?.fullName || req.user?.email || "Management user",
        staffEmail: req.user?.email || req.user?.id || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      transaction.update(itemReference, itemUpdates);
      transaction.set(transactionReference, movement);
      result = {
        item: { docId: itemId, id: itemSnapshot.data().id || itemId, ...itemSnapshot.data(), ...itemUpdates },
        transaction: { id: transactionReference.id, ...movement },
      };
    });

    return res.status(201).json(result);
  } catch (error) {
    return sendError(res, error, type === "in" ? "stockIn" : "stockOut");
  }
}

exports.stockIn = (req, res) => performMovement(req, res, "in");
exports.stockOut = (req, res) => performMovement(req, res, "out");

exports.listInventoryTransactions = async (req, res) => {
  try {
    const itemId = normalizeId(req.params.id);
    const itemReference = db.collection(INVENTORY_COL).doc(itemId);
    const item = await itemReference.get();
    if (!item.exists) throw httpError(404, "Item not found.");
    const snapshot = await itemReference.collection("transactions").get();
    return res.status(200).json({
      transactions: snapshot.docs.map((document) => ({ id: document.id, ...document.data() })),
    });
  } catch (error) {
    return sendError(res, error, "listInventoryTransactions");
  }
};

exports.validateQuantity = validateQuantity;
exports.getCurrentStock = getCurrentStock;
exports.sanitizeItemInput = sanitizeItemInput;
exports.sanitizePredictionUpdates = sanitizePredictionUpdates;
