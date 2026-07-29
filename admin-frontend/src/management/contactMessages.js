import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../css/contactMessages.css";

import Swal from "sweetalert2";

import { protectPageByModule } from "../auth/authGuard.js";
import { hasPermission } from "../auth/permissions.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { apiFetch } from "../utils/api.js";

window.Swal = Swal;

const state = {
  messages: [],
  filtered: [],
  selectedId: "",
  search: "",
  status: "",
};

let currentRole = "";

function can(action) {
  return hasPermission(currentRole, "contact", action);
}

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value = "") {
  return String(value).toLowerCase().trim();
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function setReplyStatus(message = "", type = "") {
  const status = el("replyStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.type = type;
}

function updateStats() {
  const total = state.messages.length;
  const replied = state.messages.filter((item) => item.status === "Replied").length;
  const fresh = state.messages.filter((item) => item.status !== "Replied").length;

  el("totalMessages").textContent = total;
  el("newMessages").textContent = fresh;
  el("repliedMessages").textContent = replied;
}

function applyFilters() {
  const term = normalize(state.search);

  state.filtered = state.messages.filter((message) => {
    const haystack = normalize(
      `${message.fullName} ${message.email} ${message.subject} ${message.message}`
    );

    const matchesSearch = !term || haystack.includes(term);
    const matchesStatus = !state.status || message.status === state.status;

    return matchesSearch && matchesStatus;
  });
}

function renderMessageList() {
  const list = el("messageList");
  if (!list) return;

  if (!state.filtered.length) {
    list.innerHTML = '<p class="cm-empty">No contact messages found.</p>';
    return;
  }

  list.innerHTML = state.filtered
    .map((message) => {
      const active = message.id === state.selectedId ? "active" : "";
      const statusClass = message.status === "Replied" ? "is-replied" : "is-new";

      return `
        <button class="cm-message-item ${active}" type="button" data-id="${escapeHtml(message.id)}">
          <span class="cm-message-status ${statusClass}">${escapeHtml(message.status || "New")}</span>
          <strong>${escapeHtml(message.subject || "Contact inquiry")}</strong>
          <span>${escapeHtml(message.fullName || "Unknown sender")} - ${escapeHtml(message.email || "")}</span>
          <small>${escapeHtml(formatDate(message.createdAt))}</small>
        </button>
      `;
    })
    .join("");
}

function getSelectedMessage() {
  return state.messages.find((message) => message.id === state.selectedId) || null;
}

function renderDetail() {
  const detail = el("messageDetail");
  const empty = el("messageDetailEmpty");
  const selected = getSelectedMessage();

  if (!detail || !empty) return;

  if (!selected) {
    detail.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  detail.classList.remove("hidden");

  el("detailStatus").textContent = selected.status || "New";
  el("detailStatus").className = `cm-status-pill ${selected.status === "Replied" ? "is-replied" : "is-new"}`;
  el("detailSubject").textContent = selected.subject || "Contact inquiry";
  el("detailMeta").textContent = `Received ${formatDate(selected.createdAt)}`;
  el("detailName").textContent = selected.fullName || "-";
  el("detailEmail").textContent = selected.email || "-";
  el("detailDate").textContent = formatDate(selected.createdAt);
  el("detailSource").textContent = selected.source || "Contact Us Page";
  el("detailMessage").textContent = selected.message || "";
  el("detailEmailLink").href = selected.email ? `mailto:${selected.email}` : "#";

  const replyBox = el("replyMessage");
  if (replyBox) {
    replyBox.value = selected.replyMessage || "";
  }

  const sendBtn = el("sendReplyBtn");
  if (sendBtn) {
    sendBtn.disabled = !can("reply");
  }

  setReplyStatus(
    selected.status === "Replied" && selected.repliedAt
      ? `Last replied ${formatDate(selected.repliedAt)}. Sending again will email an updated response.`
      : "",
    selected.status === "Replied" ? "info" : ""
  );
}

function selectMessage(id) {
  state.selectedId = id;
  renderMessageList();
  renderDetail();
}

async function loadMessages() {
  const refreshBtn = el("refreshMessagesBtn");
  refreshBtn?.setAttribute("aria-busy", "true");

  try {
    const data = await apiFetch("/public/contact/messages");
    state.messages = data.messages || [];

    if (!state.selectedId && state.messages[0]) {
      state.selectedId = state.messages[0].id;
    }

    applyFilters();
    updateStats();
    renderMessageList();
    renderDetail();
  } catch (error) {
    console.error("[contact messages]", error);
    Swal.fire({
      icon: "error",
      title: "Unable to load messages",
      text: error.message || "Please try again later.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm",
      },
      buttonsStyling: false,
    });
  } finally {
    refreshBtn?.removeAttribute("aria-busy");
  }
}

async function sendReply(event) {
  event.preventDefault();

  const selected = getSelectedMessage();
  const replyMessage = el("replyMessage")?.value.trim();

  if (!selected || !replyMessage) {
    setReplyStatus("Write a reply message before sending.", "error");
    return;
  }

  const confirm = await Swal.fire({
    icon: "question",
    title: "Send ANIMUA reply?",
    text: `This will email ${selected.email}.`,
    showCancelButton: true,
    confirmButtonText: "Send Reply",
    cancelButtonText: "Cancel",
    customClass: {
      popup: "animua-popup",
      confirmButton: "animua-confirm",
      cancelButton: "animua-cancel",
    },
    buttonsStyling: false,
  });

  if (!confirm.isConfirmed) return;

  const sendBtn = el("sendReplyBtn");
  sendBtn.disabled = true;
  setReplyStatus("Sending styled ANIMUA reply...", "info");

  try {
    await apiFetch(`/public/contact/${encodeURIComponent(selected.id)}/reply`, {
      method: "POST",
      body: JSON.stringify({ replyMessage }),
    });

    setReplyStatus("Reply sent successfully.", "success");

    Swal.fire({
      icon: "success",
      title: "Reply Sent",
      text: "The user received the styled ANIMUA reply email.",
      timer: 1700,
      showConfirmButton: false,
      customClass: {
        popup: "animua-popup animua-auth-feedback-popup",
      },
      buttonsStyling: false,
    });

    await loadMessages();
  } catch (error) {
    console.error("[send contact reply]", error);
    setReplyStatus(error.message || "Failed to send reply.", "error");
  } finally {
    sendBtn.disabled = !can("reply");
  }
}

function bindEvents() {
  el("refreshMessagesBtn")?.addEventListener("click", loadMessages);

  el("messageSearch")?.addEventListener("input", (event) => {
    state.search = event.target.value;
    applyFilters();
    renderMessageList();
  });

  el("messageStatusFilter")?.addEventListener("change", (event) => {
    state.status = event.target.value;
    applyFilters();
    renderMessageList();
  });

  el("messageList")?.addEventListener("click", (event) => {
    const item = event.target.closest(".cm-message-item");
    if (!item) return;
    selectMessage(item.dataset.id);
  });

  el("replyForm")?.addEventListener("submit", sendReply);
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const session = await protectPageByModule("contact");
    currentRole = session.role || localStorage.getItem("animua_role") || "";

    renderTopbarUser();
    loadSidebar();
    bindEvents();
    await loadMessages();

    document.body.classList.remove("loading");
  } catch (error) {
    console.error("[contact messages init]", error);
    document.body.classList.remove("loading");
  }
});
