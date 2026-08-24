// admin-frontend/src/services/animal.service.js
import { apiFetch } from "../utils/api.js";
import { queuedAdminApiFetch } from "./offlineAdminQueue.service.js";

export async function getAllAnimals(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return await apiFetch(`/animals${qs ? "?" + qs : ""}`);
}

export async function getAnimalById(id) {
  const data = await apiFetch(`/animals/${encodeURIComponent(id)}`);
  return data.animal;
}

export async function updateAnimal(id, payload) {
  return await queuedAdminApiFetch(`/animals/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, { animal: { id, ...payload, offlinePending: true } });
}

export async function sendAnimalToQuarantine(id) {
  return await apiFetch(
    `/animals/${encodeURIComponent(id)}/send-to-quarantine`,
    {
      method: "PATCH",
    }
  );
}

export async function markAnimalReady(id) {
  return await apiFetch(
    `/animals/${encodeURIComponent(id)}/mark-ready`,
    {
      method: "PATCH",
    }
  );
}

export async function saveBehavioralAssessment(id, payload) {
  return await queuedAdminApiFetch(`/animals/${encodeURIComponent(id)}/behavioral`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, { offlineQueued: true });
}

export async function getBehavioralQuestions() {
  return await apiFetch("/animals/behavioral-questions");
}

export async function saveBehavioralQuestions(questions, version) {
  return await apiFetch("/animals/behavioral-questions", {
    method: "PUT",
    body: JSON.stringify({ questions, version }),
  });
}

export async function addMedicalRecord(id, payload) {
  return await queuedAdminApiFetch(`/animals/${encodeURIComponent(id)}/medical`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, { record: { ...payload, offlinePending: true } });
}

export async function updateMedicalRecord(id, medicalId, payload) {
  return await queuedAdminApiFetch(`/animals/${encodeURIComponent(id)}/medical/${encodeURIComponent(medicalId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, { record: { id: medicalId, ...payload, offlinePending: true } });
}

export async function archiveAnimal(id) {
  return await apiFetch(`/animals/${encodeURIComponent(id)}/archive`, {
    method: "PATCH",
  });
}

export async function deleteAnimalPhoto(id) {
  return await apiFetch(`/animals/${encodeURIComponent(id)}/photo`, {
    method: "DELETE",
  });
}
