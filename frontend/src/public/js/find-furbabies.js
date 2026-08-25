import { API_BASE_URL } from "../../utils/api.js";
import Swal from "sweetalert2";
import dogFallbackImage from "../../assets/images/optimized/home/hero-shelter-dog-kennel-768.webp";
import catFallbackImage from "../../assets/images/optimized/home/highlight-new-furbabies-cat-360.webp";
import { createSelectionFocusGuard } from "./adoption-ui-state.js";
import { ensureUserSession, getUserSession, hasUserSession } from "../../utils/storage.js";
import {
  deleteQueuedPublicRequest,
  getQueuedPublicRequests,
  isNetworkError,
  markQueuedPublicRequestAttempt,
  queuePublicRequest,
} from "../../services/offlinePublicQueue.service.js";

const petsGrid = document.getElementById("petsGrid");
const resultsCount = document.getElementById("resultsCount");
const heroPetCount = document.getElementById("heroPetCount");
const emptyState = document.getElementById("emptyState");
const petSearch = document.getElementById("petSearch");
const petSort = document.getElementById("petSort");
const petSortLabel = document.getElementById("petSortLabel");
const petSortMenu = document.getElementById("petSortMenu");
const petSortOptions = document.querySelectorAll(".sort-menu-option");
const filterTabs = document.querySelectorAll(".filter-tab");
let isSyncingQueuedAdoptions = false;

const profileModal = document.getElementById("petProfileModal");
const adoptModal = document.getElementById("adoptModal");

const profileImage = document.getElementById("profileImage");
const profileType = document.getElementById("profileType");
const profileName = document.getElementById("profileName");
const profileDescription = document.getElementById("profileDescription");
const profileAge = document.getElementById("profileAge");
const profileSex = document.getElementById("profileSex");
const profileBreed = document.getElementById("profileBreed");
const profileColor = document.getElementById("profileColor");
const profileStatus = document.getElementById("profileStatus");
const profileHealth = document.getElementById("profileHealth");
const profileTraits = document.getElementById("profileTraits");
const profileMatch = document.getElementById("profileMatch");
const profileAdoptBtn = document.getElementById("profileAdoptBtn");
const profileImageZoomBtn = document.getElementById("profileImageZoomBtn");
const petPhotoLightbox = document.getElementById("petPhotoLightbox");
const petPhotoLightboxPanel = document.querySelector(".pet-photo-lightbox-panel");
const petPhotoLightboxClose = document.getElementById("petPhotoLightboxClose");
const petPhotoLightboxImage = document.getElementById("petPhotoLightboxImage");
const petPhotoLightboxTitle = document.getElementById("petPhotoLightboxTitle");

const selectedPetName = document.getElementById("selectedPetName");
const selectedPetImage = document.getElementById("selectedPetImage");
const selectedPetMeta = document.getElementById("selectedPetMeta");
const selectedPetStatus = document.getElementById("selectedPetStatus");
const petIdField = document.getElementById("petIdField");
const petNameField = document.getElementById("petNameField");
const adoptionForm = document.getElementById("adoptionForm");
const formMessage = document.getElementById("formMessage");
const adoptionStepButtons = document.querySelectorAll("[data-adoption-step-target]");
const adoptionNextBtn = document.getElementById("adoptionNextBtn");
const adoptionBackBtn = document.getElementById("adoptionBackBtn");
const adoptionSubmitBtn = document.getElementById("adoptionSubmitBtn");
const adoptionExitBtn = document.getElementById("adoptionExitBtn");
const adoptionExitConfirm = document.getElementById("adoptionExitConfirm");
const adoptionExitCancel = document.getElementById("adoptionExitCancel");
const adoptionExitConfirmBtn = document.getElementById("adoptionExitConfirmBtn");
const adoptionReviewSummary = document.getElementById("adoptionReviewSummary");
const adoptionSectionTitle = document.getElementById("adoptionSectionTitle");
const birthdateField = document.getElementById("birthdate");
const birthdatePickerBtn = document.getElementById("birthdatePickerBtn");
const idFrontUpload = document.getElementById("idFrontUpload");
const idBackUpload = document.getElementById("idBackUpload");
const idFrontPreview = document.getElementById("idFrontPreview");
const idBackPreview = document.getElementById("idBackPreview");
const adoptionDeclarationCheckboxes = [
  document.getElementById("confirmTruthful"),
  document.getElementById("agreeDeclaration"),
  document.getElementById("understandNoGuarantee")
].filter(Boolean);

let currentFilter = "all";
let currentSort = "newest";
let currentPetForAdoption = null;
let currentAdoptionStep = 1;
let idFrontFileData = null;
let idBackFileData = null;
let adoptionSelectMenus = [];
const ADOPTION_PENDING_SOURCE = "find_furbabies_adopt_click";
const ADOPTION_PENDING_MAX_AGE_MS = 15 * 60 * 1000;
const ADOPTION_RESUME_FLAG = "animua_resume_adoption_after_auth";

function textOr(value, fallback = "Not recorded") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatAgeLabel(value) {
  const text = String(value ?? "").trim();
  return text && !/^unknown(?:\s+age)?$/i.test(text) ? text : "UNKNOWN";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const getField = (id) => document.getElementById(id);
const getValue = (id) => getField(id)?.value?.trim() || "";

function clearPendingAdoptionSelection() {
  sessionStorage.removeItem("animua_selected_pet_id");
  sessionStorage.removeItem("animua_selected_pet_action");
  sessionStorage.removeItem("animua_selected_pet_source");
  sessionStorage.removeItem("animua_selected_pet_timestamp");
  sessionStorage.removeItem(ADOPTION_RESUME_FLAG);
}

const adoptionStepFields = {
  1: ["fullName", "birthdate", "age", "address", "civilStatus", "gender", "citizenship", "contactNumber", "occupation"],
  2: ["spouseName", "childrenNames", "hasCurrentPets", "numberOfPets", "currentPetType", "visitVeterinarian", "vetClinicName", "housingType", "residenceAllowsPets", "existingPets"],
  3: ["whyAdopt", "primaryCaregiver", "petStayLocation", "hoursAlone", "provideVetCare", "provideDailyCare", "cannotCarePlan", "additionalInfo"],
  4: ["confirmTruthful", "agreeDeclaration", "understandNoGuarantee"]
};

const adoptionStepTitles = {
  1: ["fa-shield-heart", "Personal Information"],
  2: ["fa-house-chimney", "Household Information"],
  3: ["fa-heart-circle-check", "Adoption Readiness"],
  4: ["fa-clipboard-check", "Review and Declaration"]
};

function calculateAgeFromBirthdate(value) {
  if (!value) return "";
  const birthdate = new Date(value);
  if (Number.isNaN(birthdate.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let age = today.getFullYear() - birthdate.getFullYear();
  const monthDiff = today.getMonth() - birthdate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
    age -= 1;
  }
  return age >= 0 ? String(age) : "";
}

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function syncBirthdateAge() {
  if (!birthdateField) return;
  const age = calculateAgeFromBirthdate(birthdateField.value);
  if (getField("age")) getField("age").value = age;
}

function validateBirthdateField() {
  if (!birthdateField) return true;
  const value = birthdateField.value.trim();
  const selected = parseDateValue(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let message = "";
  if (!value) {
    message = "Please select your birthdate.";
  } else if (!selected) {
    message = "Please use the calendar to select a valid birthdate.";
  } else if (selected > today) {
    message = "Birthdate cannot be in the future.";
  }

  birthdateField.setCustomValidity(message);
  return !message;
}

function setupBirthdatePicker() {
  if (!birthdateField || !birthdatePickerBtn) return;

  const fieldWrap = birthdateField.closest("[data-date-picker]") || birthdateField.parentElement;
  const picker = document.createElement("div");
  picker.className = "birthdate-calendar";
  picker.hidden = true;
  picker.setAttribute("role", "dialog");
  picker.setAttribute("aria-label", "Choose birthdate");
  fieldWrap?.appendChild(picker);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  birthdateField.max = formatDateValue(today);
  const monthNames = Array.from({ length: 12 }, (_, month) =>
    new Date(2000, month, 1).toLocaleString("en-US", { month: "long" })
  );
  let viewDate = parseDateValue(birthdateField.value) || new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  const selectionFocusGuard = createSelectionFocusGuard();
  const clampToToday = (date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized > today ? new Date(today) : normalized;
  };
  const isCurrentMonthView = () =>
    viewDate.getFullYear() === today.getFullYear() &&
    viewDate.getMonth() === today.getMonth();

  const closeMonthMenu = ({ restoreFocus = false } = {}) => {
    const menu = picker.querySelector("[data-calendar-month-options]");
    const trigger = picker.querySelector("[data-calendar-month-trigger]");
    if (!menu || !trigger || menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  };

  const openMonthMenu = () => {
    const menu = picker.querySelector("[data-calendar-month-options]");
    const trigger = picker.querySelector("[data-calendar-month-trigger]");
    if (!menu || !trigger) return;
    closeYearMenu();
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      const selectedMonth = menu.querySelector('[aria-selected="true"]');
      selectedMonth?.scrollIntoView({ block: "center" });
      selectedMonth?.focus({ preventScroll: true });
    });
  };

  const closeYearMenu = ({ restoreFocus = false } = {}) => {
    const menu = picker.querySelector("[data-calendar-year-options]");
    const trigger = picker.querySelector("[data-calendar-year-trigger]");
    if (!menu || !trigger || menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  };

  const openYearMenu = () => {
    const menu = picker.querySelector("[data-calendar-year-options]");
    const trigger = picker.querySelector("[data-calendar-year-trigger]");
    if (!menu || !trigger) return;
    closeMonthMenu();
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      const selectedYear = menu.querySelector('[aria-selected="true"]');
      selectedYear?.scrollIntoView({ block: "center" });
      selectedYear?.focus({ preventScroll: true });
    });
  };

  const closePicker = () => {
    closeMonthMenu();
    closeYearMenu();
    picker.hidden = true;
    birthdatePickerBtn.setAttribute("aria-expanded", "false");
  };

  const openPicker = () => {
    const selected = parseDateValue(birthdateField.value);
    if (selected) viewDate = clampToToday(selected);
    renderPicker();
    picker.hidden = false;
    birthdatePickerBtn.setAttribute("aria-expanded", "true");
  };

  const chooseDate = (date) => {
    if (clampToToday(date).getTime() !== date.getTime()) return;
    birthdateField.value = formatDateValue(date);
    birthdateField.dispatchEvent(new Event("change", { bubbles: true }));
    closePicker();
    selectionFocusGuard.focusAfterSelection(birthdateField);
  };

  const renderPicker = () => {
    const selected = parseDateValue(birthdateField.value);
    const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());
    const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const yearStart = today.getFullYear() - 100;
    const yearEnd = today.getFullYear();
    const yearOptions = Array.from({ length: yearEnd - yearStart + 1 }, (_, index) => {
      const year = yearEnd - index;
      const isSelected = year === viewDate.getFullYear();
      return `<button type="button" role="option" data-calendar-year-option="${year}" aria-selected="${isSelected}" tabindex="${isSelected ? "0" : "-1"}">${year}</button>`;
    }).join("");
    const monthOptions = monthNames
      .map((month, index) => {
        const isFutureMonth = viewDate.getFullYear() === today.getFullYear() && index > today.getMonth();
        const isSelected = index === viewDate.getMonth();
        return `<button type="button" role="option" data-calendar-month-option="${index}" aria-selected="${isSelected}" tabindex="${isSelected ? "0" : "-1"}"${isFutureMonth ? " disabled aria-disabled=\"true\"" : ""}>${escapeHtml(month)}</button>`;
      })
      .join("");

    const days = Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setHours(0, 0, 0, 0);
      day.setDate(gridStart.getDate() + index);
      const value = formatDateValue(day);
      const isMuted = day.getMonth() !== viewDate.getMonth();
      const isSelected = selected && value === formatDateValue(selected);
      const isToday = value === formatDateValue(today);
      const isFuture = day > today;
      return `
        <button type="button" class="calendar-day${isMuted ? " is-muted" : ""}${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}${isFuture ? " is-disabled" : ""}" data-date="${value}"${isFuture ? " disabled aria-disabled=\"true\"" : ""}>
          ${day.getDate()}
        </button>
      `;
    }).join("");

    picker.innerHTML = `
      <div class="calendar-head">
        <div class="calendar-selects">
          <div class="calendar-month-menu" data-calendar-month-menu>
            <button type="button" class="calendar-month-trigger" data-calendar-month-trigger aria-label="Choose birth month" aria-haspopup="listbox" aria-expanded="false">
              <span>${escapeHtml(monthNames[viewDate.getMonth()])}</span>
              <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </button>
            <div class="calendar-month-options" data-calendar-month-options role="listbox" aria-label="Birth month" hidden>
              ${monthOptions}
            </div>
          </div>
          <div class="calendar-year-menu" data-calendar-year-menu>
            <button type="button" class="calendar-year-trigger" data-calendar-year-trigger aria-label="Choose birth year" aria-haspopup="listbox" aria-expanded="false">
              <span>${viewDate.getFullYear()}</span>
              <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </button>
            <div class="calendar-year-options" data-calendar-year-options role="listbox" aria-label="Birth year" hidden>
              ${yearOptions}
            </div>
          </div>
        </div>
        <div class="calendar-nav">
          <button type="button" data-calendar-action="prev" aria-label="Previous month"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button>
          <button type="button" data-calendar-action="next" aria-label="Next month"${isCurrentMonthView() ? " disabled aria-disabled=\"true\"" : ""}><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
        </div>
      </div>
      <div class="calendar-weekdays">${weekdays.map((day) => `<span>${day}</span>`).join("")}</div>
      <div class="calendar-days">${days}</div>
      <div class="calendar-foot">
        <button type="button" data-calendar-action="clear">Clear</button>
        <button type="button" data-calendar-action="confirm">Confirm</button>
      </div>
    `;
  };

  fieldWrap?.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".birthdate-calendar") || event.target.closest(".date-picker-button")) {
      event.stopPropagation();
    }
  });

  birthdateField.addEventListener("click", openPicker);
  birthdateField.addEventListener("focus", () => {
    if (selectionFocusGuard.shouldOpenOnFocus()) openPicker();
  });
  birthdateField.addEventListener("input", () => {
    validateBirthdateField();
    syncBirthdateAge();
  });
  birthdatePickerBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (picker.hidden) openPicker();
    else closePicker();
  });

  picker.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const monthTrigger = event.target.closest("[data-calendar-month-trigger]");
    if (monthTrigger) {
      const monthMenu = picker.querySelector("[data-calendar-month-options]");
      if (monthMenu?.hidden) openMonthMenu();
      else closeMonthMenu({ restoreFocus: true });
      return;
    }

    const monthOption = event.target.closest("[data-calendar-month-option]");
    if (monthOption) {
      if (monthOption.disabled) return;
      const month = Number(monthOption.dataset.calendarMonthOption);
      if (Number.isInteger(month)) {
        viewDate = clampToToday(new Date(viewDate.getFullYear(), month, 1));
        renderPicker();
      }
      return;
    }

    const yearTrigger = event.target.closest("[data-calendar-year-trigger]");
    if (yearTrigger) {
      const yearMenu = picker.querySelector("[data-calendar-year-options]");
      if (yearMenu?.hidden) openYearMenu();
      else closeYearMenu({ restoreFocus: true });
      return;
    }

    const yearOption = event.target.closest("[data-calendar-year-option]");
    if (yearOption) {
      const year = Number(yearOption.dataset.calendarYearOption);
      if (Number.isInteger(year)) {
        viewDate = clampToToday(new Date(year, viewDate.getMonth(), 1));
        renderPicker();
      }
      return;
    }

    const dayButton = event.target.closest("[data-date]");
    if (dayButton) {
      const selectedDate = parseDateValue(dayButton.dataset.date);
      if (selectedDate) chooseDate(selectedDate);
      return;
    }

    const action = event.target.closest("[data-calendar-action]")?.dataset.calendarAction;
    if (action === "prev") {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
      renderPicker();
    } else if (action === "next") {
      if (isCurrentMonthView()) return;
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
      viewDate = clampToToday(viewDate);
      renderPicker();
    } else if (action === "clear") {
      birthdateField.value = "";
      birthdateField.dispatchEvent(new Event("change", { bubbles: true }));
      closePicker();
    } else if (action === "confirm") {
      closePicker();
    }
  });

  picker.addEventListener("keydown", (event) => {
    const monthTrigger = event.target.closest("[data-calendar-month-trigger]");
    if (monthTrigger && event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      openMonthMenu();
      return;
    }

    const monthOption = event.target.closest("[data-calendar-month-option]");
    if (monthOption) {
      const options = [...picker.querySelectorAll("[data-calendar-month-option]:not(:disabled)")];
      const currentIndex = options.indexOf(monthOption);
      let nextIndex = currentIndex;
      if (event.key === "ArrowDown") nextIndex = Math.min(currentIndex + 1, options.length - 1);
      else if (event.key === "ArrowUp") nextIndex = Math.max(currentIndex - 1, 0);
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = options.length - 1;
      else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMonthMenu({ restoreFocus: true });
        return;
      } else return;

      event.preventDefault();
      options[nextIndex]?.focus();
      return;
    }

    const yearTrigger = event.target.closest("[data-calendar-year-trigger]");
    if (yearTrigger && event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      openYearMenu();
      return;
    }

    const yearOption = event.target.closest("[data-calendar-year-option]");
    if (!yearOption) return;
    const options = [...picker.querySelectorAll("[data-calendar-year-option]")];
    const currentIndex = options.indexOf(yearOption);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = Math.min(currentIndex + 1, options.length - 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(currentIndex - 1, 0);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeYearMenu({ restoreFocus: true });
      return;
    } else return;

    event.preventDefault();
    options[nextIndex]?.focus();
  });

  document.addEventListener("click", (event) => {
    if (!fieldWrap?.contains(event.target)) closePicker();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePicker();
  });
}

function syncAdoptionSelectMenus() {
  adoptionSelectMenus.forEach(({ select, wrapper, button, label }) => {
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

function closeAdoptionSelectMenus(exceptWrapper = null) {
  adoptionSelectMenus.forEach(({ wrapper, button, menu }) => {
    if (wrapper === exceptWrapper) return;
    wrapper.classList.remove("is-open", "opens-up");
    button.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  });
}

function getAdoptionSelectMenu(select) {
  return adoptionSelectMenus.find((menuConfig) => menuConfig.select === select);
}

function showCustomSelectInvalid(select) {
  const customMenu = getAdoptionSelectMenu(select);
  if (!customMenu) {
    select.reportValidity();
    return;
  }

  const { wrapper, button, menu } = customMenu;
  wrapper.classList.add("is-invalid");
  closeAdoptionSelectMenus(wrapper);
  wrapper.classList.add("is-open");
  button.setAttribute("aria-expanded", "true");
  menu.hidden = false;
  positionAdoptionSelectMenu(wrapper, menu);
  button.focus();
}

function positionAdoptionSelectMenu(wrapper, menu) {
  wrapper.classList.remove("opens-up");
  menu.style.removeProperty("bottom");
}

function setupAdoptionSelectMenus() {
  if (!adoptionForm) return;

  adoptionForm.querySelectorAll(".form-group select").forEach((select) => {
    if (select.dataset.customSelectReady === "true") return;
    select.dataset.customSelectReady = "true";
    select.classList.add("native-adoption-select");

    const wrapper = document.createElement("div");
    wrapper.className = "adoption-select-menu";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "adoption-select-trigger";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");

    const label = document.createElement("span");
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-chevron-down";
    icon.setAttribute("aria-hidden", "true");
    button.append(label, icon);

    const menu = document.createElement("div");
    menu.className = "adoption-select-options";
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
        closeAdoptionSelectMenus();
        button.focus();
      });
      menu.appendChild(optionButton);
    });

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (select.disabled) return;
      const willOpen = !wrapper.classList.contains("is-open");
      closeAdoptionSelectMenus(wrapper);
      wrapper.classList.toggle("is-open", willOpen);
      button.setAttribute("aria-expanded", String(willOpen));
      menu.hidden = !willOpen;
      if (willOpen) positionAdoptionSelectMenu(wrapper, menu);
    });

    select.addEventListener("change", () => {
      wrapper.classList.remove("is-invalid");
      syncAdoptionSelectMenus();
    });
    select.after(wrapper);
    wrapper.append(button, menu);
    adoptionSelectMenus.push({ select, wrapper, button, label, menu });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".adoption-select-menu")) closeAdoptionSelectMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAdoptionSelectMenus();
  });

  syncAdoptionSelectMenus();
}

function setupNumericContactField() {
  const contactNumber = getField("contactNumber");
  if (!contactNumber) return;

  const sanitizeContactNumber = () => {
    const digitsOnly = contactNumber.value.replace(/\D/g, "").slice(0, 11);
    if (contactNumber.value !== digitsOnly) {
      contactNumber.value = digitsOnly;
    }
  };

  contactNumber.addEventListener("input", sanitizeContactNumber);
  contactNumber.addEventListener("paste", () => {
    window.setTimeout(sanitizeContactNumber, 0);
  });
}

function generateLocalApplicationReference() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `APP-${date}-${suffix}`;
}

function prefillApplicantFromAccount() {
  const session = getUserSession() || {};
  const fullName = session.fullName || "";
  const fullNameField = getField("fullName");
  if (fullNameField) {
    fullNameField.value = fullName;
    fullNameField.readOnly = true;
    fullNameField.classList.add("readonly-account-field");
  }
  if (!getValue("applicantAccountId")) {
    getField("applicantAccountId").value = session.email || "";
  }
}

function syncIssuedDateFields() {
  const now = new Date();
  if (getField("issuedDay")) getField("issuedDay").value = String(now.getDate());
  if (getField("issuedMonth")) getField("issuedMonth").value = now.toLocaleString("en-US", { month: "long" });
  if (getField("issuedYear")) getField("issuedYear").value = String(now.getFullYear());
  if (getField("submissionTimestamp")) getField("submissionTimestamp").value = now.toISOString();
  if (getField("applicationReference") && !getValue("applicationReference")) {
    getField("applicationReference").value = generateLocalApplicationReference();
  }
}

function findPetById(petId) {
  const normalizedId = String(petId || "").trim();
  if (!normalizedId) return null;
  return pets.find((pet) => String(pet.id || pet.petId || "").trim() === normalizedId) || null;
}

function syncSelectedPetFields(pet) {
  if (!pet) return;
  currentPetForAdoption = pet;
  if (petIdField) petIdField.value = pet.id || pet.petId || "";
  if (petNameField) petNameField.value = pet.name || "";
}

function getSelectedPetForAdoption() {
  if (currentPetForAdoption?.id || currentPetForAdoption?.petId) return currentPetForAdoption;

  const selectedPet = findPetById(getValue("petIdField"));
  if (selectedPet) {
    currentPetForAdoption = selectedPet;
    return selectedPet;
  }

  return null;
}

function setGroupStep(id, step) {
  const field = getField(id);
  const group = field?.closest(".form-group");
  if (group) {
    group.dataset.adoptionFieldStep = String(step);
  }
}

function initializeAdoptionWizardFields() {
  Object.entries(adoptionStepFields).forEach(([step, ids]) => {
    ids.forEach((id) => setGroupStep(id, step));
  });
  document.querySelector(".pledge-box")?.setAttribute("data-adoption-field-step", "4");
  document.querySelector(".adoption-checkboxes")?.setAttribute("data-adoption-field-step", "4");
  document.querySelector(".adoption-bottom-grid")?.setAttribute("data-adoption-field-step", "4");
}

function updateConditionalAdoptionFields() {
  const hasPets = getValue("hasCurrentPets") === "Yes";
  const petCountValue = getValue("numberOfPets");
  const petCount = Number(petCountValue);
  const hasPetCount = hasPets && petCountValue !== "" && Number.isFinite(petCount) && petCount > 0;
  const visitsVet = getValue("visitVeterinarian") === "Yes";
  const doesNotVisitVet = getValue("visitVeterinarian") === "No";

  [
    ["numberPetsGroup", "numberOfPets", hasPets],
    ["currentPetTypeGroup", "currentPetType", hasPetCount],
    ["vetClinicGroup", "vetClinicName", hasPetCount && visitsVet]
  ].forEach(([groupId, fieldId, show]) => {
    const group = getField(groupId);
    const field = getField(fieldId);
    if (!group || !field) return;
    const isCurrentStep = Number(group.dataset.adoptionFieldStep) === currentAdoptionStep;
    const shouldShow = show && isCurrentStep;
    group.hidden = !shouldShow;
    group.classList.toggle("adoption-step-hidden", !shouldShow);
    field.disabled = !shouldShow;
    field.required = shouldShow;
    if (isCurrentStep && !show && groupId !== "vetClinicGroup") field.value = "";
  });

  const vetClinicName = getField("vetClinicName");
  if (vetClinicName && doesNotVisitVet) {
    vetClinicName.value = "None";
  }

  const existingPets = getField("existingPets");
  if (existingPets) {
    existingPets.value = hasPetCount
      ? `${getValue("numberOfPets") || "Not specified"} ${getValue("currentPetType") || "pet(s)"}`
      : "No current pets";
  }

  syncAdoptionSelectMenus();
}

function uploadPayload(fileData) {
  if (!fileData) return null;
  return {
    name: fileData.name,
    type: fileData.type,
    size: fileData.size
  };
}

function setAdoptionStep(step) {
  currentAdoptionStep = Math.max(1, Math.min(4, Number(step) || 1));
  adoptionForm?.classList.toggle("adoption-step-3-active", currentAdoptionStep === 3);
  document.querySelectorAll("[data-adoption-field-step]").forEach((group) => {
    const isActive = Number(group.dataset.adoptionFieldStep) === currentAdoptionStep;
    group.classList.toggle("adoption-step-hidden", !isActive);
    group.querySelectorAll("input, select, textarea").forEach((field) => {
      field.disabled = !isActive;
    });
  });

  document.getElementById("selectedPetBox")?.classList.toggle("adoption-step-hidden", currentAdoptionStep !== 1);
  document.querySelector(".adoption-notice-field")?.classList.toggle("adoption-step-hidden", currentAdoptionStep !== 3);
  document.querySelector(".adoption-review-field")?.classList.toggle("adoption-step-hidden", currentAdoptionStep !== 4);

  adoptionStepButtons.forEach((button) => {
    const itemStep = Number(button.dataset.adoptionStepTarget);
    button.classList.toggle("active", itemStep === currentAdoptionStep);
    button.classList.toggle("complete", itemStep < currentAdoptionStep);
  });

  if (adoptionBackBtn) adoptionBackBtn.hidden = currentAdoptionStep === 1 || currentAdoptionStep === 4;
  if (adoptionNextBtn) adoptionNextBtn.hidden = currentAdoptionStep === 4;
  if (adoptionSubmitBtn) adoptionSubmitBtn.hidden = currentAdoptionStep !== 4;
  if (adoptionSectionTitle) {
    const [icon, title] = adoptionStepTitles[currentAdoptionStep] || adoptionStepTitles[1];
    adoptionSectionTitle.innerHTML = `<span><i class="fa-solid ${icon}" aria-hidden="true"></i></span><h3>${escapeHtml(title)}</h3>`;
  }
  updateConditionalAdoptionFields();
  syncAdoptionSelectMenus();
  if (currentAdoptionStep === 4) renderAdoptionReview();
  syncAdoptionSubmitState();
}

function closeAdoptionModalWithoutPrompt() {
  if (!adoptModal) return;
  adoptModal.classList.remove("show");
  adoptionExitConfirm?.setAttribute("hidden", "");
  clearPendingAdoptionSelection();
  if (!profileModal || !profileModal.classList.contains("show")) {
    document.body.classList.remove("menu-open", "modal-open");
  }
}

function showAdoptionSubmissionSuccess(referenceNumber) {
  closeAdoptionModalWithoutPrompt();

  return Swal.fire({
    icon: "success",
    title: "Application Submitted",
    html: `
      <p>Your adoption application has been received for shelter review.</p>
      <div class="adoption-success-reference">
        <span>Reference number</span>
        <strong>${escapeHtml(referenceNumber || "Not available")}</strong>
      </div>
    `,
    confirmButtonText: "Done",
    showConfirmButton: true,
    showCancelButton: false,
    showCloseButton: true,
    customClass: {
      popup: "animua-popup animua-auth-feedback-popup adoption-submission-success-popup",
      icon: "animua-auth-feedback-icon",
      closeButton: "animua-feedback-close",
      confirmButton: "animua-confirm"
    },
    buttonsStyling: false
  });
}

function showAdoptionExitConfirm() {
  if (!adoptModal?.classList.contains("show")) return;
  adoptionExitConfirm?.removeAttribute("hidden");
}

function validateAdoptionStep(step = currentAdoptionStep) {
  updateConditionalAdoptionFields();
  if (step === 1 && !validateBirthdateField()) {
    birthdateField?.reportValidity();
    return false;
  }
  if (step === 4) {
    const uncheckedDeclaration = adoptionDeclarationCheckboxes.find((checkbox) => !checkbox.checked);
    if (uncheckedDeclaration) {
      uncheckedDeclaration.reportValidity();
      return false;
    }
  }
  const fields = adoptionStepFields[step]
    .map((id) => getField(id))
    .filter((field) => field && !field.disabled && !field.closest("[hidden]"));
  const invalid = fields.find((field) => !field.checkValidity());
  if (invalid) {
    if (invalid.matches("select.native-adoption-select")) {
      showCustomSelectInvalid(invalid);
      return false;
    }
    invalid.reportValidity();
    return false;
  }
  return true;
}

function areAdoptionDeclarationsChecked() {
  return adoptionDeclarationCheckboxes.length === 3 &&
    adoptionDeclarationCheckboxes.every((checkbox) => checkbox.checked);
}

function syncAdoptionSubmitState() {
  if (!adoptionSubmitBtn) return;
  adoptionSubmitBtn.disabled = currentAdoptionStep === 4 && !areAdoptionDeclarationsChecked();
}

function renderAdoptionReview() {
  if (!adoptionReviewSummary) return;
  const petTypeLabel = currentPetForAdoption?.type === "dog" ? "Dog" : currentPetForAdoption?.type === "cat" ? "Cat" : "Pet";
  const sections = [
    ["Selected pet", [
      ["Name", currentPetForAdoption?.name],
      ["Details", `${currentPetForAdoption?.age || ""} ${currentPetForAdoption?.sex || ""} ${petTypeLabel}`.trim()],
      ["Status", currentPetForAdoption?.status || "Ready"]
    ]],
    ["Applicant information", [
      ["Full name", getValue("fullName")],
      ["Birthdate", getValue("birthdate")],
      ["Age", getValue("age")],
      ["Address", getValue("address")],
      ["Civil status", getValue("civilStatus")],
      ["Gender", getValue("gender")],
      ["Citizenship", getValue("citizenship")],
      ["Contact", getValue("contactNumber")],
      ["Occupation", getValue("occupation")]
    ]],
    ["Household information", [
      ["Spouse", getValue("spouseName") || "Not provided"],
      ["Children", getValue("childrenNames") || "Not provided"],
      ["Current pets", getValue("hasCurrentPets")],
      ["Number/type", getValue("hasCurrentPets") === "Yes" ? `${getValue("numberOfPets")} ${getValue("currentPetType")}` : "Not applicable"],
      ["Veterinarian", getValue("visitVeterinarian")],
      ["Clinic", getValue("vetClinicName") || "Not applicable"],
      ["Housing", getValue("housingType")],
      ["Pets allowed", getValue("residenceAllowsPets")]
    ]],
    ["Adoption-readiness answers", [
      ["Reason", getValue("whyAdopt")],
      ["Caregiver", getValue("primaryCaregiver")],
      ["Pet stays", getValue("petStayLocation")],
      ["Hours alone", getValue("hoursAlone")],
      ["Vet care", getValue("provideVetCare")],
      ["Daily care", getValue("provideDailyCare")],
      ["If unable to care", getValue("cannotCarePlan")],
      ["Additional info", getValue("additionalInfo") || "Not provided"]
    ]]
  ];

  adoptionReviewSummary.innerHTML = sections.map(([title, rows]) => `
    <section>
      <h4>${escapeHtml(title)}</h4>
      <dl>
        ${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "Not provided")}</dd></div>`).join("")}
      </dl>
    </section>
  `).join("");
}

function readUploadFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    const allowedNames = /\.(jpe?g|png|pdf)$/i;
    if (!allowedTypes.includes(file.type) && !allowedNames.test(file.name)) {
      reject(new Error("Please upload a JPG, JPEG, PNG, or PDF file."));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Each ID file must be 5 MB or smaller."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result });
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.readAsDataURL(file);
  });
}

function renderUploadPreview(target, fileData, input) {
  if (!target) return;
  if (!fileData) {
    target.innerHTML = "";
    return;
  }
  const isPdf = fileData.type === "application/pdf" || /\.pdf$/i.test(fileData.name);
  target.innerHTML = `
    <div class="upload-preview-card">
      ${isPdf ? '<span class="upload-pdf-icon"><i class="fa-regular fa-file-pdf"></i></span>' : `<img src="${fileData.dataUrl}" alt="${escapeHtml(fileData.name)} preview">`}
      <div><strong>${escapeHtml(fileData.name)}</strong><small>${Math.ceil(fileData.size / 1024)} KB</small></div>
      <button type="button" data-upload-replace>Replace File</button>
      <button type="button" data-upload-remove>Remove</button>
    </div>
  `;
  target.querySelector("[data-upload-replace]")?.addEventListener("click", () => input?.click());
  target.querySelector("[data-upload-remove]")?.addEventListener("click", () => {
    if (input) input.value = "";
    if (input === idFrontUpload) idFrontFileData = null;
    if (input === idBackUpload) idBackFileData = null;
    renderUploadPreview(target, null, input);
  });
}

async function handleUploadChange(input, preview, side) {
  try {
    const data = await readUploadFile(input.files?.[0]);
    if (side === "front") idFrontFileData = data;
    if (side === "back") idBackFileData = data;
    renderUploadPreview(preview, data, input);
  } catch (error) {
    input.value = "";
    if (side === "front") idFrontFileData = null;
    if (side === "back") idBackFileData = null;
    renderUploadPreview(preview, null, input);
    formMessage.textContent = error.message;
    formMessage.style.color = "red";
  }
}

function formatAlteredStatus(status, sex) {
  const value = String(status || "").trim();
  const normalized = value.toLowerCase();
  if (!value || normalized === "unknown") return null;
  if (["yes", "altered", "done"].includes(normalized)) {
    if (String(sex).toLowerCase() === "female") return "Spayed";
    if (String(sex).toLowerCase() === "male") return "Neutered";
    return "Spayed / neutered";
  }
  if (["no", "not altered", "intact"].includes(normalized)) return "Not yet spayed / neutered";
  return value;
}

function formatVaccinationStatus(status) {
  const value = String(status || "").trim();
  const normalized = value.toLowerCase();
  if (!value || normalized === "unknown") return null;
  if (["yes", "vaccinated", "complete", "completed", "up to date"].includes(normalized)) {
    return "Vaccinated";
  }
  if (["no", "not vaccinated"].includes(normalized)) return "Vaccination pending";
  return value;
}

function behaviorLabels(assessment) {
  if (!assessment || typeof assessment !== "object") return [];
  const labels = [];
  if (Number(assessment.friendlinessToHumans) >= 4) labels.push("People-friendly");
  if (Number(assessment.goodWithKids) >= 4) labels.push("Good with children");
  if (Number(assessment.goodWithOtherPets) >= 4) labels.push("Good with pets");
  if (Number(assessment.energyLevel) >= 4) labels.push("High energy");
  else if (Number(assessment.energyLevel) > 0 && Number(assessment.energyLevel) <= 2) labels.push("Calm");
  return labels;
}

function fallbackImageForPet(type) {
  return type === "cat" ? catFallbackImage : dogFallbackImage;
}

function dateValue(value) {
  if (!value) return 0;
  if (value.seconds) return value.seconds * 1000;
  if (value._seconds) return value._seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function mapPetFromBackend(pet) {
  const rawSpecies = (pet.species || "").toLowerCase();
  const type =
  rawSpecies === "dog" || rawSpecies === "canine" ? "dog" :
  rawSpecies === "cat" || rawSpecies === "feline" ? "cat" :
  "other";

  return {
    id: pet.id,
    name:
      pet.displayLabel ||
      pet.shelterLabel ||
      pet.identifyingDescription ||
      `Animal ${pet.id}`,
    type,
    species: pet.species || (type === "dog" ? "Dog" : type === "cat" ? "Cat" : "Other"),
    breed: textOr(pet.breed, "Mixed / not recorded"),
    age: formatAgeLabel(pet.ageEstimate || pet.age),
    sex: pet.sex || "Unknown",
    color: textOr(pet.colorMarkings || pet.color),
    status: pet.status || "Ready for Adoption",
    size: pet.size || pet.weight,
    sortDate:
      dateValue(pet.readyForAdoptionAt) ||
      dateValue(pet.updatedAt) ||
      dateValue(pet.createdAt) ||
      dateValue(pet.intakeDate),
    traits: [
      formatAlteredStatus(pet.alteredStatus, pet.sex),
      formatVaccinationStatus(pet.vaccinated),
      pet.visibleDefects
        ? "Special care needs"
        : null,
      ...behaviorLabels(pet.behavioralAssessment),
    ].filter(Boolean),
    description:
      textOr(pet.publicDescription, "") ||
      [
        pet.conditionNotes,
        pet.visibleDefects
          ? `Special care note: ${pet.visibleDefects}`
          : "",
      ].filter(Boolean).join(" ") ||
      pet.initialCondition ||
      "",
    match: "Best for adopters ready to provide a safe, caring, and responsible home.",
    image:
    pet.photoURL ||
    (type === "dog"
      ? "https://loremflickr.com/500/360/dog?lock=1001"
      : type === "cat"
      ? "https://loremflickr.com/500/360/cat?lock=1002"
      : "https://loremflickr.com/500/360/animal?lock=1003"),
  };
}


async function loadPublicPets() {
  try {
    const res = await fetch(`${API_BASE_URL}/public/pets`, { cache: "no-store" });

    if (!res.ok) {
      throw new Error("Failed to load public pets");
    }

    const data = await res.json();
    const rawPets = Array.isArray(data) ? data : (data.pets || []);
    pets = rawPets.map((pet, index) => ({
      ...mapPetFromBackend(pet),
      sortIndex: index
    }));

    applyFilters();
    openSelectedPetFromResults();
  } catch (error) {
    console.error("Public pets load error:", error);
    resultsCount.textContent = "0 pets found";
    emptyState.classList.add("show");
  }
}

let pets = [];

function renderPets(list) {
  if (!petsGrid || !resultsCount || !emptyState) {
    return;
  }

  petsGrid.innerHTML = "";

  if (!list.length) {
    emptyState.classList.add("show");
    resultsCount.textContent = "0 pets found";
    if (heroPetCount) heroPetCount.textContent = "0";
    return;
  }

  emptyState.classList.remove("show");
  resultsCount.textContent = `${list.length} pet${list.length > 1 ? "s" : ""} found`;
  if (heroPetCount) heroPetCount.textContent = String(list.length);

  list.forEach((pet, index) => {
    const card = document.createElement("div");
    card.className = "pet-card reveal";
    const petType = pet.type === "dog" ? "Dog" : pet.type === "cat" ? "Cat" : "Pet";
    const temperamentText = pet.traits && pet.traits.length
      ? pet.traits.slice(0, 2).join(", ")
      : "Gentle";
    const facts = [
      ["fa-paw", "Breed", pet.breed],
      ["fa-palette", "Color / Markings", pet.color],
    ];
    card.innerHTML = `
      <div class="pet-card-image">
        <img src="${escapeHtml(pet.image)}" alt="${escapeHtml(pet.name)}" data-fallback-src="${escapeHtml(fallbackImageForPet(pet.type))}" width="720" height="540" loading="lazy" decoding="async">
        <span class="pet-badge">${petType}</span>
        <span class="pet-ready-badge"><i class="fa-solid fa-circle" aria-hidden="true"></i> Ready</span>
      </div>
      <div class="pet-card-body">
        <div class="pet-card-top">
          <div>
            <h3>${escapeHtml(pet.name)}</h3>
            <p class="pet-meta">${escapeHtml(pet.age)} <span>•</span> ${escapeHtml(pet.sex)}</p>
          </div>
        </div>
        <div class="pet-facts">
          ${facts.map(([icon, label, value]) => `
            <div class="pet-fact">
              <i class="fa-solid ${icon}" aria-hidden="true"></i>
              <span><small>${label}</small><strong>${escapeHtml(value)}</strong></span>
            </div>
          `).join("")}
        </div>
        <div class="pet-temperament">
          <span class="pet-temperament-icon"><i class="fa-solid fa-heart" aria-hidden="true"></i></span>
          <span><small>Temperament</small><strong>${escapeHtml(temperamentText)}</strong></span>
        </div>
        <div class="pet-actions">
          <button class="btn secondary-btn view-profile-btn" data-id="${escapeHtml(pet.id)}">View Profile</button>
          <button class="btn primary-btn adopt-btn" data-id="${escapeHtml(pet.id)}"><i class="fa-solid fa-paw" aria-hidden="true"></i> Adopt</button>
        </div>
      </div>
    `;

    const meta = card.querySelector(".pet-meta");
    if (meta) {
      const sexText = String(pet.sex || "Unknown").toLowerCase();
      const sexIcon = String(sexText).toLowerCase().startsWith("f")
        ? "fa-venus"
        : String(sexText).toLowerCase().startsWith("m")
          ? "fa-mars"
          : "fa-venus-mars";
      const sizeLabel = String(pet.size || pet.weight || "Medium").toLowerCase();
      meta.innerHTML = `
        <strong class="pet-meta-item pet-meta-sex">
          <i class="fa-solid ${sexIcon}" aria-hidden="true"></i>
          ${escapeHtml(sexText)}
        </strong>
        <b class="pet-meta-dot" aria-hidden="true">&bull;</b>
        <strong class="pet-meta-item pet-meta-age">${escapeHtml(pet.age)}</strong>
        <b class="pet-meta-dot" aria-hidden="true">&bull;</b>
        <strong class="pet-meta-item pet-meta-size">${escapeHtml(sizeLabel)}</strong>
      `;
    }

    const temperament = card.querySelector(".pet-temperament");
    if (temperament) {
      const traitChips = (pet.traits && pet.traits.length ? pet.traits : ["Friendly"]).slice(0, 3);
      temperament.classList.toggle("trait-count-3", traitChips.length === 3);
      temperament.innerHTML = traitChips
        .map((trait) => `<span>${escapeHtml(trait)}</span>`)
        .join("");
    }

    petsGrid.appendChild(card);

    const img = card.querySelector('.pet-card-image img');
    img.addEventListener('error', function() {
      if (this.src !== this.dataset.fallbackSrc) {
        this.src = this.dataset.fallbackSrc;
      }
    });
    img.addEventListener('load', function() {
      this.style.objectPosition = this.naturalHeight > this.naturalWidth
        ? 'center center'
        : 'center 42%';
    });

    setTimeout(() => {
      card.classList.add("show");
    }, index * 20);
  });

  attachCardEvents();
}

function attachCardEvents() {
  document.querySelectorAll(".view-profile-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const pet = pets.find((item) => item.id === button.dataset.id);
      if (pet) {
        openProfileModal(pet);
      }
    });
  });

  document.querySelectorAll(".adopt-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const pet = pets.find((item) => item.id === button.dataset.id);
      if (pet) {
        openAdoptModal(pet);
      }
    });
  });
}

function applyFilters() {
  if (!petSearch) {
    renderPets(pets);
    return;
  }

  const searchValue = petSearch.value.trim().toLowerCase();

  const filtered = pets.filter((pet) => {
    const matchesFilter = currentFilter === "all" || pet.type === currentFilter;
    const searchableDetails = [
      pet.name,
      pet.id,
      pet.species,
      pet.breed,
      pet.sex,
      pet.age,
      pet.color,
      pet.description,
    ].join(" ").toLowerCase();
    const matchesSearch = searchableDetails.includes(searchValue);
    return matchesFilter && matchesSearch;
  });

  filtered.sort((a, b) => {
    const dateA = a.sortDate || 0;
    const dateB = b.sortDate || 0;
    if (dateA || dateB) {
      return currentSort === "oldest" ? dateA - dateB : dateB - dateA;
    }
    return currentSort === "oldest"
      ? (b.sortIndex ?? 0) - (a.sortIndex ?? 0)
      : (a.sortIndex ?? 0) - (b.sortIndex ?? 0);
  });

  renderPets(filtered);
}

filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    filterTabs.forEach((button) => button.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    applyFilters();
  });
});

if (petSearch) {
  petSearch.addEventListener("input", applyFilters);
}

function closeSortMenu() {
  if (!petSortMenu || !petSort) return;
  petSortMenu.hidden = true;
  petSort.setAttribute("aria-expanded", "false");
}

function openSortMenu() {
  if (!petSortMenu || !petSort) return;
  petSortMenu.hidden = false;
  petSort.setAttribute("aria-expanded", "true");
}

function setSort(value, label) {
  currentSort = value;
  if (petSortLabel) petSortLabel.textContent = label;
  petSortOptions.forEach((option) => {
    const isActive = option.dataset.sortValue === value;
    option.classList.toggle("active", isActive);
    option.setAttribute("aria-selected", String(isActive));
  });
  closeSortMenu();
  applyFilters();
}

if (petSort && petSortMenu) {
  petSort.addEventListener("click", () => {
    if (petSortMenu.hidden) {
      openSortMenu();
    } else {
      closeSortMenu();
    }
  });

  petSortOptions.forEach((option) => {
    option.addEventListener("click", () => {
      setSort(option.dataset.sortValue || "newest", option.textContent.trim());
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".sort-select-wrap")) {
      closeSortMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSortMenu();
    }
  });
}

function openProfileModal(pet) {
  if (!profileModal) {
    return;
  }

  currentPetForAdoption = pet;
  profileImage.src = pet.image;
  profileImage.style.objectPosition = "center center";
  profileImage.alt = pet.name;
 profileType.textContent =
  pet.type === "dog" ? "Dog" :
  pet.type === "cat" ? "Cat" :
  "Pet";
  const petTypeLabel = pet.type === "dog" ? "Dog" : pet.type === "cat" ? "Cat" : "Pet";
  profileName.textContent = pet.name;
  const recordedDescription = String(pet.description || "").trim();
  const ageMatch = String(pet.age || "").trim().match(/^(\d+)\s+(years?|months?)$/i);
  const ageDescription = ageMatch
    ? `${ageMatch[1]}-${ageMatch[2].toLowerCase().replace(/s$/, "")}-old`
    : "";
  const sexDescription = ["male", "female"].includes(String(pet.sex || "").toLowerCase())
    ? String(pet.sex).toLowerCase()
    : "";
  const breedDescription = pet.breed && !String(pet.breed).toLowerCase().includes("not recorded")
    ? String(pet.breed)
    : "";
  const identity = [ageDescription, sexDescription, breedDescription, petTypeLabel.toLowerCase()]
    .filter(Boolean)
    .join(" ");
  const article = /^[aeiou]/i.test(identity) ? "an" : "a";
  const fallbackDescription = `${pet.name} is ${article} ${identity} ready to meet adopters and find a safe, caring home.`;
  profileDescription.textContent =
    recordedDescription && !["good", "fair", "poor", "unknown"].includes(recordedDescription.toLowerCase())
      ? recordedDescription
      : fallbackDescription;
  profileAge.textContent = pet.age;
  profileSex.textContent = pet.sex;
  profileBreed.textContent = pet.breed;
  profileColor.textContent = pet.color;
  profileStatus.textContent = "Ready";
  if (profileHealth) {
    profileHealth.textContent = "Good";
  }
  profileMatch.textContent = pet.match;

  const traitList = pet.traits && pet.traits.length
  ? pet.traits
  : ["Gentle", "Rescue", "Needs a loving home"];

  profileTraits.innerHTML = traitList
    .map((trait) => `<span class="trait-chip">${trait}</span>`)
    .join("");

  profileModal.classList.add("show");
  document.body.classList.add("menu-open");

  const aboutPanel = profileModal.querySelector(".profile-about-card");
  const traitsPanel = profileModal.querySelector(".profile-section-card");
  if (aboutPanel && traitsPanel) {
    aboutPanel.style.removeProperty("height");
    aboutPanel.style.removeProperty("min-height");
    aboutPanel.style.removeProperty("max-height");
    const minimumAboutHeight = Math.ceil(aboutPanel.scrollHeight);

    const alignPanelBottoms = () => {
      if (!window.matchMedia("(min-width: 641px)").matches) {
        aboutPanel.style.removeProperty("height");
        aboutPanel.style.removeProperty("min-height");
        aboutPanel.style.removeProperty("max-height");
        aboutPanel.style.alignSelf = "";
        return;
      }

      const aboutRect = aboutPanel.getBoundingClientRect();
      const traitsRect = traitsPanel.getBoundingClientRect();
      const currentHeight = parseFloat(getComputedStyle(aboutPanel).height) || aboutRect.height;
      const alignedHeight = Math.max(
        minimumAboutHeight,
        Math.round(currentHeight + traitsRect.bottom - aboutRect.bottom)
      );

      aboutPanel.style.setProperty("height", `${alignedHeight}px`, "important");
      aboutPanel.style.setProperty("min-height", `${alignedHeight}px`, "important");
      aboutPanel.style.setProperty("max-height", `${alignedHeight}px`, "important");
      aboutPanel.style.alignSelf = "start";
    };

    requestAnimationFrame(() => {
      alignPanelBottoms();
      requestAnimationFrame(alignPanelBottoms);
    });
  }
}

function openPetPhotoLightbox() {
  if (!petPhotoLightbox || !petPhotoLightboxImage || !profileImage) return;

  petPhotoLightboxImage.src = profileImage.currentSrc || profileImage.src;
  petPhotoLightboxImage.alt = profileImage.alt || "Animal photo";
  if (petPhotoLightboxTitle) {
    petPhotoLightboxTitle.textContent = profileName?.textContent || "Animal photo";
  }

  petPhotoLightbox.classList.remove("hidden");
  petPhotoLightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  petPhotoLightboxPanel?.focus();
}

function closePetPhotoLightbox() {
  if (!petPhotoLightbox) return;

  petPhotoLightbox.classList.add("hidden");
  petPhotoLightbox.setAttribute("aria-hidden", "true");
  petPhotoLightboxImage?.removeAttribute("src");
  profileImageZoomBtn?.focus();

  if (!profileModal?.classList.contains("show") && !adoptModal?.classList.contains("show")) {
    document.body.classList.remove("modal-open");
  }
}

function openSelectedPetFromResults() {
  const selectedPetRecordId = sessionStorage.getItem("animua_selected_pet_id");
  const selectedAction = sessionStorage.getItem("animua_selected_pet_action");
  const selectedSource = sessionStorage.getItem("animua_selected_pet_source");
  const selectedAt = Number(sessionStorage.getItem("animua_selected_pet_timestamp") || 0);

  if (!selectedPetRecordId || !pets.length) return;

  const selectedPet = pets.find((pet) => String(pet.id) === String(selectedPetRecordId));
  if (!selectedPet) return;

  if (selectedAction === "view") {
    openProfileModal(selectedPet);
    clearPendingAdoptionSelection();
    return;
  }

  if (selectedAction === "adopt") {
    const shouldResumeAdoption = sessionStorage.getItem(ADOPTION_RESUME_FLAG) === "true";
    const isRecentAdoptClick =
      selectedSource === ADOPTION_PENDING_SOURCE &&
      selectedAt &&
      Date.now() - selectedAt <= ADOPTION_PENDING_MAX_AGE_MS;

    if (!shouldResumeAdoption || !isRecentAdoptClick) {
      clearPendingAdoptionSelection();
      return;
    }

    if (!hasUserSession()) return;

    showAdoptModalForPet(selectedPet);
    clearPendingAdoptionSelection();
  }
}

function showAdoptModalForPet(pet) {
  if (!adoptModal) return;

  syncSelectedPetFields(pet);
  const petTypeLabel = pet.type === "dog" ? "Dog" : pet.type === "cat" ? "Cat" : "Pet";
  selectedPetName.textContent = pet.name;
  if (selectedPetMeta) {
    selectedPetMeta.textContent = `${pet.age} • ${pet.sex} ${petTypeLabel}`;
  }
  if (selectedPetStatus) {
    selectedPetStatus.textContent = pet.status || "Ready for Adoption";
  }
  if (selectedPetImage) {
    selectedPetImage.src = pet.image;
    selectedPetImage.alt = pet.name;
  }
  prefillApplicantFromAccount();
  syncIssuedDateFields();
  setAdoptionStep(1);
  formMessage.textContent = "";

  adoptModal.classList.add("show");
  document.body.classList.add("modal-open");
}

function openAdoptModal(pet) {
  if (!adoptModal) return;

  currentPetForAdoption = pet;
  sessionStorage.setItem("animua_selected_pet_id", pet.id);
  sessionStorage.setItem("animua_selected_pet_action", "adopt");
  sessionStorage.setItem("animua_selected_pet_source", ADOPTION_PENDING_SOURCE);
  sessionStorage.setItem("animua_selected_pet_timestamp", String(Date.now()));

  if (!hasUserSession()) {
    sessionStorage.setItem(ADOPTION_RESUME_FLAG, "true");

    const authModal = document.getElementById("authModal");
    if (authModal) {
      sessionStorage.removeItem("animua_open_auth_modal");
      authModal.classList.remove("hidden");
      document.body.classList.add("modal-open");
    } else {
      sessionStorage.setItem("animua_open_auth_modal", "true");
      window.location.href = "/pages/public/home.html";
    }
    return;
  }

  showAdoptModalForPet(pet);
}

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    const modalId = button.dataset.close;
    const modal = document.getElementById(modalId);

    if (modal) {
      modal.classList.remove("show");
    }

    if (
      (!profileModal || !profileModal.classList.contains("show")) &&
      (!adoptModal || !adoptModal.classList.contains("show"))
    ) {
      document.body.classList.remove("menu-open", "modal-open");
    }
  });
});

[profileModal, adoptModal].forEach((modal) => {
  if (!modal) {
    return;
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      if (modal === adoptModal) {
        showAdoptionExitConfirm();
        return;
      }
      modal.classList.remove("show");

      if (
        (!profileModal || !profileModal.classList.contains("show")) &&
        (!adoptModal || !adoptModal.classList.contains("show"))
      ) {
        document.body.classList.remove("menu-open", "modal-open");
      }
    }
  });
});

profileImageZoomBtn?.addEventListener("click", openPetPhotoLightbox);
petPhotoLightboxClose?.addEventListener("click", closePetPhotoLightbox);
petPhotoLightbox?.addEventListener("click", (event) => {
  if (event.target === petPhotoLightbox) {
    closePetPhotoLightbox();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && petPhotoLightbox && !petPhotoLightbox.classList.contains("hidden")) {
    closePetPhotoLightbox();
  }
});

adoptionExitBtn?.addEventListener("click", closeAdoptionModalWithoutPrompt);
adoptionExitCancel?.addEventListener("click", () => {
  adoptionExitConfirm?.setAttribute("hidden", "");
});
adoptionExitConfirmBtn?.addEventListener("click", closeAdoptionModalWithoutPrompt);
adoptionExitConfirm?.addEventListener("click", (event) => {
  if (event.target === adoptionExitConfirm) {
    adoptionExitConfirm.setAttribute("hidden", "");
  }
});

if (adoptionForm) {
  initializeAdoptionWizardFields();
  setupAdoptionSelectMenus();
  setupNumericContactField();
  setAdoptionStep(1);

  adoptionStepButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const requestedStep = Number(button.dataset.adoptionStepTarget);
      if (requestedStep <= currentAdoptionStep || validateAdoptionStep(currentAdoptionStep)) {
        setAdoptionStep(requestedStep);
      }
    });
  });

  adoptionNextBtn?.addEventListener("click", () => {
    if (!validateAdoptionStep(currentAdoptionStep)) return;
    setAdoptionStep(currentAdoptionStep + 1);
  });

  adoptionBackBtn?.addEventListener("click", () => {
    setAdoptionStep(currentAdoptionStep - 1);
  });

  setupBirthdatePicker();
  birthdateField?.addEventListener("change", () => {
    validateBirthdateField();
    syncBirthdateAge();
  });

  ["hasCurrentPets", "numberOfPets", "currentPetType", "visitVeterinarian"].forEach((id) => {
    getField(id)?.addEventListener("change", updateConditionalAdoptionFields);
    getField(id)?.addEventListener("input", updateConditionalAdoptionFields);
  });

  idFrontUpload?.addEventListener("change", () => handleUploadChange(idFrontUpload, idFrontPreview, "front"));
  idBackUpload?.addEventListener("change", () => handleUploadChange(idBackUpload, idBackPreview, "back"));

  document.querySelectorAll(".adoption-checkboxes label").forEach((label) => {
    label.addEventListener("click", (event) => {
      const checkbox = label.querySelector('input[type="checkbox"]');
      if (!checkbox || checkbox.disabled) return;
      event.preventDefault();
      checkbox.checked = !checkbox.checked;
      checkbox.setAttribute("aria-checked", String(checkbox.checked));
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  adoptionDeclarationCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", syncAdoptionSubmitState);
  });
}

async function submitAdoptionApplication(formData) {
  const res = await fetch(`${API_BASE_URL}/adoptions`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(formData)
  });

  const result = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(result.message || "Failed to submit adoption request");
    error.status = res.status;
    throw error;
  }

  return result;
}

async function syncQueuedAdoptionApplications() {
  if (isSyncingQueuedAdoptions || !navigator.onLine) return;
  isSyncingQueuedAdoptions = true;

  try {
    const queued = await getQueuedPublicRequests("adoptionApplication");
    for (const item of queued) {
      try {
        await submitAdoptionApplication(item.payload.formData);
        await deleteQueuedPublicRequest(item.id);
      } catch (error) {
        await markQueuedPublicRequestAttempt(item.id, error);
        if (isNetworkError(error)) break;
      }
    }
  } catch (error) {
    console.error("Failed to sync queued adoption applications:", error);
  } finally {
    isSyncingQueuedAdoptions = false;
  }
}

window.addEventListener("online", syncQueuedAdoptionApplications);
syncQueuedAdoptionApplications();

if (adoptionForm) {
  adoptionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selectedPet = getSelectedPetForAdoption();

    const selectedPetRecordId = selectedPet?.id || selectedPet?.petId || "";

    if (!selectedPetRecordId) {
      formMessage.textContent = "No pet selected for adoption.";
      formMessage.style.color = "red";
      return;
    }

    if (currentAdoptionStep !== 4) {
      setAdoptionStep(4);
      return;
    }

    if (!validateAdoptionStep(4)) {
      return;
    }

    let formData = null;

    try {
      updateConditionalAdoptionFields();
      syncIssuedDateFields();
      const issuedAt = new Date();
      const quizData = JSON.parse(sessionStorage.getItem("animua_quiz_data") || "{}");
      const matchResults = JSON.parse(sessionStorage.getItem("animua_match_results") || "[]");

      const selectedMatch = matchResults.find(
        (pet) => String(pet.id || pet.petId) === String(selectedPetRecordId)
      );

      const compatibilityData = selectedMatch
        ? {
            source: "quiz",
            matchPercent: selectedMatch.matchPercent || null,
            preferences: quizData.preferences || {},
            filters: quizData.filters || {},
            matchedAt: new Date().toISOString()
          }
        : null;

      formData = {
        pet_id: selectedPetRecordId,
        pet_name: selectedPet.name,
        pet_age: selectedPet.age || "",
        pet_sex: selectedPet.sex || "",
        pet_type: selectedPet.type || "",
        pet_status: selectedPet.status || "",
        application_reference: getValue("applicationReference"),
        submission_timestamp: getValue("submissionTimestamp"),
        applicant_account_id: getValue("applicantAccountId"),
        compatibility: compatibilityData,

        full_name: getValue("fullName"),
        age: getValue("age"),
        birthdate: getValue("birthdate"),
        address: getValue("address"),
        civil_status: getValue("civilStatus"),
        gender: getValue("gender"),
        citizenship: getValue("citizenship"),
        contact_number: getValue("contactNumber"),
        occupation: getValue("occupation"),
        spouse_name: getValue("spouseName"),
        children_names: getValue("childrenNames"),
        has_current_pets: getValue("hasCurrentPets"),
        number_of_pets: getValue("numberOfPets"),
        current_pet_type: getValue("currentPetType"),
        housing_type: getValue("housingType"),
        residence_allows_pets: getValue("residenceAllowsPets"),
        why_adopt: getValue("whyAdopt"),
        visit_veterinarian: getValue("visitVeterinarian"),
        vet_clinic_name: getValue("vetClinicName"),
        existing_pets: getValue("existingPets"),
        primary_caregiver: getValue("primaryCaregiver"),
        pet_stay_location: getValue("petStayLocation"),
        hours_alone: getValue("hoursAlone"),
        provide_vet_care: getValue("provideVetCare"),
        provide_daily_care: getValue("provideDailyCare"),
        cannot_care_plan: getValue("cannotCarePlan"),
        additional_info: getValue("additionalInfo"),
        id_front_upload: uploadPayload(idFrontFileData),
        id_back_upload: uploadPayload(idBackFileData),
        confirm_truthful: getField("confirmTruthful")?.checked || false,
        agree_declaration: getField("agreeDeclaration")?.checked || false,
        understand_no_guarantee: getField("understandNoGuarantee")?.checked || false,
        issued_day: String(issuedAt.getDate()),
        issued_month: issuedAt.toLocaleString("en-US", { month: "long" }),
        issued_year: String(issuedAt.getFullYear()),
        signature_name: getValue("fullName"),
      };

      const result = await submitAdoptionApplication(formData);

      const referenceNumber = result.applicationId || formData.application_reference;

      adoptionForm.reset();
      currentPetForAdoption = null;
      selectedPetName.textContent = "";
      if (selectedPetMeta) selectedPetMeta.textContent = "";
      if (selectedPetStatus) selectedPetStatus.textContent = "";
      if (petIdField) petIdField.value = "";
      if (petNameField) petNameField.value = "";
      idFrontFileData = null;
      idBackFileData = null;
      renderUploadPreview(idFrontPreview, null, idFrontUpload);
      renderUploadPreview(idBackPreview, null, idBackUpload);
      setAdoptionStep(1);
      await showAdoptionSubmissionSuccess(referenceNumber);
    } catch (error) {
      console.error("Adoption submit error:", error);
      if (formData && isNetworkError(error)) {
        try {
          await queuePublicRequest("adoptionApplication", { formData });
          formMessage.textContent = `Saved offline. Adoption request ${formData.application_reference || ""} will sync when internet returns.`;
          formMessage.style.color = "green";
          adoptionForm.reset();
          currentPetForAdoption = null;
          selectedPetName.textContent = "";
          if (selectedPetMeta) selectedPetMeta.textContent = "";
          if (selectedPetStatus) selectedPetStatus.textContent = "";
          if (petIdField) petIdField.value = "";
          if (petNameField) petNameField.value = "";
          idFrontFileData = null;
          idBackFileData = null;
          renderUploadPreview(idFrontPreview, null, idFrontUpload);
          renderUploadPreview(idBackPreview, null, idBackUpload);
          setAdoptionStep(1);
          return;
        } catch (storageError) {
          formMessage.textContent = storageError.message || "Offline storage is not available.";
          formMessage.style.color = "red";
          return;
        }
      }
      formMessage.textContent = error.message || "Failed to submit. Please try again.";
      formMessage.style.color = "red";
    }
  });
}

if (profileAdoptBtn) {
  profileAdoptBtn.addEventListener("click", () => {
    if (currentPetForAdoption && profileModal) {
      profileModal.classList.remove("show");
      openAdoptModal(currentPetForAdoption);
    }
  });
}

let petsLoadStarted = false;

function startPetsLoad() {
  if (petsLoadStarted) return;
  petsLoadStarted = true;
  loadPublicPets();
}

function schedulePetsLoad() {
  const shouldLoadNow = new URLSearchParams(window.location.search).has("pet") ||
    localStorage.getItem("animua_selected_pet_id");

  if (shouldLoadNow) {
    startPetsLoad();
    return;
  }

  const browserSection = document.getElementById("browse-pets");
  if ("IntersectionObserver" in window && browserSection) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        startPetsLoad();
      }
    }, { rootMargin: "260px 0px" });
    observer.observe(browserSection);
  }

  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
    window.addEventListener(eventName, startPetsLoad, { once: true, passive: true });
  });

  window.setTimeout(startPetsLoad, 8500);
}

ensureUserSession()
  .catch((error) => console.warn("Unable to restore adoption session:", error.message))
  .finally(schedulePetsLoad);
