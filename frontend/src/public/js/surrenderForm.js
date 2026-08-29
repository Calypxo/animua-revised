import { API_BASE_URL } from "../../utils/api.js";
import {
  ensureUserSession,
  getUserSession,
  setPostAuthRedirect,
} from "../../utils/storage.js";
import {
  deleteQueuedPublicRequest,
  getQueuedPublicRequests,
  isNetworkError,
  markQueuedPublicRequestAttempt,
  queuePublicRequest,
} from "../../services/offlinePublicQueue.service.js";

const SUBMIT_SURRENDER_API_URL = `${API_BASE_URL}/surrenders`;
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

const FIELD_ERRORS = {
  ownerName: "ownerNameError",
  contactNo: "contactError",
  ownerAddress: "addressError",
  ownerBarangay: "barangayError",
  identityIdFront: "identityIdFrontError",
  identityIdBack: "identityIdBackError",
  reasons: "reasonError",
  agreeAllTerms: "agreementError",
};

let currentStep = 1;
let highestVisitedStep = 1;
let isSubmitting = false;
let animalPhotoData = null;
let identityDocumentData = { front: null, back: null };
let surrenderAcceptingRequests = true;
let isSyncingQueuedSurrenders = false;
const surrenderSelectMenus = [];

const MAX_IMAGE_UPLOAD_SIZE = 5 * 1024 * 1024;
const MAX_PROCESSED_IMAGE_SIZE = 400 * 1024;
const MAX_PROCESSED_IMAGE_SIDE = 1600;

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
  const session = getUserSession();
  if (!session) return null;
  return {
    name: session.fullName,
    email: session.email,
    role: session.role,
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

function openLoginModal(event) {
  event?.preventDefault();
  setPostAuthRedirect("/pages/public/surrender.html");
  const authModal = document.getElementById("authModal");
  if (authModal) {
    authModal.classList.remove("hidden");
    document.body.classList.add("modal-open", "auth-open");
    return;
  }
  sessionStorage.setItem("animua_open_auth_modal", "true");
  window.location.href = "/pages/public/home.html";
}

function applySurrenderAuthState(user = getLoggedInUser()) {
  const locked = !user;
  const workspace = document.querySelector(".surrender-workspace");
  const panel = document.getElementById("surrenderAuthPanel");
  const form = document.getElementById("surrenderForm");

  workspace?.classList.toggle("is-auth-required", locked);
  if (panel) panel.hidden = !locked;
  if (form) {
    form.inert = locked;
    form.setAttribute("aria-disabled", String(locked));
  }

  return !locked;
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
  field.closest(".identity-document-field")?.classList.toggle("is-invalid", Boolean(message));
  getSurrenderSelectMenu(field)?.wrapper.classList.toggle("is-invalid", Boolean(message));
  if (error) error.textContent = message;
}

function syncSurrenderSelectMenus() {
  surrenderSelectMenus.forEach(({ select, wrapper, button, label }) => {
    const selectedOption = select.options[select.selectedIndex];
    label.textContent = selectedOption?.textContent || select.options[0]?.textContent || "Select";
    button.disabled = select.disabled;
    wrapper.classList.toggle("is-disabled", select.disabled);
    wrapper.classList.toggle("has-value", Boolean(select.value));
    wrapper.querySelectorAll("[data-select-value]").forEach((optionButton) => {
      const isActive = optionButton.dataset.selectValue === select.value;
      optionButton.classList.toggle("is-active", isActive);
      optionButton.setAttribute("aria-selected", String(isActive));
    });
  });
}

function closeSurrenderSelectMenus(exceptWrapper = null) {
  surrenderSelectMenus.forEach(({ wrapper, button, menu }) => {
    if (wrapper === exceptWrapper) return;
    wrapper.classList.remove("is-open", "opens-up");
    button.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  });
}

function getSurrenderSelectMenu(select) {
  return surrenderSelectMenus.find((menuConfig) => menuConfig.select === select);
}

function positionSurrenderSelectMenu(wrapper, menu) {
  wrapper.classList.remove("opens-up");
  const panel = wrapper.closest(".surrender-form-wrap") || document.documentElement;
  const boundary = panel.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();
  const menuHeight = Math.min(menu.scrollHeight, 260);
  const spaceBelow = boundary.bottom - wrapperRect.bottom - 18;
  const spaceAbove = wrapperRect.top - boundary.top - 18;

  if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
    wrapper.classList.add("opens-up");
  }
}

function setupSurrenderSelectMenus() {
  const form = document.getElementById("surrenderForm");
  if (!form) return;

  form.querySelectorAll(".form-group select").forEach((select) => {
    if (select.dataset.customSelectReady === "true") return;
    select.dataset.customSelectReady = "true";
    select.classList.add("native-surrender-select");

    const wrapper = document.createElement("div");
    wrapper.className = "surrender-select-menu";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "surrender-select-trigger";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");

    const label = document.createElement("span");
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-chevron-down";
    icon.setAttribute("aria-hidden", "true");
    button.append(label, icon);

    const menu = document.createElement("div");
    menu.className = "surrender-select-options";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    Array.from(select.options).forEach((option) => {
      const optionButton = document.createElement("button");
      optionButton.type = "button";
      optionButton.dataset.selectValue = option.value;
      optionButton.setAttribute("role", "option");
      optionButton.textContent = option.textContent;
      optionButton.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        wrapper.classList.remove("is-invalid");
        closeSurrenderSelectMenus();
        button.focus();
      });
      menu.appendChild(optionButton);
    });

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (select.disabled) return;
      const willOpen = !wrapper.classList.contains("is-open");
      closeSurrenderSelectMenus(wrapper);
      wrapper.classList.toggle("is-open", willOpen);
      button.setAttribute("aria-expanded", String(willOpen));
      menu.hidden = !willOpen;
      if (willOpen) positionSurrenderSelectMenu(wrapper, menu);
    });

    select.addEventListener("change", () => {
      wrapper.classList.remove("is-invalid");
      syncSurrenderSelectMenus();
    });
    select.after(wrapper);
    wrapper.append(button, menu);
    surrenderSelectMenus.push({ select, wrapper, button, label, menu });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".surrender-select-menu")) closeSurrenderSelectMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSurrenderSelectMenus();
  });

  syncSurrenderSelectMenus();
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

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.setCustomValidity("");
    setAnimalPhotoError("");
    clearAnimalPhotoPreview();
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      input.value = "";
      setAnimalPhotoError("Upload a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
      input.value = "";
      setAnimalPhotoError("Animal photo must be 5 MB or smaller.");
      return;
    }

    const label = document.getElementById("animalPhotoLabel");
    if (label) label.textContent = "Optimizing photo...";
    input.setCustomValidity("Please wait while the animal photo is prepared.");

    try {
      const fileData = await optimizeImageUpload(file, {
        fallbackName: "animal-photo",
        label: "animal photo",
      });
      if (input.files?.[0] !== file) return;
      input.setCustomValidity("");
      animalPhotoData = fileData;
      const preview = document.getElementById("animalPhotoPreview");
      if (preview) preview.innerHTML = `<img src="${fileData.dataUrl}" alt="">`;
      if (label) {
        label.textContent = fileData.name;
        label.title = fileData.name;
      }
    } catch (error) {
      input.setCustomValidity("");
      input.value = "";
      clearAnimalPhotoPreview();
      setAnimalPhotoError(error.message || "We could not prepare this animal photo. Please choose another image.");
    }
  });
}

function getIdentityDocumentSide(input) {
  return input?.id === "identityIdBack" ? "back" : "front";
}

function setIdentityDocumentPreview(side, fileData = null) {
  const preview = document.getElementById(side === "back" ? "identityIdBackPreview" : "identityIdFrontPreview");
  const label = document.getElementById(side === "back" ? "identityIdBackLabel" : "identityIdFrontLabel");
  if (!preview || !label) return;

  preview.classList.toggle("has-image", Boolean(fileData));
  label.title = fileData?.name || "";

  if (!fileData) {
    preview.innerHTML = `<i class="fa-regular ${side === "back" ? "fa-address-card" : "fa-id-card"}" aria-hidden="true"></i>`;
    label.textContent = side === "back" ? "Upload back of ID" : "Upload front of ID";
    return;
  }

  preview.innerHTML = `<img src="${fileData.dataUrl}" alt="">`;
  label.textContent = fileData.name;
}

function clearIdentityDocumentPreview(side) {
  identityDocumentData[side] = null;
  setIdentityDocumentPreview(side, null);
}

function getDataUrlByteSize(dataUrl = "") {
  const encoded = String(dataUrl).split(",")[1] || "";
  const padding = (encoded.match(/=*$/)?.[0].length) || 0;
  return Math.max(0, Math.ceil((encoded.length * 3) / 4) - padding);
}

function loadUploadImage(file, label = "photo") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`We could not open this ${label}. Please choose another image.`));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error(`We could not read this ${label}. Please choose another image.`));
    reader.readAsDataURL(file);
  });
}

async function optimizeImageUpload(file, { fallbackName = "photo", label = "photo" } = {}) {
  const image = await loadUploadImage(file, label);
  const originalMaxSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  let scale = Math.min(1, MAX_PROCESSED_IMAGE_SIDE / originalMaxSide);

  while (scale > 0.2) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error(`This browser could not prepare the ${label}.`);

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (let quality = 0.9; quality >= 0.5; quality -= 0.08) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const size = getDataUrlByteSize(dataUrl);
      if (size <= MAX_PROCESSED_IMAGE_SIZE) {
        return {
          name: `${file.name.replace(/\.[^.]+$/, "") || fallbackName}.jpg`,
          type: "image/jpeg",
          size,
          dataUrl,
        };
      }
    }

    scale *= 0.82;
  }

  throw new Error(`We could not optimize this ${label}. Please choose a clearer or smaller image.`);
}

function bindIdentityDocumentUploads() {
  document.querySelectorAll("#identityIdFront, #identityIdBack").forEach(input => {
    input.addEventListener("change", async () => {
      const side = getIdentityDocumentSide(input);
      const file = input.files?.[0];
      input.setCustomValidity("");
      setFieldError(input, "");
      clearIdentityDocumentPreview(side);
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        input.value = "";
        setFieldError(input, "Upload a JPG, PNG, or WebP image.");
        return;
      }

      if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
        input.value = "";
        setFieldError(input, "ID photo must be 5 MB or smaller.");
        return;
      }

      const label = document.getElementById(side === "back" ? "identityIdBackLabel" : "identityIdFrontLabel");
      if (label) label.textContent = "Optimizing photo...";
      input.setCustomValidity("Please wait while the ID photo is prepared.");

      try {
        const fileData = await optimizeImageUpload(file, {
          fallbackName: "valid-id",
          label: "ID photo",
        });
        if (input.files?.[0] !== file) return;
        input.setCustomValidity("");
        identityDocumentData[side] = fileData;
        setIdentityDocumentPreview(side, fileData);
      } catch (error) {
        input.setCustomValidity("");
        input.value = "";
        clearIdentityDocumentPreview(side);
        setFieldError(input, error.message || "We could not prepare this ID photo. Please choose another image.");
      }
    });
  });
}

function validationMessage(field) {
  if (field.validity.customError) return field.validationMessage;
  if (field.id === "identityIdFront") return "Upload the front of your valid ID with your address visible.";
  if (field.id === "identityIdBack") return "Upload the back of your valid ID.";
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
    const customSelect = getSurrenderSelectMenu(firstInvalid);
    if (customSelect) {
      customSelect.wrapper.classList.add("is-invalid", "is-open");
      customSelect.button.setAttribute("aria-expanded", "true");
      customSelect.menu.hidden = false;
      positionSurrenderSelectMenu(customSelect.wrapper, customSelect.menu);
      customSelect.button.focus();
    } else {
      firstInvalid.focus();
    }
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
  syncSurrenderSelectMenus();
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
  let response;
  try {
    response = await fetch(SUBMIT_SURRENDER_API_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
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

async function syncQueuedSurrenderRequests() {
  if (isSyncingQueuedSurrenders || !navigator.onLine) return;
  isSyncingQueuedSurrenders = true;
  let syncedCount = 0;

  try {
    const queued = await getQueuedPublicRequests("surrenderRequest");
    for (const item of queued) {
      try {
        await submitSurrenderRequest(item.payload.requestData);
        await deleteQueuedPublicRequest(item.id);
        syncedCount += 1;
      } catch (error) {
        await markQueuedPublicRequestAttempt(item.id, error);
        if (isNetworkError(error)) break;
      }
    }
  } catch (error) {
    console.error("Failed to sync queued surrender requests:", error);
  } finally {
    isSyncingQueuedSurrenders = false;
  }

  if (syncedCount) {
    showFeedback(`${syncedCount} offline surrender request${syncedCount === 1 ? "" : "s"} synced.`, "info");
    await loadMySurrenderRequests();
  }
}

function setSubmitting(submitting) {
  isSubmitting = submitting;
  const form = document.getElementById("surrenderForm");
  const button = document.getElementById("submitSurrenderBtn");
  form?.classList.toggle("is-submitting", submitting);
  form?.setAttribute("aria-busy", String(submitting));
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
      identityDocuments: {
        front: identityDocumentData.front ? {
          name: identityDocumentData.front.name,
          type: identityDocumentData.front.type,
          size: identityDocumentData.front.size,
          dataUrl: identityDocumentData.front.dataUrl,
        } : null,
        back: identityDocumentData.back ? {
          name: identityDocumentData.back.name,
          type: identityDocumentData.back.type,
          size: identityDocumentData.back.size,
          dataUrl: identityDocumentData.back.dataUrl,
        } : null,
      },
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
    const requestData = buildRequestPayload(loggedInUser);
    await submitSurrenderRequest(requestData);
    document.getElementById("surrenderForm")?.classList.add("hidden");
    const success = document.getElementById("surrenderSuccessPanel");
    success?.classList.remove("hidden");
    success?.focus();
    await loadMySurrenderRequests();
  } catch (error) {
    if (isNetworkError(error)) {
      try {
        const requestData = buildRequestPayload(loggedInUser);
        await queuePublicRequest("surrenderRequest", { requestData });
        document.getElementById("surrenderForm")?.classList.add("hidden");
        const success = document.getElementById("surrenderSuccessPanel");
        success?.classList.remove("hidden");
        success?.focus();
        showFeedback("Saved offline. Your surrender request will sync when internet returns.", "info");
        await loadMySurrenderRequests();
        return;
      } catch (storageError) {
        showFeedback(storageError.message || "Offline storage is not available.", "error");
        return;
      }
    }

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
  const pendingRequests = await getQueuedPublicRequests("surrenderRequest").catch(() => []);

  try {
    const response = await fetch(MY_SURRENDER_REQUESTS_API_URL, { credentials: "include" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Unable to load your requests.");
    renderRequestHistory([
      ...pendingRequests.map((item) => ({
        ...(item.payload.requestData || {}),
        offlinePending: true,
        queuedAt: item.queuedAt,
      })),
      ...(Array.isArray(data.requests) ? data.requests : []),
    ]);
  } catch (error) {
    if (pendingRequests.length) {
      renderRequestHistory(pendingRequests.map((item) => ({
        ...(item.payload.requestData || {}),
        offlinePending: true,
        queuedAt: item.queuedAt,
      })));
    } else {
      container.innerHTML = `<div class="surrender-state is-error"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><div><h3>Request history is unavailable</h3><p>${escapeHtml(error.message || "Please try again in a moment.")}</p><button type="button" class="btn secondary-btn" id="retryRequestHistory">Try again</button></div></div>`;
    }
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
    const pending = Boolean(request.offlinePending);
    const petName = request.pet?.name || "Unnamed animal";
    const petMeta = [request.pet?.species, request.pet?.breed].filter(Boolean).join(" · ") || "Animal details not provided";
    const note = status === "Rejected" ? request.rejectedReason || request.reviewNotes : request.reviewNotes;
    const noteLabel = status === "Rejected" ? "Reason for rejection" : "Staff note";
    return `<article class="request-history-card status-${escapeHtml(status.toLowerCase())} ${pending ? "is-offline-pending" : ""}">
      <div class="request-card-top"><div><span class="request-id">${escapeHtml(request.id || "Request")}</span><h3>${escapeHtml(petName)}</h3><p>${escapeHtml(petMeta)}</p></div><span class="request-status-pill"><i class="fa-solid ${pending ? "fa-cloud-arrow-up" : detail.icon}" aria-hidden="true"></i>${pending ? "Pending sync" : detail.label}</span></div>
      <div class="request-status-guidance"><p>${pending ? "Saved on this device. It will be submitted when internet returns." : detail.text}</p>${status === "Converted" && request.intakeId ? `<span><strong>Intake record:</strong> ${escapeHtml(request.intakeId)}</span>` : ""}${note ? `<span><strong>${noteLabel}:</strong> ${escapeHtml(note)}</span>` : ""}</div>
      <footer><span><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${pending ? "Saved" : "Submitted"} ${escapeHtml(formatDate(request.queuedAt || request.submittedAt || request.createdAt))}</span></footer>
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
  document.getElementById("surrenderSuccessPanel")?.classList.add("hidden");
  document.querySelectorAll(".field-error").forEach(error => { error.textContent = ""; });
  document.querySelectorAll(".is-invalid").forEach(field => field.classList.remove("is-invalid"));
  currentStep = 1;
  highestVisitedStep = 1;
  fillOwnerInfoFromAccount();
  updateReasonCount();
  clearAnimalPhotoPreview();
  clearIdentityDocumentPreview("front");
  clearIdentityDocumentPreview("back");
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

document.addEventListener("DOMContentLoaded", async () => {
  let session = null;
  try {
    session = await ensureUserSession();
  } catch (error) {
    console.warn("Unable to verify the surrender account session:", error.message);
  }
  const form = document.getElementById("surrenderForm");
  const canUseSurrenderForm = applySurrenderAuthState(session);
  fillOwnerInfoFromAccount();
  bindStepNavigation();
  bindWaiverLanguageToggle();
  bindAnimalPhotoUpload();
  bindIdentityDocumentUploads();
  setupSurrenderSelectMenus();
  showStep(1, { scroll: false, focus: false });
  const scheduleNonCriticalRequest = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1200));
  scheduleNonCriticalRequest(() => {
    if (canUseSurrenderForm) syncQueuedSurrenderRequests();
    loadSurrenderAvailability();
    loadMySurrenderRequests();
  }, { timeout: 2500 });
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
  document.getElementById("surrenderAuthLoginButton")?.addEventListener("click", openLoginModal);
  document.querySelector('.surrender-hero-actions a[href="#surrenderRequestWorkspace"]')?.addEventListener("click", (event) => {
    if (!canUseSurrenderForm) openLoginModal(event);
  });
  window.addEventListener("online", () => {
    if (getLoggedInUser()) syncQueuedSurrenderRequests();
  });
});
