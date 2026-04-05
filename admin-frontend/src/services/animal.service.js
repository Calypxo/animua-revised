// admin-frontend/src/services/animal.service.js
import { apiFetch } from "../utils/api.js";

export async function getAllAnimals(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return await apiFetch(`/animals${qs ? "?" + qs : ""}`);
}

export async function getAnimalById(id) {
  const data = await apiFetch(`/animals/${encodeURIComponent(id)}`);
  return data.animal;
}

export async function updateAnimal(id, payload) {
  return await apiFetch(`/animals/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function saveBehavioralAssessment(id, payload) {
  return await apiFetch(`/animals/${encodeURIComponent(id)}/behavioral`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addMedicalRecord(id, payload) {
  return await apiFetch(`/animals/${encodeURIComponent(id)}/medical`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateMedicalRecord(id, medicalId, payload) {
  return await apiFetch(`/animals/${encodeURIComponent(id)}/medical/${encodeURIComponent(medicalId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function archiveAnimal(id) {
  return await apiFetch(`/animals/${encodeURIComponent(id)}/archive`, {
    method: "PATCH",
  });
}