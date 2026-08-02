const SUBMIT_SURRENDER_API_URL = "http://localhost:5000/api/surrenders";
const MY_SURRENDER_REQUESTS_API_URL = `${SUBMIT_SURRENDER_API_URL}/my-requests`;
const SURRENDER_AVAILABILITY_API_URL = `${SUBMIT_SURRENDER_API_URL}/availability`;

const ANGELES_BARANGAYS = [
  "Agapito del Rosario", "Amsic", "Anunas", "Balibago", "Capaya", "Claro M. Recto",
  "Cuayan", "Cutcut", "Cutud", "Lourdes Norte", "Lourdes Sur", "Lourdes Sur Este",
  "Malabanias", "Margot", "Mining", "Ninoy Aquino", "Pampang", "Pandan", "Plaridel",
  "Pulung Cacutud", "Pulung Maragul", "Pulungbulu", "Salapungan", "San Jose",
  "San Nicolas", "Santa Teresita", "Santa Trinidad", "Santo Cristo", "Santo Domingo",
  "Santo Rosario", "Sapalibutad", "Sapangbato", "Sergio Bernal", "Silangan",
  "Tabun", "Virgen Delos Remedios",
];

const STEP_LABELS = {
  1: "Requester information",
  2: "Animal information",
  3: "Reason and situation",
  4: "Review and agreement",
};

const FIELD_ERRORS = {
  ownerName: "ownerNameError",
  contactNo: "contactError",
  ownerAddress: "addressError",
  ownerBarangay: "barangayError",
  reasons: "reasonError",
  agreeAllTerms: "agreementError",
};

let currentStep = 1;
let highestVisitedStep = 1;
let isSubmitting = false;
let animalPhotoData = null;
let surrenderAcceptingRequests = true;

const MAX_ANIMAL_PHOTO_SIZE = 650 * 1024;

function getFormValue(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(input => input.value);
}

function isValidAngelesBarangay(barangay) {
  return ANGELES_BARANGAYS.includes(barangay);
}

function generateRequestId() {
  const timestamp = Date.now().toString().slice(-6);
  return `SR-2026-${timestamp}`;
}

function getLoggedInUser() {
  const isLoggedIn = localStorage.getItem("is_logged_in");
  const token = localStorage.getItem("animua_token");
  if (isLoggedIn !== "true" || !token) return null;
  return {
    token,
    name: localStorage.getItem("user_name"),
    email: localStorage.getItem("user_email"),
    role: localStorage.getItem("user_role"),
  };
}

function fillOwnerInfoFromAccount() {
  const user = getLoggedInUser();
  const ownerNameInput = document.getElementById("ownerName");
  const ownerEmailInput = document.getElementById("ownerEmail");
  const identityName = document.getElementById("accountIdentityName");
  const identityEmail = document.getElementById("accountIdentityEmail");
  const identityCard = document.getElementById("accountIdentityCard");

  if (!user) {
    if (identityName) identityName.textContent = "Sign in required";
    if (identityEmail) identityEmail.textContent = "Use your own Animua account.";
    identityCard?.classList.add("is-signed-out");
    return;
  }

  if (ownerNameInput) {
    ownerNameInput.value = user.name || "";
    ownerNameInput.readOnly = true;
    ownerNameInput.classList.add("readonly-account-field");
  }
  if (ownerEmailInput) {
    ownerEmailInput.value = user.email || "";
    ownerEmailInput.readOnly = true;
    ownerEmailInput.classList.add("readonly-account-field");
  }
  if (identityName) identityName.textContent = user.name || "Animua account";
  if (identityEmail) identityEmail.textContent = user.email || "Verified account";
  identityCard?.classList.remove("is-signed-out");
}

function openLoginModal() {
  const authModal = document.getElementById("authModal");
  if (authModal) {
    authModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    return;
  }
  localStorage.setItem("animua_open_auth_modal", "true");
  window.location.href = "/pages/public/home.html";
}

function requireLoggedInUser() {
  const user = getLoggedInUser();
  if (!user) openLoginModal();
  return user;
}

function setFieldError(field, message = "") {
  const errorId = FIELD_ERRORS[field.id];
  const error = errorId ? document.getElementById(errorId) : null;
  field.classList.toggle("is-invalid", Boolean(message));
  field.setAttribute("aria-invalid", String(Boolean(message)));
  if (error) error.textContent = message;
}

function setAnimalPhotoError(message = "") {
  const error = document.getElementById("animalPhotoError");
  const input = document.getElementById("animalPhoto");
  if (error) error.textContent = message;
  input?.classList.toggle("is-invalid", Boolean(message));
  input?.setAttribute("aria-invalid", String(Boolean(message)));
}

function clearAnimalPhotoPreview() {
  animalPhotoData = null;
  const preview = document.getElementById("animalPhotoPreview");
  const label = document.getElementById("animalPhotoLabel");
  if (preview) preview.innerHTML = '<i class="fa-regular fa-image" aria-hidden="true"></i>';
  if (label) label.textContent = "Add a clear photo of the animal";
}

function bindAnimalPhotoUpload() {
  const input = document.getElementById("animalPhoto");
  if (!input) return;

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    setAnimalPhotoError("");
    clearAnimalPhotoPreview();
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      input.value = "";
      setAnimalPhotoError("Upload a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_ANIMAL_PHOTO_SIZE) {
      input.value = "";
      setAnimalPhotoError("Photo must be 650 KB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        setAnimalPhotoError("We could not preview this photo. Please choose another image.");
        return;
      }
      animalPhotoData = { name: file.name, type: file.type, size: file.size, dataUrl };
      const preview = document.getElementById("animalPhotoPreview");
      const label = document.getElementById("animalPhotoLabel");
      if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="">`;
      if (label) label.textContent = file.name;
    };
    reader.onerror = () => {
      input.value = "";
      setAnimalPhotoError("We could not read this photo. Please choose another image.");
    };
    reader.readAsDataURL(file);
  });
}

function validationMessage(field) {
  if (field.id === "ownerBarangay") {
    if (!field.value) return "Select your barangay in Angeles City.";
    if (!isValidAngelesBarangay(field.value)) return "Choose a supported Angeles City barangay.";
  }
  if (field.id === "agreeAllTerms" && !field.checked) return "Confirm that you have read and agree to the surrender terms.";
  if (field.validity.valueMissing) return "This field is required before you continue.";
  if (field.validity.typeMismatch) return "Enter a valid value in the requested format.";
  return "";
}

function validateStep(step, focusInvalid = true) {
  const panel = document.querySelector(`[data-step="${step}"]`);
  if (!panel) return true;
  const fields = Array.from(panel.querySelectorAll("input, select, textarea")).filter(field => !field.disabled);
  let firstInvalid = null;

  fields.forEach(field => {
    let message = "";
    if (field.id === "ownerBarangay" && field.value && !isValidAngelesBarangay(field.value)) {
      message = validationMessage(field);
    } else if (!field.checkValidity()) {
      message = validationMessage(field);
    }
    setFieldError(field, message);
    if (message && !firstInvalid) firstInvalid = field;
  });

  if (firstInvalid && focusInvalid) {
    firstInvalid.focus();
    showFeedback("Please review the highlighted field before continuing.", "error");
  }
  return !firstInvalid;
}

function showFeedback(message, type = "info") {
  const feedback = document.getElementById("formFeedback");
  if (!feedback) return;
  feedback.className = `form-feedback is-${type}`;
  feedback.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : "fa-circle-info"}" aria-hidden="true"></i><span>${escapeHtml(message)}</span>`;
  feedback.classList.remove("hidden");
  feedback.focus({ preventScroll: true });
}

function clearFeedback() {
  document.getElementById("formFeedback")?.classList.add("hidden");
}

function applySurrenderAvailability(availability = {}) {
  const acceptingRequests = availability.acceptingRequests !== false;
  surrenderAcceptingRequests = acceptingRequests;

  const workspace = document.querySelector(".surrender-workspace");
  const panel = document.getElementById("surrenderAvailabilityPanel");
  const message = document.getElementById("surrenderAvailabilityMessage");
  const form = document.getElementById("surrenderForm");

  workspace?.classList.toggle("is-not-accepting", !acceptingRequests);
  if (panel) panel.hidden = acceptingRequests;
  if (message && availability.closedMessage) {
    message.textContent = availability.closedMessage;
  }

  form?.querySelectorAll("input, select, textarea, button").forEach(control => {
    control.disabled = !acceptingRequests;
  });
  document.querySelectorAll(".surrender-step-link").forEach(control => {
    control.disabled = !acceptingRequests;
  });

  const submitButton = document.getElementById("submitSurrenderBtn");
  if (submitButton) submitButton.disabled = isSubmitting || !acceptingRequests;
}

async function loadSurrenderAvailability({ showError = false } = {}) {
  const retryButton = document.getElementById("checkSurrenderAvailability");
  retryButton?.setAttribute("aria-busy", "true");
  if (retryButton) retryButton.disabled = true;

  try {
    const response = await fetch(SURRENDER_AVAILABILITY_API_URL, {
      headers: { Accept: "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Unable to check surrender request availability.");
    }
    applySurrenderAvailability(data.availability || {});
  } catch (error) {
    if (showError) {
      showFeedback(error.message || "Unable to check availability. Please try again.", "error");
    }
  } finally {
    retryButton?.removeAttribute("aria-busy");
    if (retryButton) retryButton.disabled = false;
  }
}

function showStep(step, options = {}) {
  const nextStep = Math.min(4, Math.max(1, Number(step)));
  currentStep = nextStep;
  highestVisitedStep = Math.max(highestVisitedStep, nextStep);

  document.querySelectorAll(".surrender-step-panel").forEach(panel => {
    const active = Number(panel.dataset.step) === nextStep;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });

  document.querySelectorAll(".surrender-step-link").forEach(link => {
    const linkStep = Number(link.dataset.stepLink);
    link.classList.toggle("is-active", linkStep === nextStep);
    link.classList.toggle("is-complete", linkStep < nextStep);
    if (linkStep === nextStep) link.setAttribute("aria-current", "step");
    else link.removeAttribute("aria-current");
  });

  const currentText = document.getElementById("currentStepText");
  const currentLabel = document.getElementById("currentStepLabel");
  const progressBar = document.getElementById("formProgressBar");
  if (currentText) currentText.textContent = String(nextStep);
  if (currentLabel) currentLabel.textContent = STEP_LABELS[nextStep];
  if (progressBar) progressBar.style.width = `${nextStep * 25}%`;
  if (nextStep === 4) updateReviewSummary();
  clearFeedback();

  if (options.scroll !== false) {
    document.querySelector(".surrender-form-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const heading = document.querySelector(`[data-step="${nextStep}"] h3`);
  if (heading && options.focus !== false) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

function updateReviewSummary() {
  const set = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value || "Not provided";
  };
  const petDetails = [getFormValue("species"), getFormValue("breed"), getFormValue("petAge"), getFormValue("petSex")].filter(Boolean).join(" · ");
  set("reviewOwnerName", getFormValue("ownerName"));
  set("reviewOwnerContact", [getFormValue("ownerEmail"), getFormValue("contactNo")].filter(Boolean).join(" · "));
  set("reviewBarangay", [getFormValue("ownerBarangay"), "Angeles City"].filter(Boolean).join(", "));
  set("reviewAddress", getFormValue("ownerAddress"));
  set("reviewPetName", getFormValue("petName") || "Unnamed animal");
  set("reviewPetDetails", petDetails || "Animal details not provided");
  set("reviewReason", getFormValue("reasons"));
}

async function submitSurrenderRequest(requestData) {
  const token = localStorage.getItem("animua_token");
  let response;
  try {
    response = await fetch(SUBMIT_SURRENDER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(requestData),
    });
  } catch {
    throw new Error("We could not reach the shelter service. Check your connection and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "The request could not be submitted. Review your details and try again.");
    error.code = data.code;
    error.availability = data.availability;
    throw error;
  }
  return data;
}

function setSubmitting(submitting) {
  isSubmitting = submitting;
  const button = document.getElementById("submitSurrenderBtn");
  if (!button) return;
  button.disabled = submitting || !surrenderAcceptingRequests;
  button.setAttribute("aria-busy", String(submitting));
  button.innerHTML = submitting
    ? '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i><span>Submitting securely…</span>'
    : '<span>Submit surrender request</span><i class="fa-solid fa-paper-plane" aria-hidden="true"></i>';
}

function buildRequestPayload(loggedInUser) {
  const barangay = getFormValue("ownerBarangay");
  const agreed = document.getElementById("agreeAllTerms")?.checked || false;
  return {
    id: generateRequestId(),
    account: { name: loggedInUser.name, email: loggedInUser.email, role: loggedInUser.role },
    status: "Pending",
    submittedAt: new Date().toISOString().split("T")[0],
    owner: {
      name: loggedInUser.name || getFormValue("ownerName"),
      contact: getFormValue("contactNo"),
      email: loggedInUser.email || getFormValue("ownerEmail"),
      address: getFormValue("ownerAddress"),
      barangay,
      city: "Angeles City",
      isAngelesResident: true,
    },
    pet: {
      name: getFormValue("petName"),
      species: getFormValue("species"),
      breed: getFormValue("breed"),
      age: getFormValue("petAge"),
      sex: getFormValue("petSex"),
      colorMarkings: getFormValue("colorMarkings"),
      status: getCheckedValues("status"),
      vaccinationHistory: getFormValue("vaccinationHistory"),
      photoName: animalPhotoData?.name || "",
      photoType: animalPhotoData?.type || "",
      photoDataUrl: animalPhotoData?.dataUrl || "",
    },
    surrenderReason: getFormValue("reasons"),
    agreement: {
      agreedToTerms: agreed,
      agreedAt: new Date().toISOString(),
      agreementText: "Nabasa ko at sumasang-ayon ako sa lahat ng mga tuntunin at pahayag na nakasaad sa itaas.",
    },
    nlp: null,
  };
}

async function handleSurrenderSubmit(event) {
  event.preventDefault();
  if (isSubmitting) return;
  const loggedInUser = requireLoggedInUser();
  if (!loggedInUser) {
    showFeedback("Sign in with your own Animua account before submitting this request.", "error");
    return;
  }

  for (let step = 1; step <= 4; step += 1) {
    if (!validateStep(step, false)) {
      showStep(step);
      validateStep(step, true);
      return;
    }
  }

  const barangay = getFormValue("ownerBarangay");
  if (!isValidAngelesBarangay(barangay)) {
    showStep(1);
    showFeedback("Select a supported barangay in Angeles City before submitting.", "error");
    return;
  }

  setSubmitting(true);
  clearFeedback();
  try {
    const result = await submitSurrenderRequest(buildRequestPayload(loggedInUser));
    const requestId = result.request?.id || "Submitted";
    document.getElementById("surrenderForm")?.classList.add("hidden");
    document.querySelector(".mobile-form-progress")?.classList.add("hidden");
    const success = document.getElementById("surrenderSuccessPanel");
    const idDisplay = document.getElementById("submittedRequestId");
    if (idDisplay) idDisplay.textContent = requestId;
    success?.classList.remove("hidden");
    success?.focus();
    await loadMySurrenderRequests();
  } catch (error) {
    if (error.code === "SURRENDER_REQUESTS_CLOSED") {
      applySurrenderAvailability(error.availability || { acceptingRequests: false });
      document.getElementById("surrenderAvailabilityPanel")?.focus({ preventScroll: true });
    }
    showFeedback(error.message || "The request could not be submitted. Please try again.", "error");
  } finally {
    setSubmitting(false);
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_DETAILS = {
  Pending: { icon: "fa-clock", label: "Pending review", text: "The shelter team has received this request and will review the details and available space." },
  Approved: { icon: "fa-circle-check", label: "Approved", text: "The request has been approved. Shelter staff will coordinate the next intake step with you." },
  Rejected: { icon: "fa-circle-xmark", label: "Not approved", text: "The shelter could not approve this request. Review any staff notes for the reason and next guidance." },
  Converted: { icon: "fa-arrow-right-arrow-left", label: "Converted to intake", text: "An intake record has already been created from this approved request. No additional approval is needed." },
  Completed: { icon: "fa-flag-checkered", label: "Completed", text: "The shelter workflow for this request has been completed." },
};

async function loadMySurrenderRequests() {
  const container = document.getElementById("requestHistoryContent");
  const refreshButton = document.getElementById("refreshRequestStatus");
  if (!container) return;
  const user = getLoggedInUser();
  if (!user) {
    refreshButton?.classList.add("hidden");
    container.innerHTML = '<div class="surrender-state"><i class="fa-solid fa-user-lock" aria-hidden="true"></i><div><h3>Sign in to track requests</h3><p>Your request history is linked to the email on your Animua account.</p><button type="button" class="btn primary-btn" id="statusLoginButton">Sign in to continue</button></div></div>';
    document.getElementById("statusLoginButton")?.addEventListener("click", openLoginModal);
    return;
  }

  refreshButton?.classList.remove("hidden");
  refreshButton?.setAttribute("aria-busy", "true");
  container.innerHTML = '<div class="surrender-state surrender-state-loading"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i><p>Loading your requests…</p></div>';
  try {
    const response = await fetch(MY_SURRENDER_REQUESTS_API_URL, { headers: { Authorization: `Bearer ${user.token}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Unable to load your requests.");
    renderRequestHistory(Array.isArray(data.requests) ? data.requests : []);
  } catch (error) {
    container.innerHTML = `<div class="surrender-state is-error"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><div><h3>Request history is unavailable</h3><p>${escapeHtml(error.message || "Please try again in a moment.")}</p><button type="button" class="btn secondary-btn" id="retryRequestHistory">Try again</button></div></div>`;
    document.getElementById("retryRequestHistory")?.addEventListener("click", loadMySurrenderRequests);
  } finally {
    refreshButton?.removeAttribute("aria-busy");
  }
}

function renderRequestHistory(requests) {
  const container = document.getElementById("requestHistoryContent");
  if (!container) return;
  if (!requests.length) {
    container.innerHTML = '<div class="surrender-state"><i class="fa-regular fa-folder-open" aria-hidden="true"></i><div><h3>No surrender requests yet</h3><p>When you submit a request, its review status will appear here.</p><a class="btn secondary-btn" href="#surrenderRequestWorkspace">Start a request</a></div></div>';
    return;
  }

  container.innerHTML = `<div class="request-history-list">${requests.map(request => {
    const status = request.status || "Pending";
    const detail = STATUS_DETAILS[status] || STATUS_DETAILS.Pending;
    const petName = request.pet?.name || "Unnamed animal";
    const petMeta = [request.pet?.species, request.pet?.breed].filter(Boolean).join(" · ") || "Animal details not provided";
    const note = status === "Rejected" ? request.rejectedReason : request.reviewNotes;
    return `<article class="request-history-card status-${escapeHtml(status.toLowerCase())}">
      <div class="request-card-top"><div><span class="request-id">${escapeHtml(request.id || "Request")}</span><h3>${escapeHtml(petName)}</h3><p>${escapeHtml(petMeta)}</p></div><span class="request-status-pill"><i class="fa-solid ${detail.icon}" aria-hidden="true"></i>${detail.label}</span></div>
      <div class="request-status-guidance"><p>${detail.text}</p>${status === "Converted" && request.intakeId ? `<span><strong>Intake record:</strong> ${escapeHtml(request.intakeId)}</span>` : ""}${note ? `<span><strong>Staff note:</strong> ${escapeHtml(note)}</span>` : ""}</div>
      <footer><span><i class="fa-regular fa-calendar" aria-hidden="true"></i> Submitted ${escapeHtml(formatDate(request.submittedAt || request.createdAt))}</span></footer>
    </article>`;
  }).join("")}</div>`;
}

function resetForAnotherRequest() {
  if (!surrenderAcceptingRequests) {
    document.getElementById("surrenderAvailabilityPanel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const form = document.getElementById("surrenderForm");
  form?.reset();
  form?.classList.remove("hidden");
  document.querySelector(".mobile-form-progress")?.classList.remove("hidden");
  document.getElementById("surrenderSuccessPanel")?.classList.add("hidden");
  document.querySelectorAll(".field-error").forEach(error => { error.textContent = ""; });
  document.querySelectorAll(".is-invalid").forEach(field => field.classList.remove("is-invalid"));
  currentStep = 1;
  highestVisitedStep = 1;
  fillOwnerInfoFromAccount();
  updateReasonCount();
  clearAnimalPhotoPreview();
  showStep(1);
}

function updateReasonCount() {
  const reason = document.getElementById("reasons");
  const counter = document.getElementById("reasonCount");
  if (counter) counter.textContent = `${reason?.value.length || 0} characters`;
}

function bindStepNavigation() {
  document.querySelectorAll("[data-next-step]").forEach(button => button.addEventListener("click", () => {
    if (validateStep(currentStep)) showStep(button.dataset.nextStep);
  }));
  document.querySelectorAll("[data-previous-step]").forEach(button => button.addEventListener("click", () => showStep(button.dataset.previousStep)));
  document.querySelectorAll("[data-step-link]").forEach(button => button.addEventListener("click", () => {
    const target = Number(button.dataset.stepLink);
    if (target <= highestVisitedStep) {
      showStep(target);
      return;
    }
    if (target === currentStep + 1 && validateStep(currentStep)) showStep(target);
  }));
}

function bindWaiverLanguageToggle() {
  const title = document.getElementById("agreementTitle");
  const consent = document.getElementById("agreementConsentText");
  const buttons = document.querySelectorAll("[data-waiver-language]");
  const copies = document.querySelectorAll("[data-waiver-copy]");
  if (!buttons.length || !copies.length) return;

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const language = button.dataset.waiverLanguage || "tl";
      buttons.forEach(item => {
        const isActive = item === button;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-pressed", String(isActive));
      });
      copies.forEach(copy => {
        const isActive = copy.dataset.waiverCopy === language;
        copy.hidden = !isActive;
        copy.classList.toggle("is-active", isActive);
      });
      if (title) title.textContent = title.dataset[`waiverTitle${language === "en" ? "En" : "Tl"}`] || title.textContent;
      if (consent) consent.textContent = consent.dataset[`consent${language === "en" ? "En" : "Tl"}`] || consent.textContent;
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("surrenderForm");
  fillOwnerInfoFromAccount();
  bindStepNavigation();
  bindWaiverLanguageToggle();
  bindAnimalPhotoUpload();
  showStep(1, { scroll: false, focus: false });
  loadSurrenderAvailability();
  loadMySurrenderRequests();
  form?.addEventListener("submit", handleSurrenderSubmit);

  form?.querySelectorAll("input, select, textarea").forEach(field => {
    field.addEventListener("input", () => {
      if (field.classList.contains("is-invalid")) setFieldError(field, validationMessage(field));
      if (field.id === "reasons") updateReasonCount();
    });
    field.addEventListener("change", () => {
      if (field.classList.contains("is-invalid")) setFieldError(field, validationMessage(field));
    });
  });

  document.getElementById("refreshRequestStatus")?.addEventListener("click", loadMySurrenderRequests);
  document.getElementById("trackSubmittedRequest")?.addEventListener("click", () => document.getElementById("mySurrenderRequests")?.scrollIntoView({ behavior: "smooth" }));
  document.getElementById("startAnotherRequest")?.addEventListener("click", resetForAnotherRequest);
  document.getElementById("checkSurrenderAvailability")?.addEventListener("click", () => {
    loadSurrenderAvailability({ showError: true });
  });
});
