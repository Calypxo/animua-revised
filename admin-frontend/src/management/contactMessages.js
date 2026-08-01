import "../css/animalProfiling.css";
import "../css/managementTables.css";
import "../css/contactMessages.css";
import "../css/recordsPanelReference.css";

import Swal from "sweetalert2";

import { protectPageByModule } from "../auth/authGuard.js";
import { hasPermission } from "../auth/permissions.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { renderPageHeader } from "../components/management/pageHeader.js";
import { PAGE_HEADER_CONFIGS } from "../components/management/pageHeaderConfigs.js";
import { cacheContactMessageCount } from "../components/management/contactMessageBadge.js";
import { apiFetch } from "../utils/api.js";

window.Swal = Swal;
renderPageHeader(PAGE_HEADER_CONFIGS.contactMessages);

const PAGE_SIZE = 8;
const state = {
  messages: [],
  filtered: [],
  selectedId: "",
  search: "",
  status: "",
  sort: "newest",
  page: 1,
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

function messageStatus(message = {}) {
  return message.status === "Replied" ? "Replied" : "New";
}

function dateValue(value) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDate(value) {
  if (!value) return "Not recorded";
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

function formatListDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function messagePreview(value = "") {
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > 124 ? `${text.slice(0, 121)}...` : text;
}

function setText(id, value) {
  const element = el(id);
  if (element) element.textContent = String(value);
}

function setReplyStatus(message = "", type = "") {
  const status = el("replyStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.type = type;
}

function updateStats() {
  const total = state.messages.length;
  const replied = state.messages.filter(
    (message) => messageStatus(message) === "Replied"
  ).length;
  const fresh = total - replied;

  [
    ["totalMessages", total],
    ["newMessages", fresh],
    ["heroNewMessages", fresh],
    ["repliedMessages", replied],
    ["tabAllCount", total],
    ["tabNewCount", fresh],
    ["tabRepliedCount", replied],
  ].forEach(([id, value]) => setText(id, value));
}

function visibleMessages() {
  const start = (state.page - 1) * PAGE_SIZE;
  return state.filtered.slice(start, start + PAGE_SIZE);
}

function applyFilters({ resetPage = true } = {}) {
  const term = normalize(state.search);

  state.filtered = state.messages
    .filter((message) => {
      const haystack = normalize(
        `${message.fullName} ${message.email} ${message.subject} ${message.message}`
      );
      const matchesSearch = !term || haystack.includes(term);
      const matchesStatus =
        !state.status || messageStatus(message) === state.status;
      return matchesSearch && matchesStatus;
    })
    .sort((left, right) => {
      const difference =
        dateValue(right.createdAt) - dateValue(left.createdAt);
      return state.sort === "oldest" ? -difference : difference;
    });

  setText("contactResultLabel", `${state.filtered.length} ${state.filtered.length === 1 ? "record" : "records"}`);

  if (resetPage) state.page = 1;
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
  state.page = Math.min(state.page, totalPages);

  const page = visibleMessages();
  if (!page.some((message) => message.id === state.selectedId)) {
    state.selectedId = page[0]?.id || "";
  }

  renderMessageList();
  renderPagination();
  renderDetail();
}

function clearMessageFilters() {
  state.search = "";
  state.status = "";
  state.sort = "newest";
  if (el("messageSearch")) el("messageSearch").value = "";
  if (el("messageSort")) el("messageSort").value = "newest";

  document.querySelectorAll(".ap-tab[data-status]").forEach((tab) => {
    const selected = tab.dataset.status === "";
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });

  applyFilters();
}

function renderMessageList() {
  const list = el("messageList");
  if (!list) return;
  const page = visibleMessages();

  if (!page.length) {
    list.innerHTML = `
      <div class="ap-empty-state">
        <span><i class="bi bi-search" aria-hidden="true"></i></span>
        <strong>No matching contact messages</strong>
        <p>Adjust the status or search filters to view more inquiries.</p>
        <button type="button" id="emptyClearMessageFilters">Clear all filters</button>
      </div>`;
    el("emptyClearMessageFilters")?.addEventListener(
      "click",
      clearMessageFilters
    );
    return;
  }

  list.innerHTML = page
    .map((message) => {
      const active = message.id === state.selectedId;
      const status = messageStatus(message);
      const statusClass = status === "Replied" ? "is-replied" : "is-new";
      const icon = status === "Replied" ? "bi-envelope-check" : "bi-envelope-paper";

      return `
        <button
          class="cm-message-item${active ? " active" : ""}"
          type="button"
          role="listitem"
          data-id="${escapeHtml(message.id)}"
          aria-pressed="${String(active)}"
          aria-label="Open ${escapeHtml(message.subject || "contact inquiry")} from ${escapeHtml(message.fullName || "unknown sender")}"
        >
          <span class="cm-message-avatar"><i class="bi ${icon}" aria-hidden="true"></i></span>
          <span class="cm-message-copy">
            <span class="cm-message-meta">
              <span class="cm-message-status ${statusClass}">${escapeHtml(status)}</span>
              <time datetime="${escapeHtml(message.createdAt || "")}">${escapeHtml(formatListDate(message.createdAt))}</time>
            </span>
            <strong>${escapeHtml(message.subject || "Contact inquiry")}</strong>
            <span class="cm-message-sender">
              <b>${escapeHtml(message.fullName || "Unknown sender")}</b>
              <span>${escapeHtml(message.email || "No email recorded")}</span>
            </span>
            <small>${escapeHtml(messagePreview(message.message) || "No message preview available.")}</small>
          </span>
          <i class="bi bi-chevron-right cm-message-arrow" aria-hidden="true"></i>
        </button>`;
    })
    .join("");
}

function renderPagination() {
  const bar = el("paginationBar");
  if (!bar) return;

  const total = state.filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = Math.min((state.page - 1) * PAGE_SIZE + 1, total);
  const end = Math.min(state.page * PAGE_SIZE, total);

  let html = `<span class="page-info">Showing ${total ? start : 0}&ndash;${end} of ${total}</span>`;
  html += `<button class="page-btn" id="pagePrev" type="button" aria-label="Previous page" ${state.page === 1 ? "disabled" : ""}><i class="bi bi-chevron-left" aria-hidden="true"></i></button>`;
  for (let page = 1; page <= pages; page += 1) {
    html += `<button class="page-btn${page === state.page ? " active" : ""}" type="button" data-page="${page}" aria-label="Page ${page}">${page}</button>`;
  }
  html += `<button class="page-btn" id="pageNext" type="button" aria-label="Next page" ${state.page === pages ? "disabled" : ""}><i class="bi bi-chevron-right" aria-hidden="true"></i></button>`;
  bar.innerHTML = html;

  const goToPage = (page) => {
    state.page = Math.max(1, Math.min(pages, page));
    state.selectedId = visibleMessages()[0]?.id || "";
    renderMessageList();
    renderPagination();
    renderDetail();
  };

  el("pagePrev")?.addEventListener("click", () => goToPage(state.page - 1));
  el("pageNext")?.addEventListener("click", () => goToPage(state.page + 1));
  bar.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => goToPage(Number(button.dataset.page)));
  });
}

function getSelectedMessage() {
  return (
    state.messages.find((message) => message.id === state.selectedId) || null
  );
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

  const status = messageStatus(selected);
  const statusElement = el("detailStatus");
  statusElement.textContent = status;
  statusElement.className = `cm-status-pill ${status === "Replied" ? "is-replied" : "is-new"}`;
  setText("detailSubject", selected.subject || "Contact inquiry");
  setText("detailMeta", `Received ${formatDate(selected.createdAt)}`);
  setText("detailName", selected.fullName || "--");
  setText("detailEmail", selected.email || "--");
  setText("detailDate", formatDate(selected.createdAt));
  setText("detailSource", selected.source || "Contact Us Page");
  setText("detailMessage", selected.message || "");

  const emailLink = el("detailEmailLink");
  emailLink.href = selected.email ? `mailto:${selected.email}` : "#";
  emailLink.toggleAttribute("aria-disabled", !selected.email);

  const replyBox = el("replyMessage");
  if (replyBox) replyBox.value = selected.replyMessage || "";

  const sendBtn = el("sendReplyBtn");
  if (sendBtn) sendBtn.disabled = !can("reply");

  setReplyStatus(
    status === "Replied" && selected.repliedAt
      ? `Last replied ${formatDate(selected.repliedAt)}. Sending again will email an updated response.`
      : "",
    status === "Replied" ? "info" : ""
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
    cacheContactMessageCount(
      state.messages.filter(
        (message) => messageStatus(message) === "New"
      ).length
    );
    updateStats();
    applyFilters({ resetPage: false });
  } catch (error) {
    console.error("[contact messages]", error);
    state.messages = [];
    updateStats();
    applyFilters();
    await Swal.fire({
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
    confirmButtonText: "Send reply",
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
  setReplyStatus("Sending the official ANIMUA reply...", "info");

  try {
    await apiFetch(`/public/contact/${encodeURIComponent(selected.id)}/reply`, {
      method: "POST",
      body: JSON.stringify({ replyMessage }),
    });

    await Swal.fire({
      icon: "success",
      title: "Reply sent",
      text: "The sender received the official ANIMUA email response.",
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
  });
  el("messageSort")?.addEventListener("change", (event) => {
    state.sort = event.target.value;
    applyFilters();
  });
  el("clearMessageFilters")?.addEventListener("click", clearMessageFilters);

  document.querySelectorAll(".ap-tab[data-status]").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".ap-tab[data-status]").forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      state.status = tab.dataset.status || "";
      applyFilters();
    });
  });

  el("messageList")?.addEventListener("click", (event) => {
    const item = event.target.closest(".cm-message-item");
    if (item) selectMessage(item.dataset.id);
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
  } catch (error) {
    console.error("[contact messages init]", error);
  } finally {
    document.body.classList.remove("loading");
  }
});
