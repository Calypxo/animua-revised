import { API_BASE_URL } from "../../utils/api.js";
import {
  clearUserSession,
  hasUserSession,
  isAuthenticationFailure,
} from "../../utils/storage.js";

const PENDING_PROFILE_ACTION_KEY = "animua_pending_profile_action";
let notificationRequest = null;

function escapeHtml(value = "") {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

function getNotificationElements() {
  return {
    button: document.getElementById("notificationBtn"),
    popup: document.getElementById("notificationPopup"),
    badge: document.querySelector("#notificationBtn .notification-dot"),
  };
}

function getNotificationIcon(category = "", type = "") {
  if (category === "contact") return "fa-regular fa-envelope";
  if (category === "application") return "fa-solid fa-file-circle-check";
  if (category === "surrender") return "fa-solid fa-hand-holding-heart";
  if (category === "event" || type.includes("event")) return "fa-solid fa-bullhorn";
  return "fa-solid fa-bell";
}

function formatNotificationTime(value = "") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function updatePublicNotificationBadge(unreadCount = 0) {
  const { button, badge } = getNotificationElements();
  if (!button || !badge) return;

  const safeCount = Math.max(0, Number(unreadCount || 0));
  badge.hidden = safeCount <= 0;
  badge.textContent = safeCount > 99 ? "99+" : safeCount ? String(safeCount) : "";
  button.setAttribute(
    "aria-label",
    safeCount > 0 ? `Notifications, ${safeCount} unread` : "Notifications",
  );
}

function renderNotificationPopup(items = [], unreadCount = 0) {
  const { popup } = getNotificationElements();
  if (!popup) return;

  popup.innerHTML = `
    <div class="notification-popup-head">
      <div class="notification-popup-title">
        <h4>Notifications</h4>
        <p>${unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "All caught up"}</p>
      </div>
      <button type="button" class="notification-settings-mini" data-notification-settings>
        <i class="fa-solid fa-gear" aria-hidden="true"></i>
        <span>Settings</span>
      </button>
    </div>
    <div class="notification-list notification-inbox-list">
      ${items.length
        ? items.map((item) => `
            <a class="notification-item ${item.read === true ? "" : "is-unread"}" href="${escapeHtml(item.link || "#")}">
              <span class="notification-item-icon"><i class="${getNotificationIcon(item.category, item.type || "")}" aria-hidden="true"></i></span>
              <span class="notification-item-copy">
                <strong>${escapeHtml(item.title || "ANIMUA update")}</strong>
                <small>${escapeHtml(item.message || "")}</small>
                <time>${escapeHtml(formatNotificationTime(item.createdAt || item.eventDate))}</time>
              </span>
            </a>
          `).join("")
        : '<p class="notification-empty">No notifications yet.</p>'}
    </div>
  `;

  popup.querySelector("[data-notification-settings]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    sessionStorage.setItem(PENDING_PROFILE_ACTION_KEY, "notifications");
    window.location.href = "/pages/public/home.html";
  });

  updatePublicNotificationBadge(unreadCount);
}

function renderNotificationMessage(message, subtitle = "Checking updates") {
  const { popup } = getNotificationElements();
  if (!popup) return;

  popup.innerHTML = `
    <div class="notification-popup-head">
      <div class="notification-popup-title">
        <h4>Notifications</h4>
        <p>${escapeHtml(subtitle)}</p>
      </div>
    </div>
    <div class="notification-list notification-inbox-list">
      <p class="notification-empty">${escapeHtml(message)}</p>
    </div>
  `;
}

async function requestNotifications() {
  if (!hasUserSession()) return { notifications: [], unreadCount: 0 };
  if (notificationRequest) return notificationRequest;

  notificationRequest = fetch(`${API_BASE_URL}/notifications?audience=public`, {
    credentials: "include",
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.message || "Unable to load notifications.");
        error.status = response.status;
        throw error;
      }
      return data;
    })
    .finally(() => {
      notificationRequest = null;
    });

  return notificationRequest;
}

export async function refreshPublicNotifications({ renderPopup = false } = {}) {
  if (!hasUserSession()) {
    updatePublicNotificationBadge(0);
    return null;
  }

  try {
    const data = await requestNotifications();
    const unreadCount = Number(data.unreadCount || 0);
    if (renderPopup) renderNotificationPopup(data.notifications || [], unreadCount);
    else updatePublicNotificationBadge(unreadCount);
    return data;
  } catch (error) {
    if (isAuthenticationFailure(error)) clearUserSession();
    updatePublicNotificationBadge(0);
    if (renderPopup) {
      renderNotificationMessage(
        error.message || "Unable to load notifications.",
        "Could not load updates",
      );
    }
    return null;
  }
}

async function markPublicNotificationsRead() {
  const response = await fetch(`${API_BASE_URL}/notifications/read?audience=public`, {
    method: "PATCH",
    credentials: "include",
  });
  if (!response.ok) return;

  updatePublicNotificationBadge(0);
  document.querySelectorAll("#notificationPopup .notification-item.is-unread")
    .forEach((item) => item.classList.remove("is-unread"));
}

async function togglePublicNotifications() {
  const { popup } = getNotificationElements();
  if (!popup) return;

  if (!hasUserSession()) {
    sessionStorage.setItem("animua_open_auth_modal", "true");
    window.location.href = "/pages/public/home.html";
    return;
  }

  const willOpen = !popup.classList.contains("show");
  document.getElementById("userDropdown")?.classList.add("hidden");
  popup.classList.toggle("show", willOpen);
  if (!willOpen) return;

  renderNotificationMessage("Loading notifications...");
  const data = await refreshPublicNotifications({ renderPopup: true });
  if (Number(data?.unreadCount || 0) > 0) {
    markPublicNotificationsRead().catch((error) => {
      console.warn("Unable to mark notifications as read:", error.message);
    });
  }
}

export function initializePublicNotifications() {
  const { button } = getNotificationElements();
  if (!button || button.dataset.notificationsBound === "true") return;

  button.dataset.notificationsBound = "true";
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePublicNotifications();
  });

  refreshPublicNotifications();
}
