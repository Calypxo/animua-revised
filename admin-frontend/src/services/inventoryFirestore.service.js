import { apiFetch } from "../utils/api.js";

export async function getInventoryItems() {
  const data = await apiFetch("/inventory");
  return Array.isArray(data.items) ? data.items : [];
}

export async function getInventoryItemById(itemId) {
  const data = await apiFetch(`/inventory/${encodeURIComponent(itemId)}`);
  return data.item;
}

export async function updateInventoryItem(itemId, updates) {
  const data = await apiFetch(`/inventory/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
  return data.item;
}

export async function createInventoryItem(item) {
  const data = await apiFetch("/inventory", {
    method: "POST",
    body: JSON.stringify(item),
  });
  return data.item;
}

export async function applyInventoryMovement(itemId, type, movement) {
  const endpoint = type === "in" ? "stock-in" : "stock-out";
  return apiFetch(`/inventory/${encodeURIComponent(itemId)}/${endpoint}`, {
    method: "POST",
    body: JSON.stringify(movement),
  });
}

export async function getItemTransactions(itemId) {
  const data = await apiFetch(`/inventory/${encodeURIComponent(itemId)}/transactions`);
  return Array.isArray(data.transactions) ? data.transactions : [];
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
