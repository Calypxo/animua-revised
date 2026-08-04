import Swal from "sweetalert2";
import { API_BASE_URL } from "../../utils/api.js";

const contactForm = document.getElementById("contactForm");
const contactSubmit = document.getElementById("contactSubmit");
const contactStatus = document.getElementById("contactStatus");
const contactMessageList = document.getElementById("contactMessageList");
const contactContentGrid = document.getElementById("contactContentGrid");
const contactLoginPanel = document.getElementById("contactLoginPanel");
const contactLoginButton = document.getElementById("contactLoginButton");
const contactFormPanel = document.getElementById("contactFormPanel");
const contactRepliesPanel = document.getElementById("contactRepliesPanel");
const CONTACT_EMAIL_KEY = "animua_contact_email";
const fullNameInput = contactForm?.querySelector('input[name="fullName"]');
const emailInput = contactForm?.querySelector('input[name="email"]');
let currentContactMessages = [];
let activeContactConversationId = "";

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

function getContactInitial(value = "") {
  const cleanValue = String(value || "").trim();
  return cleanValue ? cleanValue.charAt(0).toUpperCase() : "U";
}

function getContactUserPhoto() {
  return localStorage.getItem("user_profile_photo") || "";
}

function getConversationStatus(item = {}) {
  const isReplied = String(item.status || "").toLowerCase() === "replied";
  return {
    className: isReplied ? "is-replied" : "is-review",
    text: isReplied ? "Replied" : "Under Review",
  };
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

function isContactLoggedIn() {
  return Boolean(getAuthToken());
}

function requireLogin(message = "Please log in before sending a message.") {
  setStatus(message, "error");
  document.getElementById("loginNavBtn")?.click();
}

function updateContactAuthState() {
  const isLoggedIn = isContactLoggedIn();

  contactContentGrid?.classList.toggle("is-guest", !isLoggedIn);
  contactLoginPanel?.classList.toggle("hidden", isLoggedIn);
  contactFormPanel?.classList.toggle("hidden", !isLoggedIn);
  contactRepliesPanel?.classList.toggle("hidden", !isLoggedIn);

  if (!isLoggedIn) {
    currentContactMessages = [];
    if (contactMessageList) contactMessageList.innerHTML = "";
    contactForm?.reset();
    setStatus("");
  }

  return isLoggedIn;
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
  contactRepliesPanel?.style.removeProperty("--contact-thread-height");

  if (!messages.length) {
    contactRepliesPanel?.classList.remove("is-thread-open");
    contactMessageList.innerHTML =
      '<p class="contact-reply-empty">Send a message to start a conversation with the ANIMUA team.</p>';
    return;
  }

  contactRepliesPanel?.classList.remove("is-thread-open");
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

function renderInlineConversation(item = {}) {
  if (!contactMessageList) return;

  if (contactRepliesPanel && !contactRepliesPanel.classList.contains("is-thread-open")) {
    const currentHeight = contactRepliesPanel.getBoundingClientRect().height;
    if (currentHeight > 0) {
      contactRepliesPanel.style.setProperty("--contact-thread-height", `${Math.round(currentHeight)}px`);
    }
  }

  contactRepliesPanel?.classList.add("is-thread-open");

  const status = getConversationStatus(item);
  const startedAt = formatMessageDate(item.createdAt);
  const userPhoto = getContactUserPhoto();
  const thread = Array.isArray(item.messages) && item.messages.length
    ? item.messages
    : item.message
      ? [{ sender: "user", name: item.fullName || "You", message: item.message, createdAt: item.createdAt }]
      : [];

  const messagesMarkup = thread
    .map((entry) => {
      const isAdmin = entry.sender === "admin";
      const label = isAdmin ? "ANIMUA Team" : entry.name || item.fullName || "You";
      const avatar = isAdmin
        ? '<i class="fa-solid fa-paw" aria-hidden="true"></i>'
        : userPhoto
          ? `<img src="${escapeHtml(userPhoto)}" alt="">`
        : escapeHtml(getContactInitial(label));

      return `
        <div class="contact-thread-message ${isAdmin ? "is-admin" : "is-user"}">
          <span class="contact-thread-avatar" aria-hidden="true">${avatar}</span>
          <article class="contact-thread-bubble">
            <div class="contact-thread-message-meta">
              <strong>${escapeHtml(label)}</strong>
              <span>${escapeHtml(formatMessageDateTime(entry.createdAt))}</span>
            </div>
            <p>${escapeHtml(entry.message || "")}</p>
          </article>
        </div>
      `;
    })
    .join("");

  contactMessageList.innerHTML = `
    <div class="contact-thread-view" data-active-contact-id="${escapeHtml(item.id)}">
      <div class="contact-thread-topbar">
        <button type="button" class="contact-thread-back" data-contact-back>
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
          <span>Back to conversations</span>
        </button>
      </div>

      <div class="contact-thread-heading">
        <div>
          <h3>${escapeHtml(item.subject || "Contact inquiry")}</h3>
          <p>Between you and <strong>ANIMUA Team</strong>${startedAt ? ` <span aria-hidden="true">&bull;</span> Started ${escapeHtml(startedAt)}` : ""}</p>
        </div>
        <span class="contact-thread-status ${status.className}">${status.text}</span>
      </div>

      <div class="contact-thread-messages">
        ${messagesMarkup || '<p class="contact-reply-empty">No messages yet.</p>'}
      </div>

      <form class="contact-thread-reply-form" data-contact-reply-form>
        <label class="contact-thread-reply-field">
          <i class="fa-regular fa-comment" aria-hidden="true"></i>
          <textarea name="message" rows="4" placeholder="Type your reply here..."></textarea>
          <button type="submit" class="contact-thread-send">
            <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
            <span class="sr-only">Send Reply</span>
          </button>
        </label>
        <p class="contact-thread-status-message" aria-live="polite"></p>
      </form>
    </div>
  `;

  const threadMessages = contactMessageList.querySelector(".contact-thread-messages");
  if (threadMessages) {
    requestAnimationFrame(() => {
      threadMessages.scrollTop = threadMessages.scrollHeight;
    });
  }
}

async function sendConversationReply(form) {
  const contactId = activeContactConversationId;
  const statusMessage = form.querySelector(".contact-thread-status-message");
  const submitButton = form.querySelector(".contact-thread-send");
  const textarea = form.querySelector('textarea[name="message"]');
  const message = textarea?.value.trim() || "";

  if (!contactId) return;
  if (!message) {
    if (statusMessage) {
      statusMessage.textContent = "Write a reply before sending.";
      statusMessage.dataset.type = "error";
    }
    textarea?.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.setAttribute("aria-busy", "true");
  submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><span class="sr-only">Sending...</span>';
  if (statusMessage) {
    statusMessage.textContent = "";
    statusMessage.dataset.type = "";
  }

  try {
    await fetchJson(`${API_BASE_URL}/public/contact/${encodeURIComponent(contactId)}/follow-up`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });

    await loadContactMessages({ activeConversationId: contactId });
  } catch (error) {
    if (statusMessage) {
      statusMessage.textContent = error.message || "Unable to save your reply.";
      statusMessage.dataset.type = "error";
    }
    submitButton.disabled = false;
    submitButton.removeAttribute("aria-busy");
    submitButton.innerHTML = '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i><span class="sr-only">Send Reply</span>';
  }
}

function openConversation(contactId) {
  const item = currentContactMessages.find((message) => message.id === contactId);

  if (!item) return;
  if (!getAuthToken()) {
    requireLogin("Please log in before replying to a conversation.");
    return;
  }

  activeContactConversationId = contactId;
  renderInlineConversation(item);
}

async function loadContactMessages(options = {}) {
  if (!isContactLoggedIn()) {
    updateContactAuthState();
    return;
  }

  try {
    contactMessageList?.setAttribute("aria-busy", "true");
    const data = await fetchJson(`${API_BASE_URL}/public/contact/my-messages`);
    const messages = data.messages || [];
    const activeConversationId = options.activeConversationId || "";

    if (activeConversationId) {
      currentContactMessages = messages;
      const activeItem = messages.find((message) => message.id === activeConversationId);
      if (activeItem) {
        activeContactConversationId = activeConversationId;
        renderInlineConversation(activeItem);
      } else {
        activeContactConversationId = "";
        renderMessageList(messages);
      }
    } else {
      activeContactConversationId = "";
      renderMessageList(messages);
    }
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

  if (!isContactLoggedIn()) {
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
  const backButton = event.target.closest("[data-contact-back]");
  if (backButton) {
    activeContactConversationId = "";
    renderMessageList(currentContactMessages);
    return;
  }

  const copyReferenceButton = event.target.closest("[data-copy-reference]");
  if (copyReferenceButton) {
    const reference = copyReferenceButton.dataset.copyReference || "";
    navigator.clipboard?.writeText(reference);
    copyReferenceButton.classList.add("is-copied");
    setTimeout(() => copyReferenceButton.classList.remove("is-copied"), 1200);
    return;
  }

  const item = event.target.closest("[data-contact-id]");
  if (!item) return;
  openConversation(item.dataset.contactId);
});

contactMessageList?.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-contact-reply-form]");
  if (!form) return;
  event.preventDefault();
  sendConversationReply(form);
});

contactLoginButton?.addEventListener("click", () => {
  requireLogin("Please log in to message the ANIMUA team.");
});

document.addEventListener("DOMContentLoaded", () => {
  const isLoggedIn = updateContactAuthState();
  if (!isLoggedIn) return;
  applyAccountPrefill();
  loadContactMessages();
});
