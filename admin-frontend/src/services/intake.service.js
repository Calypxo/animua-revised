// admin-frontend/src/services/intake.service.js
import { apiFetch } from "../utils/api.js";

// GET /api/intake  (optional params: status, source, species)
export async function getAllIntake(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const data = await apiFetch(`/intake${qs ? "?" + qs : ""}`);
  return data; // { records, summary }
}

// GET /api/intake/:id
export async function getIntakeById(id) {
  const data = await apiFetch(`/intake/${encodeURIComponent(id)}`);
  return data.record;
}

// POST /api/intake
export async function createIntake(payload) {
  return await apiFetch("/intake", {
    method: "POST",
    body:   JSON.stringify(payload),
  });
}

// PUT /api/intake/:id
export async function updateIntake(id, payload) {
  return await apiFetch(`/intake/${encodeURIComponent(id)}`, {
    method: "PUT",
    body:   JSON.stringify(payload),
  });
}

// PATCH /api/intake/:id/approve
export async function approveIntake(id) {
  return await apiFetch(`/intake/${encodeURIComponent(id)}/approve`, {
    method: "PATCH",
  });
}

// PATCH /api/intake/:id/reject
export async function rejectIntake(id, reason) {
  return await apiFetch(`/intake/${encodeURIComponent(id)}/reject`, {
    method: "PATCH",
    body:   JSON.stringify({ reason }),
  });
}

// POST /api/intake/:id/convert
export async function convertToProfile(id) {
  return await apiFetch(`/intake/${encodeURIComponent(id)}/convert`, {
    method: "POST",
  });
}