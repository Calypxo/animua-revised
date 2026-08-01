import Swal from "sweetalert2";
import { API_BASE_URL } from "../../utils/api.js";

const contactForm = document.getElementById("contactForm");
const contactSubmit = document.getElementById("contactSubmit");
const contactStatus = document.getElementById("contactStatus");

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

function getFormPayload() {
  const data = new FormData(contactForm);
  return {
    fullName: String(data.get("fullName") || "").trim(),
    email: String(data.get("email") || "").trim(),
    subject: String(data.get("subject") || "").trim(),
    message: String(data.get("message") || "").trim(),
    website: String(data.get("website") || "").trim(),
  };
}

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  const payload = getFormPayload();

  if (!payload.fullName || !payload.email || !payload.subject || !payload.message) {
    setStatus("Please complete all fields before sending.", "error");
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/public/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
