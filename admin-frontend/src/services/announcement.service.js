import { API_BASE_URL, apiFetch } from "../utils/api.js";

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

async function announcementImageRequest(id, options) {
  const response = await fetch(
    `${API_BASE_URL}/announcements/${encodeURIComponent(id)}/image`,
    {
      ...options,
      credentials: "include",
      headers: {
        ...(options.headers || {}),
      },
    }
  );

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    throw new Error(data.message || `Image request failed (${response.status})`);
  }

  return data;
}

export async function uploadAnnouncementImage(id, file) {
  const formData = new FormData();
  formData.append("photo", file);

  return announcementImageRequest(id, {
    method: "PATCH",
    body: formData,
  });
}

export async function deleteAnnouncementImage(id) {
  return announcementImageRequest(id, { method: "DELETE" });
}
