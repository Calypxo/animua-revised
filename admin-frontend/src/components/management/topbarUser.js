import "../../css/topbarAlerts.css";
import { getUserName, getUserRole } from "../../utils/storage.js";
import { canAccessModule, normalizeRole } from "../../auth/permissions.js";
import { apiFetch } from "../../utils/api.js";

const ATTENTION_SEEN_KEY = "animua_attention_seen";

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
  }

  if (canAccessModule(role, "inventory")) {
    const lowStock = Array.isArray(data.lowStockItems) ? data.lowStockItems : [];
    const critical = lowStock.filter((item) => item.level === "Critical").length;
    add({
      id: "inventory",
      count: lowStock.length,
      tone: critical ? "red" : "amber",
      icon: "bi-box-seam-fill",
      title: critical ? "Critical inventory attention" : "Low-stock inventory",
      detail: critical
        ? `${critical} critical and ${Math.max(0, lowStock.length - critical)} low-stock item(s).`
        : `${lowStock.length} item(s) should be restocked soon.`,
      href: "/pages/inventory.html",
    });
  }

  if (canAccessModule(role, "animals")) {
    const longStayAlert = (Array.isArray(data.alerts) ? data.alerts : [])
      .find((alert) => String(alert.title || "").includes("over 60 days"));
    const longStayCount = Number(String(longStayAlert?.title || "").match(/^\d+/)?.[0] || 0);
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

async function loadAttentionCenter(panel, button, role, showLoading = false) {
  const refresh = panel.querySelector("#attentionRefresh");
  if (showLoading) panel.classList.add("is-refreshing");
  refresh?.setAttribute("aria-busy", "true");
  try {
    const data = await apiFetch("/dashboard/stats");
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
  const toggle = () => {
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
  };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggle();
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  panel.querySelector("#attentionRefresh")?.addEventListener("click", () => {
    loadAttentionCenter(panel, button, role, true);
  });
  panel.querySelector("#attentionMarkSeen")?.addEventListener("click", () => {
    localStorage.setItem(ATTENTION_SEEN_KEY, panel.dataset.signature || "");
    const badge = button.querySelector(".attention-badge");
    if (badge) badge.hidden = true;
    button.classList.remove("has-attention");
    panel.querySelector("#attentionMarkSeen").disabled = true;
  });

  loadAttentionCenter(panel, button, role);
  window.setInterval(() => loadAttentionCenter(panel, button, role), 60000);
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
  }

  if (chip && chip.dataset.accountSettingsBound !== "true") {
    chip.dataset.accountSettingsBound = "true";
    chip.setAttribute("role", "link");
    chip.setAttribute("tabindex", "0");
    chip.setAttribute("title", "Open Account Settings");

    const openAccountSettings = () => {
      window.location.href = "/pages/accountSettings.html";
    };

    chip.addEventListener("click", openAccountSettings);
    chip.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAccountSettings();
      }
    });
  }
}
