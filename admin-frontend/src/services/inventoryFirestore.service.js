import { collection, getDocs, getDoc, doc, setDoc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase.js";
import { apiFetch } from "../utils/api.js";

async function recordInventoryAudit(event) {
  try {
    await apiFetch("/audit/events", {
      method: "POST",
      body: JSON.stringify({ module: "Inventory", ...event }),
    });
  } catch (error) {
    console.warn("[inventoryAudit]", error.message);
  }
}

export async function getInventoryItems() {
  const snap = await getDocs(collection(db, "inventoryItems"));
  return snap.docs.map((docSnap) => ({
    docId: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function getInventoryItemById(itemId) {
  const ref = doc(db, "inventoryItems", itemId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Item not found.");
  }

  return {
    docId: snap.id,
    ...snap.data(),
  };
}

export async function updateInventoryItem(itemId, updates) {
  const ref = doc(db, "inventoryItems", itemId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
  const isStockCalculation = "currentStock" in updates && !["name", "category", "unit", "description"].some((key) => key in updates);
  if (!isStockCalculation) {
    await recordInventoryAudit({
      action: "inventory.updated",
      targetId: itemId,
      targetName: updates.name || itemId,
      after: updates,
      details: "Inventory item details were updated.",
    });
  }
}

export async function createInventoryItem(item) {
  const ref = doc(db, "inventoryItems", item.id);
  await setDoc(ref, {
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await recordInventoryAudit({
    action: "inventory.created",
    targetId: item.id,
    targetName: item.name || item.id,
    after: item,
    details: "A new inventory item was created.",
  });
}

export async function addInventoryTransaction(itemId, txn) {
  await addDoc(collection(db, "inventoryItems", itemId, "transactions"), {
    ...txn,
    createdAt: serverTimestamp(),
  });
  const isStockIn = String(txn.type || "").toLowerCase() === "in";
  await recordInventoryAudit({
    action: isStockIn ? "inventory.stock_in" : "inventory.stock_out",
    targetId: itemId,
    targetName: itemId,
    after: txn,
    details: `${isStockIn ? "Added" : "Used"} ${Number(txn.qty || 0)} inventory unit${Number(txn.qty || 0) === 1 ? "" : "s"}.`,
  });
}

export async function getItemTransactions(itemId) {
  const snap = await getDocs(collection(db, "inventoryItems", itemId, "transactions"));
  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}
export async function getLiveInventoryPredictions(items, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await apiFetch("/predictive/items", {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({
        items: items.map((item) => ({
          id: item.id || item.docId,
          name: item.name,
          unit: item.unit,
          category: item.category,
          currentStock: item.currentStock,
          averageInventory: item.averageInventory,
          avgMonthlyUsage: item.avgMonthlyUsage,
          recencyDays: item.recencyDays,
          leadTimeDays: item.leadTimeDays,
          stockoutFrequency: item.stockoutFrequency,
          monthlyTurnoverRatio: item.monthlyTurnoverRatio,
        })),
      }),
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Random Forest prediction request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
