import Swal from "sweetalert2";
import { API_BASE_URL } from "../../utils/api.js";

const contactForm = document.getElementById("contactForm");
const contactSubmit = document.getElementById("contactSubmit");
const contactStatus = document.getElementById("contactStatus");
const contactAccountName = document.getElementById("contactAccountName");
const contactAccountEmail = document.getElementById("contactAccountEmail");
const contactAccountInitial = document.getElementById("contactAccountInitial");
const contactMessageList = document.getElementById("contactMessageList");

let accountReady = false;
let currentContactMessages = [];

function setStatus(message = "", type = "") {
  if (!contactStatus) return;
  contactStatus.textContent = message;
  contactStatus.dataset.type = type;
}

function setLoading(isLoading) {
  if (!contactSubmit) return;
  contactSubmit.disabled = isLoading || !accountReady;
  contactSubmit.setAttribute("aria-busy", String(isLoading));
  contactSubmit.innerHTML = isLoading
    ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><span>Sending...</span>'
    : '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i><span>Send Message</span>';
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getFormPayload() {
  const data = new FormData(contactForm);
  return {
    subject: String(data.get("subject") || "").trim(),
    message: String(data.get("message") || "").trim(),
    website: String(data.get("website") || "").trim(),
  };
}

async function fetchJson(url, options = {}) {
  const token = localStorage.getItem("animua_token");
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

function formatMessageDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMessageDateTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatReference(id = "") {
  const shortId = String(id).replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
  return shortId ? `MSG-${shortId}` : "MSG";
}

function renderAccount(account = {}) {
  const fullName = account.fullName || localStorage.getItem("user_name") || "ANIMUA user";
  const email = account.email || localStorage.getItem("user_email") || "";
  contactAccountName.textContent = fullName;
  contactAccountEmail.textContent = email;
  contactAccountInitial.textContent = fullName.trim().charAt(0).toUpperCase() || "A";
  accountReady = Boolean(email);
  contactSubmit.disabled = !accountReady;
}

function renderMessageList(messages = []) {
  if (!contactMessageList) return;
  currentContactMessages = messages;

  if (!messages.length) {
    contactMessageList.innerHTML =
      '<p class="contact-reply-empty">Send a message to start a conversation with the ANIMUA team.</p>';
    return;
  }

  contactMessageList.innerHTML = messages
    .map((item) => {
      const isReplied = String(item.status || "").toLowerCase() === "replied";
      const statusText = isReplied ? "Replied" : "Under Review";
      const statusClass = isReplied ? "" : "is-review";
      const latestMessage = [...(item.messages || [])].reverse()[0];
      const preview = latestMessage?.message || item.message || "";

      return `
        <button class="contact-reply-item" type="button" data-contact-id="${escapeHtml(item.id)}">
          <span class="contact-reply-icon"><i class="fa-regular fa-envelope" aria-hidden="true"></i></span>
          <span>
            <strong>${escapeHtml(item.subject || "Contact inquiry")}</strong>
            <small>${escapeHtml(item.fullName || "You")} - Ref: ${escapeHtml(formatReference(item.id))} <b class="${statusClass}">${statusText}</b></small>
            <p class="contact-reply-preview">${escapeHtml(preview || "Open conversation")}</p>
          </span>
          <time>${escapeHtml(formatMessageDate(item.repliedAt || item.createdAt))}</time>
          <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
      `;
    })
    .join("");
}

function renderConversationThread(item = {}) {
  const thread = Array.isArray(item.messages) && item.messages.length
    ? item.messages
    : item.message
      ? [{ sender: "user", name: item.fullName || "You", message: item.message, createdAt: item.createdAt }]
      : [];

  return thread
    .map((entry) => {
      const isAdmin = entry.sender === "admin";
      const label = isAdmin ? "ANIMUA Team" : entry.name || item.fullName || "You";
      return `
        <div class="contact-conversation-bubble ${isAdmin ? "is-admin" : "is-user"}">
          <div>
            <strong>${escapeHtml(label)}</strong>
            <time>${escapeHtml(formatMessageDateTime(entry.createdAt))}</time>
          </div>
          <p>${escapeHtml(entry.message || "")}</p>
        </div>
      `;
    })
    .join("");
}

async function loadContactMessages() {
  const token = localStorage.getItem("animua_token");
  if (!token) {
    renderMessageList([]);
    return;
  }

  try {
    contactMessageList?.setAttribute("aria-busy", "true");
    const data = await fetchJson(`${API_BASE_URL}/public/contact/my-messages`);
    renderMessageList(data.messages || []);
  } catch (error) {
    console.error("[contact messages]", error);
    if (contactMessageList) {
      contactMessageList.innerHTML =
        '<p class="contact-reply-empty">Unable to load messages right now.</p>';
    }
  } finally {
    contactMessageList?.removeAttribute("aria-busy");
  }
}

async function openConversation(contactId) {
  const item = currentContactMessages.find((message) => message.id === contactId);
  if (!item) return;

  const result = await Swal.fire({
    titleText: item.subject || "Contact inquiry",
    html: `
      <div class="contact-conversation-modal">
        <div class="contact-conversation-meta">
          <span>${escapeHtml(item.fullName || "You")}</span>
          <span>${escapeHtml(formatReference(item.id))}</span>
        </div>
        <div class="contact-conversation-thread">
          ${renderConversationThread(item)}
        </div>
        <label class="contact-conversation-reply">
          <span>Reply to this conversation</span>
          <textarea id="contactConversationReply" rows="4" placeholder="Type your reply here..."></textarea>
        </label>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Send Reply",
    cancelButtonText: "Close",
    focusConfirm: false,
    customClass: {
      popup: "animua-popup contact-conversation-popup",
      confirmButton: "animua-confirm",
      cancelButton: "animua-cancel",
    },
    buttonsStyling: false,
    preConfirm: () => {
      const message = document.getElementById("contactConversationReply")?.value.trim();
      if (!message) {
        Swal.showValidationMessage("Write a reply before sending.");
        return false;
      }
      return message;
    },
  });

  if (!result.isConfirmed) return;

  try {
    await fetchJson(`${API_BASE_URL}/public/contact/${encodeURIComponent(item.id)}/follow-up`, {
      method: "POST",
      body: JSON.stringify({ message: result.value }),
    });

    await loadContactMessages();

    Swal.fire({
      icon: "success",
      title: "Reply Sent",
      text: "Your reply was added to the conversation.",
      timer: 1500,
      showConfirmButton: false,
      customClass: {
        popup: "animua-popup animua-auth-feedback-popup",
      },
      buttonsStyling: false,
    });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Reply Failed",
      text: error.message || "Unable to save your reply.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm",
      },
      buttonsStyling: false,
    });
  }
}

async function loadContactAccount() {
  const token = localStorage.getItem("animua_token");
  if (!token) {
    contactAccountName.textContent = "Log in to send a message";
    contactAccountEmail.textContent = "Your verified account details will be included automatically.";
    contactSubmit.disabled = false;
    contactSubmit.innerHTML = '<i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i><span>Log in to continue</span>';
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/account`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Unable to load your account.");
    renderAccount(data.account || {});
    await loadContactMessages();
  } catch (error) {
    accountReady = false;
    contactAccountName.textContent = "Account details unavailable";
    contactAccountEmail.textContent = error.message || "Please log in again.";
    contactSubmit.disabled = true;
    setStatus("Please log in again before sending a message.", "error");
  }
}

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  const payload = getFormPayload();

  if (!accountReady) {
    document.getElementById("loginNavBtn")?.click();
    setStatus("Please log in before sending a message.", "error");
    return;
  }

  if (!payload.subject || !payload.message) {
    setStatus("Please enter a subject and message before sending.", "error");
    return;
  }

  setLoading(true);

  try {
    const data = await fetchJson(`${API_BASE_URL}/public/contact`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    contactForm.reset();
    setStatus(data.message || "Your message has been received.", "success");
    await loadContactMessages();

    Swal.fire({
      icon: "success",
      title: "Message Received",
      html: "<p>Your inquiry is now available to the ANIMUA team.</p>",
      timer: 1600,
      timerProgressBar: true,
      showConfirmButton: false,
      customClass: {
        popup: "animua-popup animua-auth-feedback-popup",
        icon: "animua-auth-feedback-icon",
      },
      buttonsStyling: false,
    });
  } catch (error) {
    setStatus(error.message || "Unable to send your message.", "error");
    Swal.fire({
      icon: "error",
      title: "Message Failed",
      html: `<p>${escapeHtml(error.message || "Unable to send your message.")}</p>`,
      confirmButtonText: "OK",
      customClass: {
        popup: "animua-popup animua-auth-feedback-popup",
        icon: "animua-auth-feedback-icon",
        confirmButton: "animua-confirm",
      },
      buttonsStyling: false,
    });
  } finally {
    setLoading(false);
  }
});

contactMessageList?.addEventListener("click", (event) => {
  const item = event.target.closest("[data-contact-id]");
  if (!item) return;
  openConversation(item.dataset.contactId);
});

loadContactAccount();
