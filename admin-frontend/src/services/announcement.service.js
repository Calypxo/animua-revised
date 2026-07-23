import { apiFetch } from "../utils/api.js";

export async function getAnnouncements() {
  return await apiFetch("/announcements");
}

export async function createAnnouncement(payload) {
  return await apiFetch("/announcements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAnnouncement(id, payload) {
  return await apiFetch(`/announcements/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAnnouncement(id) {
  return await apiFetch(`/announcements/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}