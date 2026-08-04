import Swal from "sweetalert2";
import { API_BASE_URL } from "../../utils/api.js";

const contactForm = document.getElementById("contactForm");
const contactSubmit = document.getElementById("contactSubmit");
const contactStatus = document.getElementById("contactStatus");
const contactMessageList = document.getElementById("contactMessageList");
const CONTACT_EMAIL_KEY = "animua_contact_email";
const fullNameInput = contactForm?.querySelector('input[name="fullName"]');
const emailInput = contactForm?.querySelector('input[name="email"]');
let currentContactMessages = [];

function setStatus(message = "", type = "") {
  if (!contactStatus) return;
  contactStatus.textContent = message;
  contactStatus.dataset.type = type;
}

function setLoading(isLoading) {
  if (!contactSubmit) return;
  contactSubmit.disabled = isLoading;
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

function getFormPayload() {
  const data = new FormData(contactForm);
  return {
    fullName: String(data.get("fullName") || "").trim(),
    email: String(data.get("email") || "").trim(),
    subject: String(data.get("subject") || "").trim(),
    message: String(data.get("message") || "").trim(),
  };
}

function getLoggedInContactUser() {
  const token = localStorage.getItem("animua_token");
  const isLoggedIn = localStorage.getItem("is_logged_in");

  if (!token && isLoggedIn !== "true") return null;

  const name = localStorage.getItem("user_name") || "";
  const email = localStorage.getItem("user_email") || "";

  if (!name && !email) return null;

  return { name, email };
}

function getAuthToken() {
  return localStorage.getItem("animua_token") || "";
}

function requireLogin(message = "Please log in before sending a message.") {
  setStatus(message, "error");
  document.getElementById("loginNavBtn")?.click();
}

function applyAccountPrefill() {
  const user = getLoggedInContactUser();
  if (!user) return "";

  if (fullNameInput) {
    fullNameInput.value = user.name || "";
    fullNameInput.readOnly = true;
    fullNameInput.classList.add("readonly-account-field");
  }

  if (emailInput) {
    emailInput.value = user.email || "";
    emailInput.readOnly = true;
    emailInput.classList.add("readonly-account-field");
  }

  if (user.email) {
    localStorage.setItem(CONTACT_EMAIL_KEY, user.email.toLowerCase());
  }

  return user.email || "";
}

async function fetchJson(url, options = {}) {
  const token = getAuthToken();
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

async function openConversation(contactId) {
  const item = currentContactMessages.find((message) => message.id === contactId);

  if (!item) return;
  if (!getAuthToken()) {
    requireLogin("Please log in before replying to a conversation.");
    return;
  }

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

async function loadContactMessages() {
  if (!getAuthToken()) {
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

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  const payload = getFormPayload();

  if (!getAuthToken()) {
    requireLogin();
    return;
  }

  if (!payload.fullName || !payload.email || !payload.subject || !payload.message) {
    setStatus("Please complete all fields before sending.", "error");
    return;
  }

  setLoading(true);

  try {
    const data = await fetchJson(`${API_BASE_URL}/public/contact`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    localStorage.setItem(CONTACT_EMAIL_KEY, payload.email.toLowerCase());
    contactForm.reset();
    applyAccountPrefill();
    setStatus(data.message || "Your message has been sent to the ANIMUA team.", "success");
    await loadContactMessages();

    Swal.fire({
      icon: "success",
      title: "Message Sent",
      html: "<p>Your message was sent to the ANIMUA team. Staff replies will appear in Messages.</p>",
      confirmButtonText: "OK",
      customClass: {
        popup: "animua-popup animua-auth-feedback-popup",
        icon: "animua-auth-feedback-icon",
        confirmButton: "animua-confirm",
      },
      buttonsStyling: false,
    });
  } catch (error) {
    setStatus(error.message || "Unable to prepare your message.", "error");
    Swal.fire({
      icon: "error",
      title: "Message Failed",
      html: `<p>${escapeHtml(error.message || "Unable to prepare your message.")}</p>`,
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

document.addEventListener("DOMContentLoaded", () => {
  applyAccountPrefill();
  loadContactMessages();
});
