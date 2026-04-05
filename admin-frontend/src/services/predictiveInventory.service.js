import { apiFetch } from "../utils/api.js";

export async function getPredictiveInventoryStatus() {
  return await apiFetch("/predictive/status");
}

export async function getPredictiveInventoryItems() {
  return await apiFetch("/predictive/items");
}