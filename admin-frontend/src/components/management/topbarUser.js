import "../../css/topbarAlerts.css";
import Swal from "sweetalert2";
import { endUserSession, getUserName, getUserRole } from "../../utils/storage.js";
import { apiFetch } from "../../utils/api.js";
import { getManagementNotificationDestination } from "./notificationNavigation.js";
import { syncManagementPushNotifications } from "../../services/pushNotifications.js";

let pushSyncStarted = false;

const managementSwalClasses = {
  popup: "animua-management-swal",
  confirmButton: "animua-management-swal-confirm",
  cancelButton: "animua-management-swal-cancel",
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function ensureAttentionPanel() {
  let panel = document.getElementById("managementAttentionCenter");
  if (panel) return panel;

  panel = document.createElement("aside");
  panel.id = "managementAttentionCenter";
  panel.className = "management-attention-center";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Management attention center");
  panel.innerHTML = `
    <header class="attention-center-head">
      <div>
        <span>Notifications</span>
        <strong id="attentionSummary">Checking unread updates...</strong>
      </div>
      <button class="attention-refresh" id="attentionRefresh" type="button" aria-label="Refresh alerts" title="Refresh alerts">
        <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
      </button>
    </header>
    <div class="attention-center-list" id="attentionList">
      <div class="attention-loading" aria-label="Loading alerts">
        <span></span><span></span><span></span>
      </div>
    </div>
    <footer class="attention-center-footer">
      <button id="attentionMarkSeen" type="button"><i class="bi bi-check2-all"></i> Mark all as read</button>
      <a href="/pages/dashboard.html">Open dashboard <i class="bi bi-arrow-right"></i></a>
    </footer>`;
  document.body.append(panel);
  return panel;
}

function renderAttentionCenter(panel, button, data) {
  const items = (data.notifications || []).filter((item) => item.read !== true);
  const total = Number(data.unreadCount ?? items.length);
  const badge = button.querySelector(".attention-badge");
  const summary = panel.querySelector("#attentionSummary");
  const list = panel.querySelector("#attentionList");
  const markSeen = panel.querySelector("#attentionMarkSeen");
  panel.dataset.unreadCount = String(total);

  if (summary) {
    summary.textContent = total
      ? `${total} unread notification${total === 1 ? "" : "s"}`
      : "No unread notifications";
  }

  if (badge) {
    badge.textContent = total > 99 ? "99+" : String(total);
    badge.hidden = !total;
  }
  button.classList.toggle("has-attention", Boolean(total));
  button.title = total ? `${total} unread notification${total === 1 ? "" : "s"}` : "No unread notifications";

  if (markSeen) markSeen.disabled = !total;
  if (!list) return;

  list.innerHTML = items.length
    ? items.map((item) => {
      const destination = getManagementNotificationDestination(item);
      return `
      <a class="attention-item attention-blue" href="${escapeHtml(destination)}" data-notification-id="${escapeHtml(item.id)}">
        <span class="attention-item-icon"><i class="bi bi-bell-fill" aria-hidden="true"></i></span>
        <span class="attention-item-copy">
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.message || "Open the related management record.")}</small>
        </span>
        <i class="bi bi-chevron-right attention-item-arrow" aria-hidden="true"></i>
      </a>`;
    }).join("")
    : `
      <div class="attention-empty">
        <span><i class="bi bi-check2-circle"></i></span>
        <strong>You're all caught up</strong>
        <small>New management updates will appear here.</small>
      </div>`;
}

async function loadAttentionCenter(panel, button, role, options = {}) {
  const { forceRefresh = false, showLoading = false } = options;
  const refresh = panel.querySelector("#attentionRefresh");
  if (showLoading) panel.classList.add("is-refreshing");
  refresh?.setAttribute("aria-busy", "true");
  try {
    const data = await apiFetch("/notifications");
    renderAttentionCenter(panel, button, data);
  } catch (error) {
    const summary = panel.querySelector("#attentionSummary");
    const list = panel.querySelector("#attentionList");
    if (summary) summary.textContent = "Alerts could not be refreshed";
    if (list) list.innerHTML = `
      <div class="attention-empty attention-error">
        <span><i class="bi bi-wifi-off"></i></span>
        <strong>Attention center unavailable</strong>
        <small>${escapeHtml(error.message || "Please try again shortly.")}</small>
      </div>`;
  } finally {
    refresh?.removeAttribute("aria-busy");
    panel.classList.remove("is-refreshing");
  }
}

function bindAttentionCenter(button, role) {
  if (button.dataset.attentionCenterBound === "true") return;
  button.dataset.attentionCenterBound = "true";
  const panel = ensureAttentionPanel();
  button.setAttribute("aria-controls", panel.id);
  button.setAttribute("aria-expanded", "false");

  const close = () => {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  const toggle = async () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
    if (opening) {
      const accountMenu = document.getElementById("managementAccountMenu");
      const accountTrigger = document.querySelector(".user-chip");
      if (accountMenu) accountMenu.hidden = true;
      accountTrigger?.setAttribute("aria-expanded", "false");
      await loadAttentionCenter(panel, button, role, {
        showLoading: true,
      });
    }
  };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    void toggle();
  });
  panel.addEventListener("click", async (event) => {
    event.stopPropagation();
    const item = event.target.closest("[data-notification-id]");
    if (!item) return;
    event.preventDefault();
    if (item.dataset.navigating === "true") return;
    item.dataset.navigating = "true";
    const destination = item.href;
    const notificationId = item.dataset.notificationId;
    item.remove();
    const remaining = Math.max(0, Number(panel.dataset.unreadCount || 1) - 1);
    panel.dataset.unreadCount = String(remaining);
    const badge = button.querySelector(".attention-badge");
    if (badge) {
      badge.textContent = String(remaining);
      badge.hidden = remaining === 0;
    }
    button.classList.toggle("has-attention", remaining > 0);
    const summary = panel.querySelector("#attentionSummary");
    if (summary) summary.textContent = remaining ? `${remaining} unread notification${remaining === 1 ? "" : "s"}` : "No unread notifications";
    if (!panel.querySelector("[data-notification-id]") && !remaining) panel.querySelector("#attentionList").innerHTML = `<div class="attention-empty"><span><i class="bi bi-check2-circle"></i></span><strong>You're all caught up</strong><small>New management updates will appear here.</small></div>`;
    try {
      await Promise.race([
        apiFetch(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: "PATCH", keepalive: true }),
        new Promise((resolve) => setTimeout(resolve, 900)),
      ]);
    } catch (error) {
      console.warn("Unable to mark management notification as read:", error.message);
    } finally {
      window.location.assign(destination);
    }
  });
  document.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  panel.querySelector("#attentionRefresh")?.addEventListener("click", () => {
    void loadAttentionCenter(panel, button, role, {
      forceRefresh: true,
      showLoading: true,
    });
  });
  panel.querySelector("#attentionMarkSeen")?.addEventListener("click", async () => {
    const markButton = panel.querySelector("#attentionMarkSeen");
    if (markButton.disabled) return;
    markButton.disabled = true;
    try {
      await apiFetch("/notifications/read", { method: "PATCH" });
      await loadAttentionCenter(panel, button, role);
    } catch (error) {
      markButton.disabled = false;
      console.warn("Unable to mark management notifications as read:", error.message);
    }
  });

  window.addEventListener("animua:push-notification", () => {
    void loadAttentionCenter(panel, button, role, { forceRefresh: true });
  });

  void loadAttentionCenter(panel, button, role, {
    showLoading: false,
  });
}

function ensureAccountMenu(chip, name, role, initials) {
  let menu = document.getElementById("managementAccountMenu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "managementAccountMenu";
    menu.className = "management-account-menu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Account menu");
    chip.closest(".topbar-right")?.append(menu);
  }

  if (!menu.hasChildNodes()) menu.innerHTML = `
    <div class="management-account-head">
      <span class="management-account-avatar" aria-hidden="true">${escapeHtml(initials)}</span>
      <span class="management-account-identity">
        <strong>${escapeHtml(name)}</strong>
        <small>${escapeHtml(role)}</small>
      </span>
    </div>
    <a class="management-account-action" href="/pages/accountSettings.html" role="menuitem">
      <span class="management-account-action-icon"><i class="bi bi-gear" aria-hidden="true"></i></span>
      <span><strong>Account Settings</strong><small>Profile, security, and preferences</small></span>
      <i class="bi bi-chevron-right management-account-arrow" aria-hidden="true"></i>
    </a>
    <div class="management-account-divider" aria-hidden="true"></div>
    <button class="management-account-action management-account-signout" type="button" role="menuitem">
      <span class="management-account-action-icon"><i class="bi bi-box-arrow-right" aria-hidden="true"></i></span>
      <span><strong>Sign Out</strong><small>Return to the management login</small></span>
    </button>`;

  return menu;
}

function bindAccountMenu(chip, menu) {
  if (chip.dataset.accountMenuBound === "true") return;
  chip.dataset.accountMenuBound = "true";
  chip.setAttribute("role", "button");
  chip.setAttribute("tabindex", "0");
  chip.setAttribute("aria-haspopup", "menu");
  chip.setAttribute("aria-controls", menu.id);
  chip.setAttribute("aria-expanded", "false");
  chip.setAttribute("title", "Open account menu");

  const close = ({ restoreFocus = false } = {}) => {
    menu.hidden = true;
    chip.setAttribute("aria-expanded", "false");
    if (restoreFocus) chip.focus();
  };

  const toggle = () => {
    const opening = menu.hidden;
    menu.hidden = !opening;
    chip.setAttribute("aria-expanded", String(opening));
    if (opening) {
      const attentionPanel = document.getElementById("managementAttentionCenter");
      const attentionButton = document.querySelector(".notif-btn");
      if (attentionPanel) attentionPanel.hidden = true;
      attentionButton?.setAttribute("aria-expanded", "false");
      menu.querySelector('[role="menuitem"]')?.focus();
    }
  };

  chip.addEventListener("click", (event) => {
    event.stopPropagation();
    toggle();
  });
  chip.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      if (menu.hidden) toggle();
    }
  });
  menu.addEventListener("click", (event) => event.stopPropagation());
  menu.querySelector('a[href="/pages/accountSettings.html"]')?.addEventListener("click", () => close());
  menu.querySelector(".management-account-signout")?.addEventListener("click", async () => {
    close();
    const result = await Swal.fire({
      title: "Sign out?",
      html: "Your current management session will end and you will return to the login screen.",
      icon: "question",
      iconColor: "#780116",
      showCancelButton: true,
      reverseButtons: true,
      focusCancel: true,
      confirmButtonText: '<i class="bi bi-box-arrow-right"></i> Sign Out',
      cancelButtonText: "Stay Signed In",
      customClass: managementSwalClasses,
      buttonsStyling: false,
    });
    if (!result.isConfirmed) return;
    await endUserSession();
    window.location.replace("/pages/admin-login.html");
  });
  document.addEventListener("click", () => close());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) close({ restoreFocus: true });
  });
}

export function renderTopbarUser() {
  const name = getUserName() || "Admin User";
  const role = getUserRole() || "Admin";

  const initials = name
    .split(" ")
    .map(w => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  document.getElementById("display-name")?.replaceChildren(document.createTextNode(name));
  document.getElementById("display-role")?.replaceChildren(document.createTextNode(role));
  document.getElementById("topbar-initials")?.replaceChildren(document.createTextNode(initials));

  const topbarRight = document.querySelector(".topbar-right");
  const chip = document.querySelector(".user-chip");
  if (topbarRight && chip) {
    topbarRight.querySelectorAll("button").forEach((button) => {
      if (button.querySelector(".bi-envelope")) button.remove();
    });
    let existingNotification = topbarRight.querySelector(".notif-btn");
    if (!existingNotification) {
      const notification = document.createElement("button");
      notification.type = "button";
      notification.className = "topbar-quick-action notif-btn";
      topbarRight.insertBefore(notification, chip);
      existingNotification = notification;
    }
    existingNotification.type = "button";
    existingNotification.classList.add("topbar-quick-action", "notif-btn");
    existingNotification.setAttribute("aria-label", "Management alerts");
    existingNotification.innerHTML = '<i class="bi bi-bell-fill" aria-hidden="true"></i><span class="attention-badge" hidden>0</span>';
    topbarRight.insertBefore(existingNotification, chip);
    bindAttentionCenter(existingNotification, role);
    if (!chip.querySelector(".caret")) {
      const caret = document.createElement("i");
      caret.className = "bi bi-chevron-down caret";
      caret.setAttribute("aria-hidden", "true");
      chip.append(caret);
    }
    const accountMenu = ensureAccountMenu(chip, name, role, initials);
    bindAccountMenu(chip, accountMenu);
  }

  if (!pushSyncStarted) {
    pushSyncStarted = true;
    void syncManagementPushNotifications().catch((error) => {
      console.warn("Unable to refresh browser notifications:", error.message);
    });
  }
}
