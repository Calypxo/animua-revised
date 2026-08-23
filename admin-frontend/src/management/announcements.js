import "../css/announcements.css";

import Swal from "sweetalert2";

import { protectPageByModule } from "../auth/authGuard.js";
import { hasPermission } from "../auth/permissions.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { renderPageHeader } from "../components/management/pageHeader.js";
import { PAGE_HEADER_CONFIGS } from "../components/management/pageHeaderConfigs.js";

import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  uploadAnnouncementImage,
  deleteAnnouncementImage,
} from "../services/announcement.service.js";
import {
  deleteQueuedAnnouncementSave,
  getQueuedAnnouncementSaves,
  isNetworkSaveError,
  markQueuedAnnouncementAttempt,
  queueAnnouncementSave,
} from "../services/offlineAnnouncementQueue.service.js";

window.Swal = Swal;

const state = {
  announcements: [],
  filtered: [],
  search: "",
  type: "",
  status: "",
  editingId: null,
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedEventDate: "",
  calendarInitialized: false,
  selectedImageFile: null,
  previewObjectUrl: "",
  pendingPreviewObjectUrls: [],
  existingImageUrl: "",
  removeImageRequested: false,
  syncInProgress: false,
};

let currentRole = "";

function can(action) {
  return hasPermission(currentRole, "announcements", action);
}

function getEl(id) {
  return document.getElementById(id);
}

function setHeaderValue(id, value) {
  const element = getEl(id);
  if (element) element.textContent = value;
}

function renderHeaderStats() {
  const pending = state.announcements.filter((item) => item.offlinePending).length;
  const drafts = state.announcements.filter((item) => item.status === "Draft").length;
  const published = state.announcements.filter((item) => item.status === "Published").length;
  const publicPosts = state.announcements.filter((item) => item.status === "Published" && item.visibleToPublic !== false).length;
  const countType = (type) => state.announcements.filter((item) => normalizePostType(item.type) === type).length;

  setHeaderValue("announcementTotal", state.announcements.length);
  setHeaderValue("announcementPublished", published);
  setHeaderValue("announcementDrafts", drafts);
  setHeaderValue("heroDraftCount", drafts + pending);
  setHeaderValue("announcementEvents", countType("Upcoming Events"));
  setHeaderValue("channelPublishedCount", published);
  setHeaderValue("channelPublicCount", publicPosts);
  setHeaderValue("insightPublished", published);
  setHeaderValue("insightDrafts", drafts);
  setHeaderValue("insightPublic", publicPosts);
  setHeaderValue("categoryNewsCount", countType("News & Article"));
  setHeaderValue("categorySuccessCount", countType("Success Stories"));
  setHeaderValue("categoryEventCount", countType("Upcoming Events"));
}

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizePostType(value) {
  const type = normalize(value);
  if (type.includes("event")) return "Upcoming Events";
  if (type.includes("success")) return "Success Stories";
  return "News & Article";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";

  if (value._seconds) {
    return new Date(value._seconds * 1000).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (value.seconds) {
    return new Date(value.seconds * 1000).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return String(value);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseEventDate(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  const seconds = value?._seconds ?? value?.seconds;
  const date = seconds ? new Date(seconds * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function eventDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatEventDate(value, options = {}) {
  const date = value instanceof Date ? value : parseEventDate(value);
  if (!date) return "";

  return date.toLocaleDateString("en-PH", {
    year: options.short ? undefined : "numeric",
    month: options.short ? "short" : "long",
    day: "numeric",
  });
}

function eventAnnouncements() {
  return state.announcements
    .filter((item) => normalizePostType(item.type) === "Upcoming Events")
    .map((item) => ({ ...item, calendarDate: parseEventDate(item.eventDate) }))
    .filter((item) => item.calendarDate)
    .sort((left, right) => left.calendarDate - right.calendarDate);
}

function initializeEventCalendar(events) {
  if (state.calendarInitialized) return;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = events.find((item) => item.calendarDate >= todayStart) || events[0];

  if (target) {
    state.calendarMonth = new Date(
      target.calendarDate.getFullYear(),
      target.calendarDate.getMonth(),
      1
    );
    state.selectedEventDate = eventDateKey(target.calendarDate);
  } else {
    state.calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    state.selectedEventDate = eventDateKey(todayStart);
  }

  state.calendarInitialized = true;
}

function renderEventCalendar() {
  const monthLabel = getEl("eventCalendarMonth");
  const grid = getEl("eventCalendarGrid");
  const agenda = getEl("eventCalendarAgenda");
  if (!monthLabel || !grid || !agenda) return;

  const events = eventAnnouncements();
  initializeEventCalendar(events);

  const month = state.calendarMonth;
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthEvents = events.filter(
    (item) =>
      item.calendarDate.getFullYear() === year &&
      item.calendarDate.getMonth() === monthIndex
  );
  const eventsByDate = new Map();

  monthEvents.forEach((item) => {
    const key = eventDateKey(item.calendarDate);
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key).push(item);
  });

  monthLabel.textContent = month.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });

  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const todayKey = eventDateKey(new Date());
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - firstWeekday + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      cells.push('<span class="event-calendar-day is-empty" aria-hidden="true"></span>');
      continue;
    }

    const day = new Date(year, monthIndex, dayNumber);
    const key = eventDateKey(day);
    const dayEvents = eventsByDate.get(key) || [];
    const classes = [
      "event-calendar-day",
      dayEvents.length ? "has-events" : "",
      key === todayKey ? "is-today" : "",
      key === state.selectedEventDate ? "is-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const eventSummary = dayEvents
      .map((item) => item.title || "Important event")
      .join(", ");
    const ariaLabel = `${formatEventDate(day)}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}: ${eventSummary}` : ""}`;

    cells.push(`
      <button
        class="${classes}"
        type="button"
        data-calendar-date="${key}"
        aria-label="${escapeHtml(ariaLabel)}"
        aria-pressed="${String(key === state.selectedEventDate)}"
      >
        <span>${dayNumber}</span>
        ${dayEvents.length ? `<i aria-hidden="true"></i><small>${dayEvents.length}</small>` : ""}
      </button>`
    );
  }

  grid.innerHTML = cells.join("");

  const selectedEvents = state.selectedEventDate
    ? eventsByDate.get(state.selectedEventDate) || []
    : monthEvents;
  if (!selectedEvents.length) {
    agenda.innerHTML = `
      <div class="event-calendar-empty">
        <i class="bi bi-calendar2-check" aria-hidden="true"></i>
        <span>No important events scheduled for this date.</span>
      </div>`;
    return;
  }

  agenda.innerHTML = selectedEvents
    .map(
      (item) => `
        <button class="event-calendar-agenda-item" type="button" data-calendar-event-id="${escapeHtml(item.id)}" aria-label="Edit ${escapeHtml(item.title || "Important event")}">
          <span class="event-calendar-date-badge">
            <small>${item.calendarDate.toLocaleDateString("en-PH", { month: "short" })}</small>
            <strong>${item.calendarDate.getDate()}</strong>
          </span>
          <span class="event-calendar-event-copy">
            <strong>${escapeHtml(item.title || "Important event")}</strong>
            <small><i class="bi bi-geo-alt" aria-hidden="true"></i> ${escapeHtml(item.location || "Location to be announced")}</small>
          </span>
          <span class="event-calendar-status ${item.status === "Published" ? "is-published" : "is-draft"}">${escapeHtml(item.status || "Draft")}</span>
        </button>`
    )
    .join("");
}

function moveEventCalendar(offset) {
  const current = state.calendarMonth;
  state.calendarMonth = new Date(
    current.getFullYear(),
    current.getMonth() + offset,
    1
  );

  const firstEvent = eventAnnouncements().find(
    (item) =>
      item.calendarDate.getFullYear() === state.calendarMonth.getFullYear() &&
      item.calendarDate.getMonth() === state.calendarMonth.getMonth()
  );
  state.selectedEventDate = firstEvent ? eventDateKey(firstEvent.calendarDate) : "";
  renderEventCalendar();
}

function revealCalendarEvent(id) {
  state.search = "";
  state.type = "Upcoming Events";
  state.status = "";
  if (getEl("searchAnnouncement")) getEl("searchAnnouncement").value = "";
  if (getEl("filterType")) getEl("filterType").value = state.type;
  if (getEl("filterStatus")) getEl("filterStatus").value = "";

  document.querySelectorAll("[data-category-type]").forEach((item) => {
    const selected = item.dataset.categoryType === state.type;
    item.classList.toggle("is-active", selected);
    item.setAttribute("aria-pressed", String(selected));
  });

  applyFilters();
  requestAnimationFrame(() => {
    const card = Array.from(document.querySelectorAll(".post-card")).find(
      (item) => item.dataset.announcementId === id
    );
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.classList.add("calendar-focus");
    window.setTimeout(() => card?.classList.remove("calendar-focus"), 1800);
  });
}

function showAllCalendarEvents() {
  state.search = "";
  state.type = "Upcoming Events";
  state.status = "";
  if (getEl("searchAnnouncement")) getEl("searchAnnouncement").value = "";
  if (getEl("filterType")) getEl("filterType").value = state.type;
  if (getEl("filterStatus")) getEl("filterStatus").value = "";

  document.querySelectorAll("[data-category-type]").forEach((item) => {
    const selected = item.dataset.categoryType === state.type;
    item.classList.toggle("is-active", selected);
    item.setAttribute("aria-pressed", String(selected));
  });

  applyFilters();
  getEl("announcementFeed")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showToast(message, type = "success") {
  const toast = getEl("announcementToast");
  const toastMsg = getEl("toastMsg");
  const toastIcon = getEl("toastIcon");

  if (!toast || !toastMsg || !toastIcon) return;

  toastMsg.textContent = message;

  const iconMap = {
    success: "bi-check-circle-fill",
    info: "bi-info-circle-fill",
    warning: "bi-exclamation-triangle-fill",
    danger: "bi-x-circle-fill",
  };

  toastIcon.className = `bi ${iconMap[type] || iconMap.info}`;
  toast.className = `announcement-toast show toast-${type}`;

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function getTypeClass(type) {
  const normalizedType = normalizePostType(type);
  if (normalizedType === "Upcoming Events") return "type-event";
  if (normalizedType === "Success Stories") return "type-success";
  return "type-news";
}

function applyFilters() {
  let list = [...state.announcements];

  if (state.search) {
    const term = normalize(state.search);

    list = list.filter((item) =>
      normalize(`${item.title} ${item.caption} ${item.location} ${item.createdByName}`).includes(term)
    );
  }

  if (state.type) {
    list = list.filter((item) => normalizePostType(item.type) === state.type);
  }

  if (state.status) {
    list = list.filter((item) => item.status === state.status);
  }

  state.filtered = list;
  renderHeaderStats();
  renderFeed();
  renderEventCalendar();
}

function renderFeed() {
  const feed = getEl("announcementFeed");
  if (!feed) return;

  if (!state.filtered.length) {
    feed.innerHTML = `
      <div class="empty-feed">
        <i class="bi bi-megaphone"></i>
        <h3>No announcements found</h3>
        <p>Create a new post to start showing public updates.</p>
      </div>
    `;
    return;
  }

  feed.innerHTML = state.filtered
    .map((item) => {
      const canEdit = can("edit");
      const canDelete = can("delete");
      const postType = normalizePostType(item.type);
      const isPending = Boolean(item.offlinePending);

      return `
        <article class="post-card ${isPending ? "offline-pending-post" : ""}" data-post-type="${escapeHtml(postType)}" data-announcement-id="${escapeHtml(item.id)}">
          <div class="post-header">
            <div class="post-avatar">
              <i class="bi bi-heart-fill"></i>
            </div>

            <div class="post-meta">
              <strong>ANIMUA Angeles City</strong>
              <span>
                ${isPending ? "Saved on this device" : `Posted by ${escapeHtml(item.createdByName || "ANIMUA User")}`}
                ${item.createdByRole ? `· ${escapeHtml(item.createdByRole)}` : ""}
                ${item.createdAt ? `· ${escapeHtml(isPending ? formatDateTime(item.createdAt) : formatDate(item.createdAt))}` : ""}
              </span>
            </div>

            <span class="status-pill ${isPending ? "pending" : item.status === "Published" ? "published" : "draft"}">
              ${isPending ? "Pending sync" : escapeHtml(item.status || "Draft")}
            </span>
          </div>

          ${
            item.imageUrl
              ? `<img class="post-image" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" />`
              : ""
          }

          <div class="post-body">
            <div class="post-type ${getTypeClass(item.type)}">
              ${escapeHtml(postType)}
            </div>

            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.caption)}</p>

            ${
              item.eventDate || item.location
                ? `
                  <div class="event-info">
                    ${
                      item.eventDate
                        ? `<span><i class="bi bi-calendar-event"></i> ${escapeHtml(formatEventDate(item.eventDate) || item.eventDate)}</span>`
                        : ""
                    }
                    ${
                      item.location
                        ? `<span><i class="bi bi-geo-alt"></i> ${escapeHtml(item.location)}</span>`
                        : ""
                    }
                  </div>
                `
                : ""
            }
          </div>

          <div class="post-reach">
            <span><i class="bi ${isPending ? "bi-cloud-arrow-up" : item.visibleToPublic === false ? "bi-lock-fill" : "bi-globe2"}"></i> ${isPending ? "Waiting for Wi-Fi to publish" : item.visibleToPublic === false ? "Internal post" : "Visible on the public community page"}</span>
            <span><i class="bi bi-layout-text-window-reverse"></i> ${escapeHtml(postType)}</span>
          </div>

          <div class="post-actions">
            ${
              canEdit && !isPending
                ? `<button class="secondary-btn small" type="button" data-edit-id="${escapeHtml(item.id)}" aria-label="Edit ${escapeHtml(item.title || "announcement")}">
                    <i class="bi bi-pencil"></i> Edit
                  </button>`
                : ""
            }

            ${
              canDelete && !isPending
                ? `<button class="danger-btn small" type="button" data-delete-id="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.title || "announcement")}">
                    <i class="bi bi-trash"></i> Delete
                  </button>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");

  feed.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.editId));
  });

  feed.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => confirmDelete(btn.dataset.deleteId));
  });
}

function clearPendingPreviewObjectUrls() {
  state.pendingPreviewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.pendingPreviewObjectUrls = [];
}

async function loadPendingAnnouncements() {
  try {
    const queuedItems = await getQueuedAnnouncementSaves();
    clearPendingPreviewObjectUrls();

    return queuedItems.map((item) => {
      let imageUrl = "";
      if (item.imageFile) {
        imageUrl = URL.createObjectURL(item.imageFile);
        state.pendingPreviewObjectUrls.push(imageUrl);
      }

      return {
        id: item.id,
        ...item.payload,
        imageUrl,
        createdAt: item.queuedAt,
        createdByName: "Pending sync",
        createdByRole: item.action === "update" ? "Offline update" : "Offline post",
        offlinePending: true,
        syncAttempts: item.attempts || 0,
        lastSyncError: item.lastError || "",
      };
    });
  } catch (error) {
    console.error("Failed to load offline announcements:", error);
    return [];
  }
}

async function loadAnnouncements() {
  const pendingAnnouncements = await loadPendingAnnouncements();

  try {
    const data = await getAnnouncements();
    state.announcements = [...pendingAnnouncements, ...(data.announcements || [])];
    applyFilters();
  } catch (error) {
    console.error("Failed to load announcements:", error);
    showToast(error.message || "Failed to load announcements.", "danger");
    state.announcements = pendingAnnouncements;
    applyFilters();

    const feed = getEl("announcementFeed");
    if (feed && !pendingAnnouncements.length) {
      feed.innerHTML = `
        <div class="empty-feed">
          <i class="bi bi-exclamation-triangle"></i>
          <h3>Announcements could not load</h3>
          <p>${escapeHtml(error.message || "Please check the backend connection and try again.")}</p>
        </div>
      `;
    }
  }
}

async function syncQueuedAnnouncements() {
  if (state.syncInProgress || !navigator.onLine) return;

  state.syncInProgress = true;
  let syncedCount = 0;

  try {
    const queuedItems = await getQueuedAnnouncementSaves();

    for (const item of queuedItems) {
      try {
        let announcementId = item.remoteId;

        if (item.action === "update" && announcementId) {
          await updateAnnouncement(announcementId, item.payload);
        } else {
          const created = await createAnnouncement(item.payload);
          announcementId = created.announcementId;
          if (!announcementId) throw new Error("The new announcement ID was not returned.");
        }

        if (item.imageAction === "upload" && item.imageFile) {
          await uploadAnnouncementImage(announcementId, item.imageFile);
        } else if (item.imageAction === "delete" && announcementId) {
          await deleteAnnouncementImage(announcementId);
        }

        await deleteQueuedAnnouncementSave(item.id);
        syncedCount += 1;
      } catch (error) {
        await markQueuedAnnouncementAttempt(item.id, error);
        if (isNetworkSaveError(error)) break;
      }
    }
  } catch (error) {
    console.error("Failed to sync offline announcements:", error);
  } finally {
    state.syncInProgress = false;
  }

  if (syncedCount) {
    showToast(`${syncedCount} offline announcement${syncedCount === 1 ? "" : "s"} synced.`, "success");
    await loadAnnouncements();
  }
}

function resetForm() {
  state.editingId = null;
  clearImageSelection();

  getEl("announcementForm").reset();
  getEl("fType").value = "News & Article";
  getEl("fStatus").value = "Published";
  getEl("fVisibleToPublic").value = "true";
  updateMediaPreview("");
  syncEventFields();
  syncComposerAction();
}

function clearImageSelection() {
  if (state.previewObjectUrl) {
    URL.revokeObjectURL(state.previewObjectUrl);
  }

  state.selectedImageFile = null;
  state.previewObjectUrl = "";
  state.existingImageUrl = "";
  state.removeImageRequested = false;
}

function syncEventFields() {
  const isEvent = getEl("fType")?.value === "Upcoming Events";
  const fields = getEl("eventFields");
  if (!fields) return;

  fields.hidden = !isEvent;
  fields.querySelectorAll("input").forEach((input) => {
    input.disabled = !isEvent;
    input.required = isEvent && input.id === "fEventDate";
    if (!isEvent) input.value = "";
  });
}

function syncComposerAction() {
  const status = getEl("fStatus")?.value;
  const label = getEl("announcementSubmitLabel");
  const icon = getEl("announcementSubmitIcon");
  const draftButton = getEl("announcementDraftBtn");
  if (draftButton) draftButton.hidden = status === "Draft";
  if (!label || !icon) return;

  if (status === "Draft") {
    label.textContent = state.editingId ? "Update Draft" : "Save Draft";
    icon.className = "bi bi-file-earmark-check-fill";
    return;
  }

  label.textContent = state.editingId ? "Update Post" : "Publish Post";
  icon.className = state.editingId ? "bi bi-check2-circle" : "bi bi-send-fill";
}

function saveAnnouncementDraft() {
  const status = getEl("fStatus");
  const form = getEl("announcementForm");
  if (!status || !form) return;
  status.value = "Draft";
  syncComposerAction();
  form.requestSubmit();
}

function updateMediaPreview(value, options = {}) {
  const preview = getEl("mediaPreview");
  const image = getEl("mediaPreviewImage");
  const status = getEl("mediaPreviewStatus");
  const url = String(value || "").trim();

  if (!preview || !image || !status) return;

  preview.classList.remove("has-image", "invalid");
  image.hidden = true;

  if (!url) {
    image.removeAttribute("src");
    status.textContent = "JPG, PNG, or WebP up to 5 MB.";
    getEl("removeImageBtn").hidden = true;
    return;
  }

  status.textContent = options.fileName
    ? `${options.fileName} is ready to upload.`
    : "Current cover photo.";

  image.onload = () => {
    image.hidden = false;
    preview.classList.add("has-image");
    preview.classList.remove("invalid");
    getEl("removeImageBtn").hidden = false;
  };

  image.onerror = () => {
    image.hidden = true;
    preview.classList.remove("has-image");
    preview.classList.add("invalid");
    getEl("removeImageBtn").hidden = false;
    status.textContent = "This image could not be previewed. Choose another photo.";
  };

  image.src = url;
}

function selectAnnouncementImage(file) {
  if (!file) return;

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    getEl("fImageFile").value = "";
    showToast("Choose a JPG, PNG, or WebP image.", "warning");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    getEl("fImageFile").value = "";
    showToast("The cover photo must be 5 MB or smaller.", "warning");
    return;
  }

  if (state.previewObjectUrl) URL.revokeObjectURL(state.previewObjectUrl);
  state.selectedImageFile = file;
  state.previewObjectUrl = URL.createObjectURL(file);
  state.removeImageRequested = false;
  updateMediaPreview(state.previewObjectUrl, { fileName: file.name });
}

function removeAnnouncementImage() {
  if (state.previewObjectUrl) URL.revokeObjectURL(state.previewObjectUrl);
  state.selectedImageFile = null;
  state.previewObjectUrl = "";
  state.removeImageRequested = Boolean(state.existingImageUrl);
  getEl("fImageFile").value = "";
  updateMediaPreview("");

  const status = getEl("mediaPreviewStatus");
  if (status && state.removeImageRequested) {
    status.textContent = "The current cover photo will be removed when you save.";
  }
}

function openCreateModal(defaultType = "News & Article") {
  if (!can("create")) {
    showToast("You do not have permission to create announcements.", "warning");
    return;
  }

  resetForm();
  getEl("fType").value = normalizePostType(defaultType);
  syncEventFields();
  getEl("announcementModalTitle").textContent = "Create Community Post";
  getEl("announcementModalSubtitle").textContent = "Share a clear update, story, or event with the ANIMUA community.";
  syncComposerAction();
  getEl("announcementModalBackdrop").classList.add("open");
}

function openEditModal(id) {
  if (!can("edit")) {
    showToast("You do not have permission to edit announcements.", "warning");
    return;
  }

  const item = state.announcements.find((announcement) => announcement.id === id);
  if (!item) return;

  state.editingId = id;

  getEl("announcementModalTitle").textContent = "Edit Community Post";
  getEl("announcementModalSubtitle").textContent = "Update the post details, audience, status, or cover image.";
  getEl("fTitle").value = item.title || "";
  getEl("fType").value = normalizePostType(item.type);
  getEl("fCaption").value = item.caption || "";
  clearImageSelection();
  state.existingImageUrl = item.imageUrl || "";
  getEl("fStatus").value = item.status || "Published";
  getEl("fVisibleToPublic").value = item.visibleToPublic === false ? "false" : "true";
  syncEventFields();
  if (normalizePostType(item.type) === "Upcoming Events") {
    getEl("fEventDate").value = item.eventDate || "";
    getEl("fLocation").value = item.location || "";
  }
  updateMediaPreview(state.existingImageUrl);
  syncComposerAction();

  getEl("announcementModalBackdrop").classList.add("open");
}

function closeModal() {
  getEl("announcementModalBackdrop").classList.remove("open");
  resetForm();
}

function getFormPayload() {
  return {
    title: getEl("fTitle").value.trim(),
    type: normalizePostType(getEl("fType").value),
    caption: getEl("fCaption").value.trim(),
    eventDate: getEl("fEventDate").value,
    location: getEl("fLocation").value.trim(),
    status: getEl("fStatus").value,
    visibleToPublic: getEl("fVisibleToPublic").value === "true",
  };
}

async function saveAnnouncement(event) {
  event.preventDefault();

  const action = state.editingId ? "edit" : "create";

  if (!can(action)) {
    showToast("You do not have permission to save this announcement.", "warning");
    return;
  }

  const payload = getFormPayload();

  if (!payload.title || !payload.caption) {
    showToast("Title and caption are required.", "warning");
    return;
  }

  if (payload.type === "Upcoming Events" && !payload.eventDate) {
    showToast("Choose an event date so it can appear on the calendar.", "warning");
    getEl("fEventDate")?.focus();
    return;
  }

  let detailsSaved = false;

  try {
    let announcementId = state.editingId;

    if (state.editingId) {
      await updateAnnouncement(state.editingId, payload);
    } else {
      const created = await createAnnouncement(payload);
      announcementId = created.announcementId;
      if (!announcementId) throw new Error("The new announcement ID was not returned.");
      state.editingId = announcementId;
    }
    detailsSaved = true;

    if (state.selectedImageFile) {
      await uploadAnnouncementImage(announcementId, state.selectedImageFile);
    } else if (state.removeImageRequested) {
      await deleteAnnouncementImage(announcementId);
    }

    showToast(`Announcement ${action === "edit" ? "updated" : "created"}.`, "success");
    closeModal();
    await loadAnnouncements();
  } catch (error) {
    console.error("Failed to save announcement:", error);

    if (!detailsSaved && isNetworkSaveError(error)) {
      try {
        const queued = await queueAnnouncementSave({
          action: state.editingId ? "update" : "create",
          remoteId: state.editingId || "",
          payload,
          imageFile: state.selectedImageFile,
          imageAction: state.selectedImageFile
            ? "upload"
            : state.removeImageRequested
              ? "delete"
              : "none",
        });

        showToast(
          "Saved offline. It will sync when Wi-Fi returns.",
          queued.action === "update" ? "warning" : "info"
        );
        closeModal();
        await loadAnnouncements();
      } catch (storageError) {
        console.error("Failed to save announcement offline:", storageError);
        showToast(storageError.message || "Offline storage is not available.", "danger");
      }
      return;
    }

    const message = detailsSaved
      ? `Post details were saved, but the photo change failed: ${error.message}`
      : error.message || "Failed to save announcement.";
    showToast(message, "danger");
  }
}

async function confirmDelete(id) {
  if (!can("delete")) {
    showToast("Only Admin can delete announcements.", "warning");
    return;
  }

  const announcement = state.announcements.find((item) => item.id === id);
  const title = announcement?.title || "this announcement";

  const result = await Swal.fire({
    title: "Delete announcement?",
    text: `${title} will be permanently removed. This action cannot be undone.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Delete announcement",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#780116",
    cancelButtonColor: "#ede9e2",
    reverseButtons: true,
    focusCancel: true,
    customClass: {
      popup: "announcement-delete-popup",
      cancelButton: "announcement-delete-cancel",
    },
  });

  if (!result.isConfirmed) return;

  try {
    await deleteAnnouncement(id);
    showToast("Announcement deleted.", "success");
    await loadAnnouncements();
  } catch (error) {
    console.error("Failed to delete announcement:", error);
    showToast(error.message || "Failed to delete announcement.", "danger");
  }
}

function bindEvents() {
  const newButton = getEl("btnNewAnnouncement");

  if (newButton) {
    newButton.style.display = can("create") ? "" : "none";
    newButton.addEventListener("click", () => openCreateModal());
  }

  getEl("announcementForm")?.addEventListener("submit", saveAnnouncement);
  getEl("announcementDraftBtn")?.addEventListener("click", saveAnnouncementDraft);
  getEl("announcementModalClose")?.addEventListener("click", closeModal);
  getEl("announcementCancelBtn")?.addEventListener("click", closeModal);
  getEl("fImageFile")?.addEventListener("change", (event) => {
    selectAnnouncementImage(event.target.files?.[0]);
  });
  getEl("removeImageBtn")?.addEventListener("click", removeAnnouncementImage);
  getEl("fType")?.addEventListener("change", syncEventFields);
  getEl("fStatus")?.addEventListener("change", syncComposerAction);
  getEl("eventCalendarPrev")?.addEventListener("click", () => moveEventCalendar(-1));
  getEl("eventCalendarNext")?.addEventListener("click", () => moveEventCalendar(1));
  getEl("showManagementCalendarEvents")?.addEventListener("click", showAllCalendarEvents);
  getEl("eventCalendarGrid")?.addEventListener("click", (event) => {
    const day = event.target.closest("[data-calendar-date]");
    if (!day) return;
    state.selectedEventDate = day.dataset.calendarDate || "";
    renderEventCalendar();
  });
  getEl("eventCalendarAgenda")?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-calendar-event-id]");
    if (item) revealCalendarEvent(item.dataset.calendarEventId);
  });

  getEl("announcementModalBackdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "announcementModalBackdrop") closeModal();
  });

  getEl("searchAnnouncement")?.addEventListener("input", (event) => {
    state.search = event.target.value;
    applyFilters();
  });

  getEl("filterType")?.addEventListener("change", (event) => {
    state.type = event.target.value;
    document.querySelectorAll("[data-category-type]").forEach((item) => {
      const selected = item.dataset.categoryType === state.type;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    applyFilters();
  });

  getEl("filterStatus")?.addEventListener("change", (event) => {
    state.status = event.target.value;
    applyFilters();
  });

  document.querySelectorAll("[data-category-type]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.categoryType || "";
      state.type = state.type === selected ? "" : selected;
      getEl("filterType").value = state.type;
      document.querySelectorAll("[data-category-type]").forEach((item) => {
        const isSelected = item.dataset.categoryType === state.type;
        item.classList.toggle("is-active", isSelected);
        item.setAttribute("aria-pressed", String(isSelected));
      });
      applyFilters();
    });
  });
}

async function initAnnouncementsPage() {
  try {
    const session = await protectPageByModule("announcements");
    currentRole = session.role;

    renderTopbarUser();
    loadSidebar();
    renderPageHeader(PAGE_HEADER_CONFIGS.announcements);

    bindEvents();

    document.body.classList.remove("loading");

    await loadAnnouncements();
    await syncQueuedAnnouncements();
    window.addEventListener("online", syncQueuedAnnouncements);
  } catch (error) {
    console.error("Announcements page init failed:", error);
    document.body.classList.remove("loading");

    const feed = getEl("announcementFeed");
    if (feed) {
      feed.innerHTML = `
        <div class="empty-feed">
          <i class="bi bi-exclamation-triangle"></i>
          <h3>Announcements could not load</h3>
          <p>Please check the browser console or backend connection.</p>
        </div>
      `;
    }
  }
}

initAnnouncementsPage();
