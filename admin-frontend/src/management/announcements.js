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
} from "../services/announcement.service.js";

window.Swal = Swal;

const state = {
  announcements: [],
  filtered: [],
  search: "",
  type: "",
  status: "",
  editingId: null,
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
  const drafts = state.announcements.filter((item) => item.status === "Draft").length;
  const published = state.announcements.filter((item) => item.status === "Published").length;
  const publicPosts = state.announcements.filter((item) => item.status === "Published" && item.visibleToPublic !== false).length;
  const countType = (type) => state.announcements.filter((item) => normalizePostType(item.type) === type).length;

  setHeaderValue("announcementTotal", state.announcements.length);
  setHeaderValue("announcementPublished", published);
  setHeaderValue("announcementDrafts", drafts);
  setHeaderValue("heroDraftCount", drafts);
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

      return `
        <article class="post-card" data-post-type="${escapeHtml(postType)}">
          <div class="post-header">
            <div class="post-avatar">
              <i class="bi bi-heart-fill"></i>
            </div>

            <div class="post-meta">
              <strong>ANIMUA Angeles City</strong>
              <span>
                Posted by ${escapeHtml(item.createdByName || "ANIMUA User")}
                ${item.createdByRole ? `· ${escapeHtml(item.createdByRole)}` : ""}
                ${item.createdAt ? `· ${escapeHtml(formatDate(item.createdAt))}` : ""}
              </span>
            </div>

            <span class="status-pill ${item.status === "Published" ? "published" : "draft"}">
              ${escapeHtml(item.status || "Draft")}
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
                        ? `<span><i class="bi bi-calendar-event"></i> ${escapeHtml(item.eventDate)}</span>`
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
            <span><i class="bi ${item.visibleToPublic === false ? "bi-lock-fill" : "bi-globe2"}"></i> ${item.visibleToPublic === false ? "Internal post" : "Visible on the public community page"}</span>
            <span><i class="bi bi-layout-text-window-reverse"></i> ${escapeHtml(postType)}</span>
          </div>

          <div class="post-actions">
            ${
              canEdit
                ? `<button class="secondary-btn small" data-edit-id="${escapeHtml(item.id)}">
                    <i class="bi bi-pencil"></i> Edit
                  </button>`
                : ""
            }

            ${
              canDelete
                ? `<button class="danger-btn small" data-delete-id="${escapeHtml(item.id)}">
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

async function loadAnnouncements() {
  try {
    const data = await getAnnouncements();
    state.announcements = data.announcements || [];
    applyFilters();
  } catch (error) {
    console.error("Failed to load announcements:", error);
    showToast(error.message || "Failed to load announcements.", "danger");

    const feed = getEl("announcementFeed");
    if (feed) {
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

function resetForm() {
  state.editingId = null;

  getEl("announcementForm").reset();
  getEl("fType").value = "News & Article";
  getEl("fStatus").value = "Published";
  getEl("fVisibleToPublic").value = "true";
  updateMediaPreview("");
  syncEventFields();
}

function syncEventFields() {
  const isEvent = getEl("fType")?.value === "Upcoming Events";
  const fields = getEl("eventFields");
  if (!fields) return;

  fields.hidden = !isEvent;
  fields.querySelectorAll("input").forEach((input) => {
    input.disabled = !isEvent;
    if (!isEvent) input.value = "";
  });
}

function updateMediaPreview(value) {
  const preview = getEl("mediaPreview");
  const image = getEl("mediaPreviewImage");
  const status = getEl("mediaPreviewStatus");
  const url = String(value || "").trim();

  if (!preview || !image || !status) return;

  preview.classList.remove("has-image", "invalid");
  image.hidden = true;

  if (!url) {
    image.removeAttribute("src");
    status.textContent = "JPG, PNG, or WebP links work best.";
    return;
  }

  status.textContent = "Loading image preview...";

  image.onload = () => {
    image.hidden = false;
    preview.classList.add("has-image");
    preview.classList.remove("invalid");
    status.textContent = "Image ready for your post.";
  };

  image.onerror = () => {
    image.hidden = true;
    preview.classList.remove("has-image");
    preview.classList.add("invalid");
    status.textContent = "This image could not be loaded. Check that the URL is public.";
  };

  image.src = url;
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
  getEl("fTitle").value = item.title || "";
  getEl("fType").value = normalizePostType(item.type);
  getEl("fCaption").value = item.caption || "";
  getEl("fImageUrl").value = item.imageUrl || "";
  getEl("fStatus").value = item.status || "Published";
  getEl("fVisibleToPublic").value = item.visibleToPublic === false ? "false" : "true";
  syncEventFields();
  if (normalizePostType(item.type) === "Upcoming Events") {
    getEl("fEventDate").value = item.eventDate || "";
    getEl("fLocation").value = item.location || "";
  }
  updateMediaPreview(item.imageUrl || "");

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
    imageUrl: getEl("fImageUrl").value.trim(),
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

  try {
    if (state.editingId) {
      await updateAnnouncement(state.editingId, payload);
      showToast("Announcement updated.", "success");
    } else {
      await createAnnouncement(payload);
      showToast("Announcement created.", "success");
    }

    closeModal();
    await loadAnnouncements();
  } catch (error) {
    console.error("Failed to save announcement:", error);
    showToast(error.message || "Failed to save announcement.", "danger");
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

  const quickCreate = getEl("quickCreatePost");
  if (quickCreate) {
    quickCreate.hidden = !can("create");
    quickCreate.addEventListener("click", () => openCreateModal());
  }

  getEl("announcementForm")?.addEventListener("submit", saveAnnouncement);
  getEl("announcementModalClose")?.addEventListener("click", closeModal);
  getEl("announcementCancelBtn")?.addEventListener("click", closeModal);
  getEl("fImageUrl")?.addEventListener("input", (event) => {
    updateMediaPreview(event.target.value);
  });
  getEl("fType")?.addEventListener("change", syncEventFields);

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
      item.classList.toggle("is-active", item.dataset.categoryType === state.type);
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
        item.classList.toggle("is-active", item.dataset.categoryType === state.type);
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
