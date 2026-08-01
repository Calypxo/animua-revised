import Swal from "sweetalert2";
import { API_BASE_URL } from "../../utils/api.js";

const contactForm = document.getElementById("contactForm");
const contactSubmit = document.getElementById("contactSubmit");
const contactStatus = document.getElementById("contactStatus");
const contactAccountName = document.getElementById("contactAccountName");
const contactAccountEmail = document.getElementById("contactAccountEmail");
const contactAccountInitial = document.getElementById("contactAccountInitial");

let accountReady = false;

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

function renderAccount(account = {}) {
  const fullName = account.fullName || localStorage.getItem("user_name") || "ANIMUA user";
  const email = account.email || localStorage.getItem("user_email") || "";
  contactAccountName.textContent = fullName;
  contactAccountEmail.textContent = email;
  contactAccountInitial.textContent = fullName.trim().charAt(0).toUpperCase() || "A";
  accountReady = Boolean(email);
  contactSubmit.disabled = !accountReady;
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
    const response = await fetch(`${API_BASE_URL}/public/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("animua_token")}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Unable to send your message.");
    }

    contactForm.reset();
    setStatus(data.message || "Your message has been received.", "success");

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

loadContactAccount();
