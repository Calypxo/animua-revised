import "../../css/topbarAlerts.css";
import Swal from "sweetalert2";
import { clearUserSession, getUserName, getUserRole } from "../../utils/storage.js";
import { canAccessModule, normalizeRole } from "../../auth/permissions.js";
import { apiFetch } from "../../utils/api.js";
import { cacheContactMessageCount } from "./contactMessageBadge.js";

const ATTENTION_SEEN_KEY = "animua_attention_seen";
const ATTENTION_CACHE_KEY = "animua_attention_summary";
const ATTENTION_CLIENT_CACHE_TTL_MS = 15 * 60_000;

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function attentionItems(data, role) {
  const items = [];
  const add = (item) => {
    if (Number(item.count || 0) > 0) items.push(item);
  };

  if (canAccessModule(role, "intake")) {
    add({
      id: "intake",
      count: data.intake,
      tone: "red",
      icon: "bi-box-arrow-in-down",
      title: "Intake records need review",
      detail: `${Number(data.intake || 0)} active record(s) await review or conversion.`,
      href: "/pages/intakeList.html",
    });
  }

  if (canAccessModule(role, "adoption")) {
    add({
      id: "adoption",
      count: data.pendingAdoptions,
      tone: "amber",
      icon: "bi-house-heart-fill",
      title: "Adoption applications pending",
      detail: `${Number(data.pendingAdoptions || 0)} application(s) are waiting for a decision.`,
      href: "/pages/adoptionApplications.html",
    });
    add({
      id: "adoption-no-show",
      count: data.adoptionNoShowRisk,
      tone: "red",
      icon: "bi-calendar-x-fill",
      title: "Adoption attendance at risk",
      detail: `${Number(data.adoptionNoShowRisk || 0)} approved adoption(s) need deadline or no-show review.`,
      href: "/pages/adoptionApplications.html",
    });
  }

  if (canAccessModule(role, "surrender")) {
    add({
      id: "surrender",
      count: data.pendingSurrenders,
      tone: "amber",
      icon: "bi-file-earmark-text-fill",
      title: "Surrender requests pending",
      detail: `${Number(data.pendingSurrenders || 0)} request(s) require management review.`,
      href: "/pages/surrenders.html",
    });
    add({
      id: "surrender-no-show",
      count: data.surrenderNoShowRisk,
      tone: "red",
      icon: "bi-calendar-x-fill",
      title: "Surrender attendance at risk",
      detail: `${Number(data.surrenderNoShowRisk || 0)} approved surrender request(s) need deadline or no-show review.`,
      href: "/pages/surrenders.html",
    });
  }

  if (canAccessModule(role, "inventory")) {
    const lowStockCount = Number(data.lowStockCount || 0);
    const critical = Number(data.criticalStockCount || 0);
    add({
      id: "inventory",
      count: lowStockCount,
      tone: critical ? "red" : "amber",
      icon: "bi-box-seam-fill",
      title: critical ? "Critical inventory attention" : "Low-stock inventory",
      detail: critical
        ? `${critical} critical and ${Math.max(0, lowStockCount - critical)} low-stock item(s).`
        : `${lowStockCount} item(s) should be restocked soon.`,
      href: "/pages/inventory.html",
    });
  }

  if (canAccessModule(role, "animals")) {
    const longStayCount = Number(data.longStayCount || 0);
    add({
      id: "long-stay",
      count: longStayCount,
      tone: "red",
      icon: "bi-clock-history",
      title: "Long-stay animals need review",
      detail: `${longStayCount} animal(s) have been in shelter care for over 60 days.`,
      href: "/pages/animalProfiling.html",
    });
  }

  if (normalizeRole(role) === "Veterinarian") {
    add({
      id: "quarantine",
      count: data.quarantine,
      tone: "amber",
      icon: "bi-shield-plus",
      title: "Animals under veterinary care",
      detail: `${Number(data.quarantine || 0)} animal(s) are currently in quarantine.`,
      href: "/pages/animalProfiling.html",
    });
  }

  return items;
}

function readCachedAttentionSummary() {
  try {
    const cached = JSON.parse(localStorage.getItem(ATTENTION_CACHE_KEY) || "null");
    if (
      !cached?.data ||
      Date.now() - Number(cached.savedAt || 0) > ATTENTION_CLIENT_CACHE_TTL_MS
    ) {
      return null;
    }
    return cached.data;
  } catch (_) {
    return null;
  }

  if (canAccessModule(role, "contact")) {
    add({
      id: "contact",
      count: data.newContactMessages,
      tone: "blue",
      icon: "bi-envelope-paper-fill",
      title: "New contact messages",
      detail: `${Number(data.newContactMessages || 0)} public ${Number(data.newContactMessages || 0) === 1 ? "inquiry awaits" : "inquiries await"} a reply.`,
      href: "/pages/contactMessages.html",
    });
  }
}

function cacheAttentionSummary(data) {
  localStorage.setItem(ATTENTION_CACHE_KEY, JSON.stringify({
    savedAt: Date.now(),
    data,
  }));
  cacheContactMessageCount(data.newContactMessages);
}

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
        <span>Attention center</span>
        <strong id="attentionSummary">Checking operational queues...</strong>
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
      <button id="attentionMarkSeen" type="button"><i class="bi bi-check2-all"></i> Mark as seen</button>
      <a href="/pages/dashboard.html">Open dashboard <i class="bi bi-arrow-right"></i></a>
    </footer>`;
  document.body.append(panel);
  return panel;
}

function renderAttentionCenter(panel, button, data, role) {
  const items = attentionItems(data, role);
  const total = items.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const signature = items.map((item) => `${item.id}:${item.count}`).join("|");
  const savedSignature = localStorage.getItem(ATTENTION_SEEN_KEY) || "";
  const badge = button.querySelector(".attention-badge");
  const summary = panel.querySelector("#attentionSummary");
  const list = panel.querySelector("#attentionList");
  const markSeen = panel.querySelector("#attentionMarkSeen");

  panel.dataset.signature = signature;
  if (summary) {
    summary.textContent = total
      ? `${total} record${total === 1 ? "" : "s"} across ${items.length} area${items.length === 1 ? "" : "s"}`
      : "No records currently need attention";
  }

  if (badge) {
    badge.textContent = total > 99 ? "99+" : String(total);
    badge.hidden = !total || signature === savedSignature;
  }
  button.classList.toggle("has-attention", Boolean(total && signature !== savedSignature));
  button.title = total ? `${total} management alert${total === 1 ? "" : "s"}` : "No current alerts";

  if (markSeen) markSeen.disabled = !total || signature === savedSignature;
  if (!list) return;

  list.innerHTML = items.length
    ? items.map((item) => `
      <a class="attention-item attention-${escapeHtml(item.tone)}" href="${escapeHtml(item.href)}">
        <span class="attention-item-icon"><i class="bi ${escapeHtml(item.icon)}" aria-hidden="true"></i></span>
        <span class="attention-item-copy">
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.detail)}</small>
        </span>
        <span class="attention-item-count">${Number(item.count || 0)}</span>
        <i class="bi bi-chevron-right attention-item-arrow" aria-hidden="true"></i>
      </a>`).join("")
    : `
      <div class="attention-empty">
        <span><i class="bi bi-check2-circle"></i></span>
        <strong>Everything is up to date</strong>
        <small>No pending requests or operational risks need attention.</small>
      </div>`;
}

async function loadAttentionCenter(panel, button, role, options = {}) {
  const { forceRefresh = false, showLoading = false } = options;
  const refresh = panel.querySelector("#attentionRefresh");
  if (showLoading) panel.classList.add("is-refreshing");
  refresh?.setAttribute("aria-busy", "true");
  try {
    const data = await apiFetch(
      `/dashboard/attention${forceRefresh ? "?refresh=1" : ""}`
    );
    cacheAttentionSummary(data);
    renderAttentionCenter(panel, button, data, role);
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
        showLoading: !readCachedAttentionSummary(),
      });
    }
  };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    void toggle();
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
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
  panel.querySelector("#attentionMarkSeen")?.addEventListener("click", () => {
    localStorage.setItem(ATTENTION_SEEN_KEY, panel.dataset.signature || "");
    const badge = button.querySelector(".attention-badge");
    if (badge) badge.hidden = true;
    button.classList.remove("has-attention");
    panel.querySelector("#attentionMarkSeen").disabled = true;
  });

  const cached = readCachedAttentionSummary();
  if (cached) renderAttentionCenter(panel, button, cached, role);
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
      text: "You'll be returned to the management login screen.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#780116",
      cancelButtonColor: "#756367",
      confirmButtonText: "Yes, sign out",
    });
    if (!result.isConfirmed) return;
    clearUserSession();
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
}
