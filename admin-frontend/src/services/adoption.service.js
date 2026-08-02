import { apiFetch } from "../utils/api.js";

export async function getAllAdoptions(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return await apiFetch(`/adoptions${qs ? "?" + qs : ""}`);
}

export async function getAdoptionById(id) {
  const data = await apiFetch(`/adoptions/${encodeURIComponent(id)}`);
  return data.adoption;
}

export async function approveAdoption(id) {
  return await apiFetch(`/adoptions/${encodeURIComponent(id)}/approve`, {
    method: "PATCH",
  });
}

export async function rejectAdoption(id, reason) {
  return await apiFetch(`/adoptions/${encodeURIComponent(id)}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export async function finalizeAdoption(id, payload) {
  return await apiFetch(`/adoptions/${encodeURIComponent(id)}/finalize`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateAdoptionDeadline(id, action, payload = {}) {
  return await apiFetch(`/adoptions/${encodeURIComponent(id)}/${action}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function reviewAdoptionReschedule(id, decision, payload = {}) {
  return await apiFetch(`/adoptions/${encodeURIComponent(id)}/reschedule/${decision}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
