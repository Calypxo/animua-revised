import "../css/animalProfiling.css";
import "../css/managementTables.css";
import "../css/recordsPanelReference.css";
import "../css/contactMessages.css";

import Swal from "sweetalert2";

import { protectPageByModule } from "../auth/authGuard.js";
import { hasPermission } from "../auth/permissions.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { renderPageHeader } from "../components/management/pageHeader.js";
import { PAGE_HEADER_CONFIGS } from "../components/management/pageHeaderConfigs.js";
import { cacheContactMessageCount } from "../components/management/contactMessageBadge.js";
import { apiFetch } from "../utils/api.js";
import {
  shouldSendReplyOnKeydown,
  getReplyDraft,
  saveReplyDraft,
  clearReplyDraft,
} from "./contactReplyComposer.js";

window.Swal = Swal;
renderPageHeader(PAGE_HEADER_CONFIGS.contactMessages);

const state = {
  messages: [],
  users: [],
  filtered: [],
  selectedUserKey: "",
  selectedId: "",
  search: "",
  status: "",
  sort: "newest",
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

function messageUserKey(message = {}) {
  return normalize(message.userId || message.email || `legacy:${message.fullName}`);
}

function buildUsers(messages = []) {
  const users = new Map();

  messages.forEach((message) => {
    const key = messageUserKey(message);
    if (!users.has(key)) {
      users.set(key, {
        key,
        fullName: message.fullName || "Unknown user",
        email: message.email || "",
        messages: [],
      });
    }

    const user = users.get(key);
    user.messages.push(message);
    user.fullName = message.fullName || user.fullName;
    user.email = message.email || user.email;
  });

  return Array.from(users.values()).map((user) => {
    user.messages.sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt));
    user.latestAt = user.messages[0]?.createdAt || "";
    user.newCount = user.messages.filter((message) => messageStatus(message) === "New").length;
    user.repliedCount = user.messages.length - user.newCount;
    return user;
  });
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
  const usersWithNew = state.users.filter((user) => user.newCount > 0).length;
  const usersWithReplies = state.users.filter((user) => user.repliedCount > 0).length;

  [
    ["totalMessages", total],
    ["newMessages", fresh],
    ["heroNewMessages", fresh],
    ["repliedMessages", replied],
    ["tabAllCount", state.users.length],
    ["tabNewCount", usersWithNew],
    ["tabRepliedCount", usersWithReplies],
  ].forEach(([id, value]) => setText(id, value));
}

function visibleUsers() {
  return state.filtered;
}

function applyFilters() {
  const term = normalize(state.search);

  state.filtered = state.users
    .filter((user) => {
      const haystack = normalize(
        `${user.fullName} ${user.email} ${user.messages.map((message) => `${message.subject} ${message.message}`).join(" ")}`
      );
      const matchesSearch = !term || haystack.includes(term);
      const matchesStatus =
        !state.status || user.messages.some((message) => messageStatus(message) === state.status);
      return matchesSearch && matchesStatus;
    })
    .sort((left, right) => {
      const difference =
        dateValue(right.latestAt) - dateValue(left.latestAt);
      return state.sort === "oldest" ? -difference : difference;
    });

  setText("contactResultLabel", `${state.filtered.length} ${state.filtered.length === 1 ? "user" : "users"}`);

  const page = visibleUsers();
  if (!page.some((user) => user.key === state.selectedUserKey)) {
    state.selectedUserKey = "";
    state.selectedId = "";
  }

  renderMessageList();
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
  const page = visibleUsers();

  if (!page.length) {
    list.innerHTML = `
      <div class="ap-empty-state">
        <span><i class="bi bi-search" aria-hidden="true"></i></span>
        <strong>No matching users</strong>
        <p>Adjust the status or search filters to view more contact accounts.</p>
        <button type="button" id="emptyClearMessageFilters">Clear all filters</button>
      </div>`;
    el("emptyClearMessageFilters")?.addEventListener(
      "click",
      clearMessageFilters
    );
    return;
  }

  list.innerHTML = page
    .map((user) => {
      const active = user.key === state.selectedUserKey;
      const status = user.newCount ? `${user.newCount} New` : "Replied";
      const statusClass = user.newCount ? "is-new" : "is-replied";
      const latest = user.messages[0] || {};
      const initial = String(user.fullName || user.email || "A").trim().charAt(0).toUpperCase();

      return `
        <button
          class="cm-message-item${active ? " active" : ""}"
          type="button"
          role="listitem"
          data-user-key="${escapeHtml(user.key)}"
          aria-pressed="${String(active)}"
          aria-label="Open all contact messages from ${escapeHtml(user.fullName || "unknown user")}"
        >
          <span class="cm-message-avatar">${escapeHtml(initial || "A")}</span>
          <span class="cm-message-copy">
            <span class="cm-message-meta">
              <strong>${escapeHtml(user.fullName || "Unknown user")}</strong>
              <time datetime="${escapeHtml(user.latestAt || "")}">${escapeHtml(formatListDate(user.latestAt))}</time>
            </span>
            <small>${escapeHtml(messagePreview(latest.message) || latest.subject || "Contact inquiry")}</small>
            <span class="cm-message-sender">
              <span>${escapeHtml(user.email || "No email recorded")}</span>
              <span class="cm-message-status ${statusClass}">${escapeHtml(status)}</span>
            </span>
          </span>
          <i class="bi bi-chevron-right cm-message-arrow" aria-hidden="true"></i>
        </button>`;
    })
    .join("");
}

function getSelectedMessage() {
  return (
    state.messages.find((message) => message.id === state.selectedId) || null
  );
}

function getSelectedUser() {
  return state.users.find((user) => user.key === state.selectedUserKey) || null;
}

function renderDetail() {
  const detail = el("messageDetail");
  const empty = el("messageDetailEmpty");
  const user = getSelectedUser();
  const selected = getSelectedMessage();
  if (!detail || !empty) return;

  if (!user || !selected) {
    detail.classList.add("hidden");
    empty.classList.remove("hidden");
    document.querySelector(".cm-workspace")?.classList.remove("conversation-open");
    return;
  }

  empty.classList.add("hidden");
  detail.classList.remove("hidden");
  document.querySelector(".cm-workspace")?.classList.add("conversation-open");

  setText("detailUserName", user.fullName || "Unknown user");

  const history = el("userMessageHistory");
  if (history) {
    const initial = String(user.fullName || user.email || "A").trim().charAt(0).toUpperCase() || "A";
    const conversationEvents = user.messages
      .flatMap((message) => {
        if (Array.isArray(message.messages) && message.messages.length) {
          return message.messages.map((entry) => ({
            type: entry.sender === "admin" ? "outgoing" : "incoming",
            at: entry.createdAt || message.createdAt,
            message,
            entry,
          }));
        }

        return [
          {
            type: "incoming",
            at: message.createdAt,
            message,
            entry: {
              sender: "user",
              message: message.message,
              createdAt: message.createdAt,
            },
          },
          ...(message.replyMessage
            ? [
                {
                  type: "outgoing",
                  at: message.repliedAt || message.createdAt,
                  message,
                  entry: {
                    sender: "admin",
                    message: message.replyMessage,
                    createdAt: message.repliedAt || message.createdAt,
                  },
                },
              ]
            : []),
        ];
      })
      .sort((left, right) => dateValue(left.at) - dateValue(right.at));

    history.innerHTML = conversationEvents
      .map(({ type, message, entry }) => {
        if (type === "incoming") {
          const itemStatus = messageStatus(message);
          const active = message.id === state.selectedId;
          return `
          <div class="cm-chat-row is-incoming">
            <span class="cm-chat-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
            <button class="cm-chat-bubble${active ? " active" : ""}" type="button" data-message-id="${escapeHtml(message.id)}" aria-pressed="${String(active)}">
              <span class="cm-chat-subject">${escapeHtml(message.subject || "Contact inquiry")}</span>
              <span class="cm-chat-message">${escapeHtml(entry.message || "No message content recorded.")}</span>
              <span class="cm-chat-meta">
                <time datetime="${escapeHtml(entry.createdAt || "")}">${escapeHtml(formatDate(entry.createdAt))}</time>
                <span>${itemStatus === "Replied" ? "Replied" : "Needs reply"}</span>
              </span>
            </button>
          </div>`;
        }

        return `
          <div class="cm-chat-row is-outgoing">
            <div class="cm-chat-bubble">
              <span class="cm-chat-subject">ANIMUA reply - ${escapeHtml(message.subject || "Contact inquiry")}</span>
              <span class="cm-chat-message">${escapeHtml(entry.message || message.replyMessage)}</span>
              <span class="cm-chat-meta">
                <time datetime="${escapeHtml(entry.createdAt || message.repliedAt || "")}">${escapeHtml(formatDate(entry.createdAt || message.repliedAt))}</time>
                <span><i class="bi bi-check2-all" aria-hidden="true"></i> Sent</span>
              </span>
            </div>
            <span class="cm-chat-avatar is-animua" aria-hidden="true"><i class="bi bi-shield-check"></i></span>
          </div>`;
      })
      .join("");
  }

  const status = messageStatus(selected);
  setText(
    "replyContext",
    `Replying to "${selected.subject || "Contact inquiry"}" sent ${formatDate(selected.createdAt)}.`
  );

  const replyBox = el("replyMessage");
  if (replyBox) replyBox.value = getReplyDraft(localStorage, selected.id);
  setText("replyDraftStatus", replyBox?.value ? "Draft restored" : "Enter to send · Shift+Enter for a new line");

  const sendBtn = el("sendReplyBtn");
  if (sendBtn) sendBtn.disabled = !can("reply");

  setReplyStatus(
    status === "Replied" && selected.repliedAt
      ? `Last replied ${formatDate(selected.repliedAt)}. Sending again will add another in-app response.`
      : "",
    status === "Replied" ? "info" : ""
  );
}

function selectMessage(id) {
  state.selectedId = id;
  renderDetail();
}

function selectUser(key) {
  const user = state.users.find((item) => item.key === key);
  state.selectedUserKey = user?.key || "";
  state.selectedId =
    user?.messages.find((message) => messageStatus(message) === "New")?.id ||
    user?.messages[0]?.id ||
    "";
  renderMessageList();
  renderDetail();
  requestAnimationFrame(() => {
    const thread = el("userMessageHistory");
    if (thread) thread.scrollTop = thread.scrollHeight;
  });
}

function closeConversation() {
  state.selectedUserKey = "";
  state.selectedId = "";
  renderMessageList();
  renderDetail();
}

async function loadMessages() {
  const refreshBtn = el("refreshMessagesBtn");
  refreshBtn?.setAttribute("aria-busy", "true");

  try {
    const data = await apiFetch("/public/contact/messages");
    state.messages = data.messages || [];
    state.users = buildUsers(state.messages);
    cacheContactMessageCount(
      state.messages.filter(
        (message) => messageStatus(message) === "New"
      ).length
    );
    updateStats();
    applyFilters();
  } catch (error) {
    console.error("[contact messages]", error);
    state.messages = [];
    state.users = [];
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

  const sendBtn = el("sendReplyBtn");
  if (sendBtn?.dataset.sending === "true") return;

  const selected = getSelectedMessage();
  const replyMessage = el("replyMessage")?.value.trim();
  if (!selected || !replyMessage) {
    setReplyStatus("Write a reply message before sending.", "error");
    return;
  }

  sendBtn.disabled = true;
  sendBtn.dataset.sending = "true";
  sendBtn.setAttribute("aria-busy", "true");
  setReplyStatus("Saving the ANIMUA reply...", "info");

  try {
    const result = await apiFetch(`/public/contact/${encodeURIComponent(selected.id)}/reply`, {
      method: "POST",
      body: JSON.stringify({ replyMessage }),
    });

    clearReplyDraft(localStorage, selected.id);
    if (el("replyMessage")) el("replyMessage").value = "";
    setText("replyDraftStatus", "Sent · Enter to send another reply");

    await Swal.fire({
      icon: "success",
      title: "Reply saved",
      text: result.message || "The message was saved in the user's ANIMUA account.",
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
    delete sendBtn.dataset.sending;
    sendBtn.removeAttribute("aria-busy");
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
    if (item) selectUser(item.dataset.userKey);
  });
  el("userMessageHistory")?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-message-id]");
    if (item) selectMessage(item.dataset.messageId);
  });
  el("backToUsersBtn")?.addEventListener("click", closeConversation);
  el("replyForm")?.addEventListener("submit", sendReply);
  el("replyMessage")?.addEventListener("input", (event) => {
    const selected = getSelectedMessage();
    if (!selected) return;
    saveReplyDraft(localStorage, selected.id, event.target.value);
    setText(
      "replyDraftStatus",
      event.target.value.trim()
        ? "Draft saved locally"
        : "Enter to send · Shift+Enter for a new line"
    );
  });
  el("replyMessage")?.addEventListener("keydown", (event) => {
    if (!shouldSendReplyOnKeydown(event)) return;
    event.preventDefault();
    el("replyForm")?.requestSubmit();
  });
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
