import { API_BASE_URL } from "../../utils/api.js";
import {
  mergeSubmissionResults,
  submissionLoadErrorMessage,
} from "./mySubmissionsState.js";

const DOG_IMAGE = new URL("../../assets/images/dog.jpg", import.meta.url).href;
const CAT_IMAGE = new URL("../../assets/images/cat.jpg", import.meta.url).href;
const SURRENDER_IMAGE = new URL("../../assets/images/surrender.jpg", import.meta.url).href;

const submissionsList = document.getElementById("submissionsList");
const filterTabs = document.querySelectorAll(".submission-tab");
const submissionSortControl = document.getElementById("submissionSortControl");
const submissionSortBtn = document.getElementById("submissionSortBtn");
const submissionSortLabel = document.getElementById("submissionSortLabel");
const submissionSortMenu = document.getElementById("submissionSortMenu");
const compatibilityAccount = document.getElementById("compatibilityAccount");
const compatibilityAccountBody = document.getElementById("compatibilityAccountBody");
let swalModulePromise;

async function getSwal() {
  swalModulePromise ||= import("sweetalert2").then((module) => module.default);
  return swalModulePromise;
}

async function loadCompatibilityAccount() {
  if (compatibilityAccount?.classList.contains("hidden")) return;
  if (!compatibilityAccountBody) return;
  const token = getToken();
  if (!token) { compatibilityAccountBody.innerHTML = `<p>Log in to view your saved compatibility result.</p>`; return; }
  try {
    const response = await fetch(`${API_BASE_URL}/match/my-results`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Unable to load compatibility results.");
    const results = data.results || [];
    if (!results.length) { compatibilityAccountBody.innerHTML = `<p>You have not completed the compatibility quiz yet.</p><a href="petCompatibility.html">Take the quiz</a>`; return; }
    const latest = results.find((item) => item.isLatest) || results[0];
    const traitLabels = { energyLevel:"Energy level", exerciseNeeds:"Exercise needs", independenceLevel:"Independence", attentionNeeds:"Attention needs", playfulness:"Playfulness", friendlinessToHumans:"Friendliness", goodWithKids:"Good with kids", goodWithOtherPets:"Good with pets", strangerTolerance:"Stranger tolerance", noiseLevel:"Noise tolerance" };
    const traits = Object.entries(latest.preferences || {}).map(([key, value]) => `<article class="compatibility-trait"><div><strong>${escapeHtml(traitLabels[key] || key)}</strong><span>${escapeHtml(value)}<small>/5</small></span></div><div class="compatibility-trait-track"><i style="width:${Math.max(0, Math.min(100, Number(value) * 20))}%"></i></div></article>`).join("");
    const matches = (latest.matches || []).map((match, index) => { const score = Number(match.compatibilityPercent || 0); return `<li class="${index === 0 ? "is-top-match" : ""}"><span class="compatibility-rank">${index + 1}</span><span class="compatibility-pet-icon"><i class="fa-solid fa-paw"></i></span><div><strong>${escapeHtml(match.animalName || "Shelter animal")}</strong><small>${index === 0 ? "Best match for your profile" : "Saved recommendation"}</small></div><span class="compatibility-score">${score.toFixed(1)}%</span><button class="compatibility-view-pet" type="button" data-saved-animal-id="${escapeHtml(match.animalId || "")}" data-saved-animal-name="${escapeHtml(match.animalName || "Shelter animal")}" data-saved-animal-score="${score.toFixed(1)}"><i class="fa-regular fa-eye"></i><span>Details</span></button></li>`; }).join("");
    const history = results.slice(1).map((item) => `<li>${formatDate(item.completedAt)} <small>${escapeHtml(item.resultId)}</small></li>`).join("");
    compatibilityAccountBody.innerHTML = `<div class="compatibility-dates"><article><span><i class="fa-regular fa-circle-check"></i></span><div><small>Quiz completed</small><strong>${formatDate(latest.completedAt)}</strong></div></article><article><span><i class="fa-regular fa-calendar"></i></span><div><small>Next allowed retake</small><strong>${formatDate(latest.nextRetakeAt)}</strong></div></article></div><div class="compatibility-result-grid"><section><div class="compatibility-section-title"><span>Your profile</span><h3>Compatibility traits</h3></div><div class="compatibility-traits">${traits}</div></section><section><div class="compatibility-section-title"><span>Ranked for you</span><h3>Top recommended animals</h3></div><ol class="compatibility-matches">${matches || "<li>No animals matched the selected filters.</li>"}</ol></section></div>${history ? `<details><summary>Previous result history (${results.length - 1})</summary><ul>${history}</ul></details>` : ""}`;
  } catch (error) { compatibilityAccountBody.innerHTML = `<p>${escapeHtml(error.message)}</p>`; }
}

async function showSavedAnimalDetails(button) {
  const Swal = await getSwal();
  const animalId = button.dataset.savedAnimalId || "";
  const savedName = button.dataset.savedAnimalName || "Shelter animal";
  const savedScore = button.dataset.savedAnimalScore || "0.0";
  let pet = null;
  if (animalId) {
    try {
      const response = await fetch(`${API_BASE_URL}/public/pets/${encodeURIComponent(animalId)}`);
      if (response.ok) pet = (await response.json()).pet || null;
    } catch (error) {
      console.warn("[saved animal details]", error.message);
    }
  }
  const name = pet?.displayLabel || pet?.shelterLabel || pet?.identifyingDescription || savedName;
  const meta = pet ? [pet.species, pet.breed, pet.sex, pet.ageEstimate].filter(Boolean).join(" · ") : "Historical recommendation";
  const notes = pet?.conditionNotes || pet?.initialCondition || (pet ? "Ready to meet adopters and find a safe, caring home." : "This animal is no longer publicly available, but the saved recommendation remains part of your quiz history.");
  const image = pet?.photoURL || (String(pet?.species || "").toLowerCase() === "cat" ? CAT_IMAGE : DOG_IMAGE);
  await Swal.fire({
    html: `<section class="saved-animal-modal"><header><span>Saved recommendation</span><button type="button" data-close-saved-animal aria-label="Close"><i class="fa-solid fa-xmark"></i></button></header><div class="saved-animal-hero"><img src="${escapeHtml(image)}" alt="${escapeHtml(name)}"><div><span class="saved-animal-score">${escapeHtml(savedScore)}% match</span><h2>${escapeHtml(name)}</h2><p>${escapeHtml(meta)}</p>${pet ? `<span class="saved-animal-status"><i class="fa-solid fa-circle-check"></i>${escapeHtml(pet.status || "Ready")}</span>` : `<span class="saved-animal-status unavailable"><i class="fa-solid fa-clock-rotate-left"></i>Historical record</span>`}</div></div><div class="saved-animal-copy"><h3>About this recommendation</h3><p>${escapeHtml(notes)}</p>${pet ? `<dl><div><dt>Color / markings</dt><dd>${escapeHtml(pet.colorMarkings || pet.color || "Not recorded")}</dd></div><div><dt>Vaccination</dt><dd>${escapeHtml(pet.vaccinated || "Unknown")}</dd></div><div><dt>Altered status</dt><dd>${escapeHtml(pet.alteredStatus || "Unknown")}</dd></div></dl>` : ""}</div><footer><button type="button" data-close-saved-animal>Close</button>${pet ? `<a href="find-furbabies.html" data-open-saved-animal>View in Find Furbabies</a>` : ""}</footer></section>`,
    showConfirmButton: false, width: "min(560px, calc(100vw - 28px))", padding: 0, background: "transparent",
    customClass: { popup: "saved-animal-popup" },
    didOpen: (popup) => {
      popup.querySelectorAll("[data-close-saved-animal]").forEach((item) => item.addEventListener("click", () => Swal.close()));
      popup.querySelector("[data-open-saved-animal]")?.addEventListener("click", () => { localStorage.setItem("animua_selected_pet_id", animalId); localStorage.setItem("animua_selected_pet_action", "view"); });
    },
  });
}

compatibilityAccountBody?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-saved-animal-id]");
  if (button) showSavedAnimalDetails(button);
});

let allSubmissions = [];
let submissionsLoadError = "";
let currentFilter = "all";
let currentSort = "newest";
let currentPage = 1;

const SUBMISSIONS_PER_PAGE = 5;

function getToken() {
  return localStorage.getItem("animua_token") || "";
}

function formatDate(value) {
  if (!value) return "Not available";

  const rawDate =
    typeof value === "object" && value.seconds
      ? new Date(value.seconds * 1000)
      : typeof value === "object" && value._seconds
        ? new Date(value._seconds * 1000)
        : new Date(value);

  if (Number.isNaN(rawDate.getTime())) {
    return String(value);
  }

  return rawDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getDateTime(value) {
  if (!value) return 0;

  const rawDate =
    typeof value === "object" && value.seconds
      ? new Date(value.seconds * 1000)
      : typeof value === "object" && value._seconds
        ? new Date(value._seconds * 1000)
        : new Date(value);

  const time = rawDate.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeAge(age) {
  if (!age) return "";
  const text = String(age).trim();
  if (/old$/i.test(text)) return text;
  return text;
}

function cleanStatus(status, type) {
  const value = String(status || "").trim();

  if (!value || value === "Pending") {
    return type === "surrender" ? "Received" : "Under Review";
  }

  if (value === "Converted") return "Converted";
  if (value === "Finalized") return "Finalized";
  if (type === "surrender" && value === "Approved") return "Accepted";

  return value;
}

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("review") || normalized.includes("assessment")) return "review";
  if (normalized.includes("approved") || normalized.includes("accepted")) return "approved";
  if (normalized.includes("converted")) return "converted";
  if (normalized.includes("finalized")) return "finalized";
  if (normalized.includes("received")) return "received";
  if (normalized.includes("reject") || normalized.includes("expired")) return "rejected";
  if (normalized.includes("withdraw")) return "withdrawn";
  return "pending";
}

function iconForStatus(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("approved") || normalized.includes("accepted") || normalized.includes("converted") || normalized.includes("finalized")) {
    return "fa-solid fa-check";
  }

  if (normalized.includes("received")) return "fa-regular fa-envelope";
  if (normalized.includes("assessment")) return "fa-solid fa-magnifying-glass";
  if (normalized.includes("reject")) return "fa-solid fa-xmark";
  if (normalized.includes("expired")) return "fa-regular fa-calendar-xmark";
  if (normalized.includes("withdraw")) return "fa-solid fa-ban";
  return "fa-regular fa-clock";
}

function normalizeAdoption(item) {
  const animal = item.animal || {};
  const species = animal.species || item.species || "";
  const image =
    animal.imageUrl ||
    animal.photoURL ||
    animal.photoUrl ||
    animal.profileImageUrl ||
    item.selected_pet?.imageUrl ||
    item.selected_pet?.photoURL ||
    item.selected_pet?.photoUrl ||
    "";

  return {
    id: item.id || item.applicationId,
    type: "adoption",
    name: item.pet_name || animal.name || "Adoption Application",
    species,
    sex: animal.sex || "",
    age: normalizeAge(animal.age || ""),
    submittedAt: item.submittedAt || item.updatedAt,
    reference: item.applicationId || item.id || "ADP",
    status: cleanStatus(item.status, "adoption"),
    image: image || (String(species).toLowerCase().includes("cat") ? CAT_IMAGE : DOG_IMAGE),
    details: item,
  };
}

function normalizeSurrender(item) {
  const pet = item.pet || {};
  const species = pet.species || "";
  const image = collectSurrenderPhotos(item)[0] || "";

  return {
    id: item.id || item.requestId,
    type: "surrender",
    name: pet.name || "Surrender Request",
    species,
    sex: pet.sex || "",
    age: normalizeAge(pet.age || ""),
    submittedAt: item.submittedAt || item.createdAt || item.updatedAt,
    reference: item.id || item.requestId || "SUR",
    status: cleanStatus(item.status, "surrender"),
    image: image || (String(species).toLowerCase().includes("cat") ? CAT_IMAGE : SURRENDER_IMAGE),
    details: item,
  };
}

async function fetchJson(url) {
  const token = getToken();

  if (!token) {
    return null;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function loadSubmissions() {
  submissionsLoadError = "";

  try {
    const [adoptionData, surrenderData] = await Promise.all([
      fetchJson(`${API_BASE_URL}/adoptions/my-applications`),
      fetchJson(`${API_BASE_URL}/surrenders/my-requests`),
    ]);

    const adoptionItems = (adoptionData?.adoptions || []).map(normalizeAdoption);
    const surrenderItems = (surrenderData?.requests || []).map(normalizeSurrender);

    allSubmissions = mergeSubmissionResults(adoptionItems, surrenderItems);
  } catch (error) {
    console.error("Failed to load submissions:", error);
    allSubmissions = [];
    submissionsLoadError = submissionLoadErrorMessage(error);
  }

  currentPage = 1;
  updateTabs();
  renderSubmissions();
}

function sortSubmissions(items) {
  return [...items].sort((a, b) => {
    const newestFirst = getDateTime(b.submittedAt) - getDateTime(a.submittedAt);
    return currentSort === "oldest" ? -newestFirst : newestFirst;
  });
}

function updateTabs() {
  const counts = {
    all: allSubmissions.length,
    adoption: allSubmissions.filter((item) => item.type === "adoption").length,
    surrender: allSubmissions.filter((item) => item.type === "surrender").length,
  };

  filterTabs.forEach((tab) => {
    const filter = tab.dataset.filter;
    const label = filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1);
    const icon = filter === "all"
      ? "fa-solid fa-border-all"
      : filter === "adoption"
        ? "fa-solid fa-house-chimney-user"
        : "fa-solid fa-hand-holding-heart";

    tab.innerHTML = `<i class="${icon}" aria-hidden="true"></i><span>${label} (${counts[filter] || 0})</span>`;
    tab.classList.toggle("active", filter === currentFilter);
  });
}

function renderSubmissions() {
  if (submissionsLoadError) {
    submissionsList.innerHTML = `
      <article class="submission-empty submission-error" role="alert">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <strong>We could not load your submissions.</strong>
        <span>${escapeHtml(submissionsLoadError)}</span>
        <button type="button" id="retrySubmissionsBtn">Try again</button>
      </article>
    `;
    document.getElementById("retrySubmissionsBtn")?.addEventListener("click", loadSubmissions);
    return;
  }

  const filteredItems =
    currentFilter === "all"
      ? allSubmissions
      : allSubmissions.filter((item) => item.type === currentFilter);
  const visibleItems = sortSubmissions(filteredItems);
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / SUBMISSIONS_PER_PAGE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const pageStart = (currentPage - 1) * SUBMISSIONS_PER_PAGE;
  const pageItems = visibleItems.slice(pageStart, pageStart + SUBMISSIONS_PER_PAGE);

  if (!visibleItems.length) {
    submissionsList.innerHTML = `
      <article class="submission-empty">
        <i class="fa-regular fa-file-lines"></i>
        <span>No ${currentFilter} submissions yet.</span>
      </article>
    `;
    return;
  }

  submissionsList.innerHTML = `
    ${pageItems.map(renderSubmissionCard).join("")}
    ${renderSubmissionPagination(visibleItems.length, totalPages)}
  `;

  submissionsList.querySelectorAll("[data-submission-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = allSubmissions.find((submission) => submission.id === button.dataset.submissionId);
      if (item) showSubmissionDetails(item);
    });
  });

  submissionsList.querySelectorAll("[data-submission-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPage = Number(button.dataset.submissionPage);
      if (!Number.isInteger(nextPage) || nextPage === currentPage) return;
      currentPage = nextPage;
      renderSubmissions();
      submissionsList.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderSubmissionPagination(totalItems, totalPages) {
  if (totalPages <= 1) return "";

  const pageButtons = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    return `<button type="button" data-submission-page="${page}" ${page === currentPage ? 'class="active" aria-current="page"' : ""}>${page}</button>`;
  }).join("");
  const firstItem = (currentPage - 1) * SUBMISSIONS_PER_PAGE + 1;
  const lastItem = Math.min(totalItems, currentPage * SUBMISSIONS_PER_PAGE);

  return `
    <nav class="submission-pagination" aria-label="Submission pages">
      <span>Showing ${firstItem}-${lastItem} of ${totalItems}</span>
      <div>
        <button type="button" data-submission-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""} aria-label="Previous page">
          <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
        </button>
        ${pageButtons}
        <button type="button" data-submission-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""} aria-label="Next page">
          <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    </nav>
  `;
}

function renderSubmissionCard(item) {
  const typeLabel = item.type === "adoption" ? "Adoption" : "Surrender";
  const typeIcon = item.type === "adoption" ? "fa-regular fa-heart" : "fa-regular fa-hand";
  const status = cleanStatus(item.status, item.type);
  const metaParts = [item.sex, item.species, item.age].filter(Boolean);
  const safeName = escapeHtml(item.name);
  const safeReference = escapeHtml(item.reference);
  const safeId = escapeHtml(item.id);
  const safeImage = escapeHtml(item.image);

  return `
    <article class="submission-card">
      <img class="submission-photo" src="${safeImage}" alt="${safeName}" width="190" height="112" loading="lazy" decoding="async">
      <div class="submission-info">
        <h2 class="submission-name">${safeName}</h2>
        <p class="submission-meta">${metaParts.map((part, index) => `${index ? '<span class="submission-dot">•</span>' : ""}<span>${escapeHtml(part)}</span>`).join("")}</p>
        <div class="submission-line">
          <i class="fa-regular fa-calendar-days"></i>
          <span>Submitted on ${formatDate(item.submittedAt)}</span>
        </div>
        <div class="submission-line">
          <i class="fa-regular fa-file-lines"></i>
          <span>Reference: ${safeReference}</span>
        </div>
      </div>
      <div class="submission-badges">
        <span class="submission-type ${item.type}"><i class="${typeIcon}" aria-hidden="true"></i>${typeLabel}</span>
        <span class="submission-status ${statusClass(status)}">
          <i class="${iconForStatus(status)}"></i>
          ${escapeHtml(status)}
        </span>
      </div>
      <button type="button" class="submission-details-btn" data-submission-id="${safeId}">
        <span>View Details</span>
        <i class="fa-solid fa-arrow-right"></i>
      </button>
    </article>
  `;
}

function valueOrFallback(value, fallback = "Not provided") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getCompatibilityLabel(item) {
  const percent = item.details?.compatibility?.matchPercent;
  if (typeof percent === "number") return `${percent}% Match`;
  if (String(item.status || "").toLowerCase().includes("reject")) return "Needs Review";
  return "Good Match";
}

function getApplicationMessage(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("expired")) {
    return "This application expired because the 14-day shelter attendance deadline passed without a confirmed arrival. Contact the shelter if you need staff to review or restore it.";
  }

  if (normalized.includes("approved") || normalized.includes("finalized")) {
    return "Your application has been approved. Please wait for shelter staff to coordinate the next step.";
  }

  if (normalized.includes("reject")) {
    return "Your application was reviewed and declined. Please contact the shelter if you need more information.";
  }

  if (normalized.includes("withdraw")) {
    return "You withdrew this application. No further shelter action is required.";
  }

  return "Your application is currently under review. We will contact you once a decision is available.";
}

function isApprovedDecision(status, type) {
  const normalized = String(status || "").toLowerCase();
  if (type === "surrender") return normalized.includes("approved") || normalized.includes("accepted") || normalized.includes("converted");
  return normalized.includes("approved") || normalized.includes("finalized");
}

function formatScheduleValue(value, fallback) {
  return valueOrFallback(formatDate(value), fallback);
}

function formatScheduleTime(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return valueOrFallback(value, "");

  const hour = Number(match[1]);
  const minute = match[2];
  if (Number.isNaN(hour)) return valueOrFallback(value, "");

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function scheduleTimeOrFallback(schedule) {
  return valueOrFallback(formatScheduleTime(schedule?.time), "Not scheduled");
}

function getScheduleDate(schedule, fallbackValue) {
  return schedule?.date || fallbackValue || "";
}

function hasScheduleValue(schedule, fallbackValue) {
  return Boolean(schedule?.date || fallbackValue || schedule?.time);
}

function hasUsedReschedule(schedule) {
  return Boolean(schedule?.rescheduledAt || Number(schedule?.rescheduleCount || 0) >= 1);
}

function getPendingReschedule(details, fieldName) {
  const request = details?.[fieldName] || {};
  return String(request.status || "").toLowerCase() === "pending" ? request : null;
}

function renderPendingReschedule(request, label) {
  if (!request) return "";

  const requestedDate = request.date ? formatScheduleValue(request.date, "Selected date") : "Selected date";
  const requestedTime = formatScheduleTime(request.time) || "selected time";

  return `
    <div class="reschedule-request-note">
      <i class="fa-regular fa-clock"></i>
      <p><strong>${escapeHtml(label)} pending admin approval.</strong>${escapeHtml(requestedDate)} at ${escapeHtml(requestedTime)}</p>
    </div>
  `;
}

function renderScheduleFeedback(item) {
  const feedback = item?.scheduleFeedback;
  if (!feedback) return "";
  const isPending = feedback.type === "pending";
  const isWarning = feedback.type === "warning";

  return `
    <div class="schedule-feedback ${isPending ? "pending" : isWarning ? "warning" : "saved"}">
      <i class="fa-solid ${isPending ? "fa-clock" : isWarning ? "fa-triangle-exclamation" : "fa-check"}"></i>
      <p><strong>${escapeHtml(feedback.title)}</strong>${escapeHtml(feedback.message)}</p>
    </div>
  `;
}

function getScheduleSavedFeedback(kind) {
  const action = kind === "surrender" ? "surrender appointment" : "pickup schedule";
  return {
    type: "warning",
    title: "Schedule Saved",
    message: `Please attend your ${action} before the displayed 14-day deadline. One reschedule request is allowed and requires staff approval.`,
  };
}

function renderSchedulePolicyWarning(kind) {
  const action = kind === "surrender" ? "surrender appointment" : "pickup schedule";
  return `
    <div class="schedule-feedback warning">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <p><strong>Attendance Reminder</strong>Please attend your ${action} before the 14-day deadline. One reschedule request is allowed and requires staff approval.</p>
    </div>
  `;
}

function renderApplicationTimeline(status, submittedDate, decisionDateLabel = submittedDate) {
  const normalized = String(status || "").toLowerCase();
  const isApproved = normalized.includes("approved") || normalized.includes("finalized");
  const isRejected = normalized.includes("reject");
  const isExpired = normalized.includes("expired");
  const isWithdrawn = normalized.includes("withdraw");
  const hasDecision = isApproved || isRejected || isExpired;
  const middleLabel = hasDecision ? "Reviewed" : isWithdrawn ? "Withdrawn" : "Under Review";
  const decisionLabel = isApproved ? "Approved" : isRejected ? "Rejected" : isExpired ? "Expired" : "Decision";
  const decisionDate = hasDecision ? decisionDateLabel : "Pending";

  return `
    <div class="application-timeline ${hasDecision ? "complete" : ""}">
      <div class="application-step done">
        <span><i class="fa-solid fa-check"></i></span>
        <strong>Submitted</strong>
        <small>${submittedDate}</small>
      </div>
      <div class="application-step ${hasDecision ? "done" : "active"}">
        <span>${hasDecision ? '<i class="fa-solid fa-check"></i>' : isWithdrawn ? '<i class="fa-solid fa-ban"></i>' : '<i class="fa-solid fa-minus"></i>'}</span>
        <strong>${middleLabel}</strong>
        <small>${isWithdrawn ? "By user" : submittedDate}</small>
      </div>
      <div class="application-step ${hasDecision ? "active done" : ""}">
        <span>${isApproved ? '<i class="fa-solid fa-check"></i>' : isRejected || isExpired ? '<i class="fa-solid fa-xmark"></i>' : "3"}</span>
        <strong>${decisionLabel}</strong>
        <small>${decisionDate}</small>
      </div>
    </div>
  `;
}

function getSurrenderMessage(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("expired")) {
    return "This surrender request expired because the 14-day shelter attendance deadline passed without a confirmed drop-off. Contact the shelter if you need staff to review or restore it.";
  }

  if (normalized.includes("approved") || normalized.includes("accepted") || normalized.includes("converted")) {
    return "Your surrender request has been approved. The shelter may contact you about the next steps.";
  }

  if (normalized.includes("reject")) {
    return "Your surrender request was reviewed and declined. Please contact the shelter if you need more information.";
  }

  if (normalized.includes("received")) {
    return "Your request has been received. The shelter will review your submitted information.";
  }

  return "Your request is being assessed. The shelter may contact you for additional information.";
}

function renderSurrenderTimeline(status, submittedDate, decisionDateLabel = submittedDate) {
  const normalized = String(status || "").toLowerCase();
  const isApproved = normalized.includes("approved") || normalized.includes("accepted") || normalized.includes("converted");
  const isRejected = normalized.includes("reject");
  const isExpired = normalized.includes("expired");
  const hasDecision = isApproved || isRejected || isExpired;
  const isReceivedOnly = normalized.includes("received");
  const middleLabel = hasDecision ? "Reviewed" : isReceivedOnly ? "For Assessment" : cleanStatus(status, "surrender");
  const decisionDate = hasDecision ? decisionDateLabel : "Pending";

  return `
    <div class="application-timeline surrender-timeline ${hasDecision ? "complete" : ""}">
      <div class="application-step done">
        <span><i class="fa-solid fa-check"></i></span>
        <strong>Received</strong>
        <small>${submittedDate}</small>
      </div>
      <div class="application-step ${hasDecision ? "done" : "active"}">
        <span>${hasDecision ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-minus"></i>'}</span>
        <strong>${escapeHtml(middleLabel)}</strong>
        <small>${submittedDate}</small>
      </div>
      <div class="application-step ${hasDecision ? "active done" : ""}">
        <span>${isApproved ? '<i class="fa-solid fa-check"></i>' : isRejected || isExpired ? '<i class="fa-solid fa-xmark"></i>' : "3"}</span>
        <strong>${isExpired ? "Expired" : "Decision"}</strong>
        <small>${decisionDate}</small>
      </div>
    </div>
  `;
}

function renderSubmittedAnswers(details) {
  const applicant = details?.applicant || {};
  const other = details?.other_information || {};
  const declaration = details?.declaration || {};

  const rows = [
    ["Full Name", applicant.full_name],
    ["Email", applicant.email],
    ["Contact Number", applicant.contact_number],
    ["Address", applicant.address],
    ["Civil Status", applicant.civil_status],
    ["Occupation", applicant.occupation],
    ["Why Adopt", other.why_adopt],
    ["Veterinarian Visit", other.visit_veterinarian],
    ["Existing Pets", other.existing_pets],
    ["Signature Name", declaration.signature_name],
  ];

  return rows
    .map(([label, value]) => `
      <p>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(valueOrFallback(value))}</span>
      </p>
    `)
    .join("");
}

function renderAttendanceDeadline(item, kind) {
  const details = item?.details || {};
  const deadline = parseDateValue(details.attendanceDeadlineAt)
    || addDays(getDecisionDate(kind, item), 14);
  const status = String(details.status || item?.status || "").toLowerCase();
  const isExpired = status.includes("expired");
  const isComplete = Boolean(details.arrivalConfirmedAt)
    || status.includes("finalized")
    || status.includes("converted");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  deadline.setHours(23, 59, 59, 999);
  const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const isUrgent = !isComplete && !isExpired && (details.noShowRisk === true || daysLeft <= 2);
  const appointmentName = kind === "surrender" ? "drop-off" : "pickup";
  const stateLabel = isComplete
    ? "Arrival confirmed"
    : isExpired
      ? "Expired \u2014 No Show"
      : details.deadlineStatus || (daysLeft === 1 ? "1 day remaining" : `${daysLeft} days remaining`);
  const message = isComplete
    ? `Your shelter ${appointmentName} attendance has been confirmed.`
    : isExpired
      ? "The deadline passed without confirmed attendance. Shelter staff may restore the request after review."
      : daysLeft <= 7
        ? `Reminder: complete your shelter ${appointmentName} within ${daysLeft} day${daysLeft === 1 ? "" : "s"} to keep this request active.`
        : `Choose and attend a shelter ${appointmentName} date within 14 days of approval.`;

  return `
    <section class="attendance-deadline-card ${isExpired ? "is-expired" : isUrgent ? "is-urgent" : isComplete ? "is-complete" : ""}">
      <span><i class="fa-regular ${isExpired ? "fa-calendar-xmark" : "fa-calendar-check"}"></i></span>
      <div>
        <small>14-day attendance deadline</small>
        <strong>${escapeHtml(formatDate(deadline))}</strong>
        <p>${escapeHtml(message)}</p>
      </div>
      <b>${escapeHtml(stateLabel)}</b>
    </section>
  `;
}

function renderApprovedAdoptionNextSteps(item) {
  const details = item.details || {};
  const schedule = details.pickupSchedule || {};
  const scheduleDate = getScheduleDate(schedule, details.adoptionDate);
  const hasSchedule = hasScheduleValue(schedule);
  const canReschedule = hasSchedule && !hasUsedReschedule(schedule);
  const pendingReschedule = getPendingReschedule(details, "pickupRescheduleRequest");
  const scheduleLabel = scheduleDate
    ? `${formatScheduleValue(scheduleDate, "Not scheduled")} ${scheduleTimeOrFallback(schedule)}`
    : "Not scheduled yet";

  return `
    <div class="approved-next-steps adoption-next-steps">
      <div class="approved-message">
        <i class="fa-solid fa-check"></i>
        <p><strong>Congratulations, your application has been approved.</strong>You may now schedule a pickup date and time to bring your new companion home.</p>
      </div>
      ${renderAttendanceDeadline(item, "adoption")}

      <section class="schedule-card">
        <header>
          <span><i class="fa-regular fa-calendar-days"></i></span>
          <div>
            <h3>Schedule Pet Pickup</h3>
            <p>Choose a convenient date and time to pick up ${escapeHtml(item.name)} from the shelter.</p>
          </div>
          ${hasSchedule && canReschedule ? `<button type="button" data-schedule-kind="adoption">Request Re-sched</button>` : ""}
        </header>
        <div class="schedule-info-grid">
          <article>
            <i class="fa-regular fa-calendar-days"></i>
            <strong>Pickup Schedule</strong>
            <p>${escapeHtml(scheduleLabel)}</p>
          </article>
          <article>
            <i class="fa-solid fa-location-dot"></i>
            <strong>Location</strong>
            <p>Angeles City Veterinary Office<br>Brgy. Pampang, Angeles City</p>
          </article>
          <article>
            <i class="fa-regular fa-clipboard"></i>
            <strong>What to Bring</strong>
            <ul>
              <li>Valid ID</li>
              <li>Adoption agreement</li>
            </ul>
          </article>
        </div>
      </section>
      ${!hasSchedule ? '<div class="schedule-card-action-row"><button type="button" data-schedule-kind="adoption">Schedule Pickup</button></div>' : ""}
      ${hasSchedule ? renderSchedulePolicyWarning("adoption") : ""}
      ${renderPendingReschedule(pendingReschedule, "Pickup reschedule request")}
    </div>
  `;
}

function renderAcceptedSurrenderNextSteps(item) {
  const details = item.details || {};
  const appointment = details.surrenderAppointment || {};
  const arrivalConfirmed = Boolean(details.arrivalConfirmedAt);
  const scheduleDate = getScheduleDate(appointment, details.dropoffDate);
  const hasSchedule = hasScheduleValue(appointment);
  const canReschedule = hasSchedule && !hasUsedReschedule(appointment);
  const pendingReschedule = getPendingReschedule(details, "surrenderRescheduleRequest");
  const scheduleLabel = scheduleDate
    ? `${formatScheduleValue(scheduleDate, "Not scheduled")} ${scheduleTimeOrFallback(appointment)}`
    : "Not scheduled yet";

  return `
    <div class="approved-next-steps surrender-next-steps">
      <div class="approved-message">
        <i class="fa-solid fa-check"></i>
        <p><strong>Congratulations, your surrender request has been accepted.</strong>You may now schedule an appointment to bring ${escapeHtml(item.name)} to the shelter.</p>
      </div>
      ${renderAttendanceDeadline(item, "surrender")}

      <section class="schedule-card surrender-schedule-card">
        <header>
          <span><i class="fa-regular fa-calendar-days"></i></span>
          <div>
            <h3>Schedule Surrender Appointment</h3>
            <p>Choose a date and time to bring ${escapeHtml(item.name)} to the shelter for turnover.</p>
          </div>
          ${hasSchedule && canReschedule && !arrivalConfirmed ? `<button type="button" data-schedule-kind="surrender">Request Re-sched</button>` : ""}
        </header>
        <div class="schedule-info-grid">
          <article>
            <i class="fa-regular fa-calendar-days"></i>
            <strong>Appointment</strong>
            <p>${escapeHtml(scheduleLabel)}</p>
          </article>
          <article>
            <i class="fa-solid fa-location-dot"></i>
            <strong>Location</strong>
            <p>Angeles City Veterinary Office<br>Brgy. Pampang, Angeles City</p>
          </article>
          <article>
            <i class="fa-regular fa-clipboard"></i>
            <strong>Reminders</strong>
            <ul>
              <li>Bring valid ID</li>
              <li>Animal records</li>
              <li>Vaccination documents</li>
            </ul>
          </article>
        </div>
      </section>
      ${!hasSchedule && !arrivalConfirmed ? '<div class="schedule-card-action-row"><button type="button" data-schedule-kind="surrender">Schedule Appointment</button></div>' : ""}
      ${hasSchedule && !arrivalConfirmed ? renderSchedulePolicyWarning("surrender") : ""}
      ${!arrivalConfirmed ? renderPendingReschedule(pendingReschedule, "Appointment reschedule request") : ""}
      ${arrivalConfirmed ? `
        <div class="schedule-feedback saved">
          <i class="fa-solid fa-check"></i>
          <p><strong>Shelter arrival confirmed</strong>Shelter staff can now create and process the Intake record.</p>
        </div>
      ` : ""}
    </div>
  `;
}

function collectSurrenderPhotos(details, fallbackImage) {
  const pet = details?.pet || {};
  const possiblePhotos = [
    pet.photoDataUrl,
    pet.photoURL,
    pet.imageUrl,
    pet.imageURL,
    pet.photoUrl,
    pet.profileImageUrl,
    ...(Array.isArray(pet.photos) ? pet.photos : []),
    ...(Array.isArray(pet.photoUrls) ? pet.photoUrls : []),
    ...(Array.isArray(details?.photos) ? details.photos : []),
    fallbackImage,
  ];

  return [...new Set(possiblePhotos.map((photo) => String(photo || "").trim()).filter(Boolean))];
}

function renderSurrenderAnimalDetails(details, item) {
  const owner = details?.owner || {};
  const pet = details?.pet || {};
  const photos = collectSurrenderPhotos(details, item?.image);
  const rows = [
    ["Owner Name", owner.name],
    ["Owner Email", owner.email],
    ["Contact Number", owner.contact],
    ["Address", owner.address],
    ["Barangay", owner.barangay],
    ["Breed", pet.breed],
    ["Color / Markings", pet.colorMarkings],
    ["Pet Status", Array.isArray(pet.status) ? pet.status.join(", ") : pet.status],
    ["Agreement", details?.agreement?.agreedToTerms ? "Accepted" : ""],
  ];

  return rows
    .map(([label, value]) => `
      <p>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(valueOrFallback(value))}</span>
      </p>
    `)
    .join("") + `
      <div class="surrender-photo-strip">
        ${photos.map((photo, index) => `<img src="${escapeHtml(photo)}" alt="${escapeHtml(`${item?.name || "Animal"} photo ${index + 1}`)}">`).join("")}
      </div>
    `;
}

const SCHEDULE_TIME_OPTIONS = [
  { label: "9:00 AM", value: "09:00" },
  { label: "10:00 AM", value: "10:00" },
  { label: "1:30 PM", value: "13:30" },
  { label: "2:30 PM", value: "14:30" },
];
const SCHEDULE_WINDOW_DAYS = 14;

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value) {
  if (!value) return null;
  if (value?._seconds || value?.seconds) {
    const seconds = Number(value._seconds || value.seconds);
    const date = new Date(seconds * 1000);
    date.setHours(0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value).trim();
  if (!text) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00`)
    : new Date(text);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + Number(days));
  return result;
}

function getDecisionDate(kind, item) {
  const details = item?.details || {};
  const candidates = kind === "surrender"
    ? [
        details.acceptedDate,
        details.acceptedAt,
        details.approvedDate,
        details.approvedAt,
        details.reviewedAt,
        details.updatedAt,
        item?.acceptedDate,
        item?.approvedDate,
      ]
    : [
        details.approvedDate,
        details.approvedAt,
        details.acceptedDate,
        details.acceptedAt,
        details.updatedAt,
        item?.approvedDate,
        item?.approvedAt,
      ];

  return candidates.map(parseDateValue).find(Boolean) || parseDateValue(item?.submittedAt) || new Date();
}

function getScheduleWindow(kind, item) {
  const decisionDate = getDecisionDate(kind, item);
  decisionDate.setHours(0, 0, 0, 0);

  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);
  if (decisionDate > minDate) {
    minDate.setTime(decisionDate.getTime());
  }

  const configuredDeadline = parseDateValue(item?.details?.attendanceDeadlineAt);
  const maxDate = configuredDeadline || addDays(decisionDate, 14);
  maxDate.setHours(23, 59, 59, 999);

  return { minDate, maxDate };
}

function isScheduleDateAllowed(date, minDate, maxDate) {
  return date >= minDate && date <= maxDate;
}

function formatScheduleMonth(date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function renderScheduleCalendar(monthDate, selectedDate, minDate, maxDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  const selectedValue = selectedDate ? toDateInputValue(selectedDate) : "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const previousMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
  const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
  const currentWindowMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const maxWindowMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  const canGoPrevious = previousMonth >= currentWindowMonth;
  const canGoNext = nextMonth <= maxWindowMonth;

  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    const isOutside = day.getMonth() !== monthDate.getMonth();
    const isUnavailable = !isScheduleDateAllowed(day, minDate, maxDate);
    const value = toDateInputValue(day);
    const isSelected = value === selectedValue;

    return `
      <button type="button" class="schedule-day ${isOutside ? "muted" : ""} ${isSelected ? "selected" : ""}" data-date="${value}" ${isUnavailable ? "disabled" : ""}>
        ${day.getDate()}
      </button>
    `;
  }).join("");

  return `
    <div class="schedule-calendar-head">
      <button type="button" data-calendar-prev aria-label="Previous month" ${canGoPrevious ? "" : "disabled"}><i class="fa-solid fa-chevron-left"></i></button>
      <strong>${formatScheduleMonth(monthDate)}</strong>
      <button type="button" data-calendar-next aria-label="Next month" ${canGoNext ? "" : "disabled"}><i class="fa-solid fa-chevron-right"></i></button>
    </div>
    <div class="schedule-weekdays">
      ${weekdays.map((day) => `<span>${day}</span>`).join("")}
    </div>
    <div class="schedule-days">
      ${days}
    </div>
  `;
}

async function promptForSchedule(kind, item) {
  const Swal = await getSwal();
  const isSurrender = kind === "surrender";
  const { minDate, maxDate } = getScheduleWindow(kind, item);
  const title = isSurrender ? "Schedule Surrender Appointment" : "Schedule Pet Pickup";
  const subtitle = isSurrender
    ? `Choose an available date and time to bring ${escapeHtml(item?.name || "your pet")} to the shelter.`
    : `Choose an available date and time to pick up ${escapeHtml(item?.name || "your pet")} from the shelter.`;
  const initialDate = new Date();
  initialDate.setDate(initialDate.getDate() + 1);
  initialDate.setHours(0, 0, 0, 0);
  if (initialDate < minDate) {
    initialDate.setTime(minDate.getTime());
  }
  if (initialDate > maxDate) {
    initialDate.setTime(maxDate.getTime());
  }
  let visibleMonth = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  let selectedDate = initialDate;
  let selectedTime = "";

  const result = await Swal.fire({
    html: `
      <section class="schedule-picker ${isSurrender ? "gold" : "red"}" data-selected-date="${toDateInputValue(selectedDate)}" data-selected-time="">
        <button type="button" class="schedule-picker-close" data-schedule-cancel aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <header>
          <span class="schedule-picker-icon"><i class="fa-regular fa-calendar-days" aria-hidden="true"></i></span>
          <div>
            <h2>${escapeHtml(title)}</h2>
            <p>${subtitle}</p>
          </div>
        </header>

        <div class="schedule-picker-section">
          <div class="schedule-limit-reminder">
            <strong>*Choose a date on or before your 14-day shelter attendance deadline: ${escapeHtml(formatDate(maxDate))}.</strong>
          </div>
          <div data-calendar-root></div>

          <div class="schedule-time-section">
          <div class="schedule-section-title">
            <span><i class="fa-regular fa-clock"></i></span>
            <strong>Available times</strong>
          </div>
          <div class="schedule-time-options">
            ${SCHEDULE_TIME_OPTIONS.map((time) => `
              <button type="button" data-time-value="${escapeHtml(time.value)}" ${time.custom ? 'data-time-custom="true"' : ""} ${time.disabled ? "disabled" : ""}>
                ${escapeHtml(time.label)}
              </button>
            `).join("")}
          </div>
          <label class="schedule-custom-time" hidden>
            <span>Enter preferred time</span>
            <input type="time" data-custom-time-input>
          </label>
          </div>
        </div>

        <div class="schedule-selected-summary" data-schedule-summary hidden>
          <span><i class="fa-regular fa-calendar-days"></i></span>
          <div>
            <strong>${isSurrender ? "Surrender appointment" : "Pickup schedule"}</strong>
            <p data-schedule-summary-main></p>
            <small><i class="fa-solid fa-location-dot"></i> Angeles City Veterinary Office, Brgy. Pampang, Angeles City</small>
          </div>
        </div>
      </section>
    `,
    showConfirmButton: true,
    showCancelButton: true,
    confirmButtonText: isSurrender ? "Confirm Appointment" : "Confirm Pickup Schedule",
    cancelButtonText: "Reset",
    customClass: {
      popup: "schedule-picker-popup",
      confirmButton: "animua-confirm schedule-picker-save",
      cancelButton: "schedule-picker-cancel",
    },
    buttonsStyling: false,
    didOpen: (popup) => {
      const picker = popup.querySelector(".schedule-picker");
      const calendarRoot = popup.querySelector("[data-calendar-root]");
      const customTimeField = popup.querySelector(".schedule-custom-time");
      const customTimeInput = popup.querySelector("[data-custom-time-input]");
      const summary = popup.querySelector("[data-schedule-summary]");
      const summaryMain = popup.querySelector("[data-schedule-summary-main]");

      const updateSummary = () => {
        if (!selectedDate || !selectedTime) {
          summary.hidden = true;
          return;
        }

        const dateLabel = selectedDate.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        const timeLabel = formatScheduleTime(selectedTime);
        if (!timeLabel) {
          summary.hidden = true;
          return;
        }

        summaryMain.textContent = `${dateLabel} at ${timeLabel}`;
        summary.hidden = false;
      };

      const renderCalendar = () => {
        calendarRoot.innerHTML = renderScheduleCalendar(visibleMonth, selectedDate, minDate, maxDate);
        picker.dataset.selectedDate = selectedDate ? toDateInputValue(selectedDate) : "";
        updateSummary();
      };

      renderCalendar();

      popup.addEventListener("click", (event) => {
        const resetButton = event.target.closest(".schedule-picker-cancel");
        if (resetButton) {
          event.preventDefault();
          event.stopImmediatePropagation();
          selectedDate = null;
          selectedTime = "";
          picker.dataset.selectedDate = "";
          picker.dataset.selectedTime = "";
          customTimeInput.value = "";
          customTimeField.hidden = true;
          popup.querySelectorAll("[data-time-value]").forEach((button) => {
            button.classList.remove("selected");
          });
          renderCalendar();
          updateSummary();
          return;
        }

        const cancelButton = event.target.closest("[data-schedule-cancel]");
        if (cancelButton) {
          Swal.close();
          return;
        }

        const previousButton = event.target.closest("[data-calendar-prev]");
        if (previousButton && !previousButton.disabled) {
          visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
          renderCalendar();
          return;
        }

        const nextButton = event.target.closest("[data-calendar-next]");
        if (nextButton && !nextButton.disabled) {
          visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
          renderCalendar();
          return;
        }

        const dayButton = event.target.closest("[data-date]");
        if (dayButton && !dayButton.disabled) {
          selectedDate = new Date(`${dayButton.dataset.date}T00:00:00`);
          visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
          renderCalendar();
          updateSummary();
          return;
        }

        const timeButton = event.target.closest("[data-time-value]");
        if (timeButton && !timeButton.disabled) {
          const isCustom = timeButton.dataset.timeCustom === "true";
          selectedTime = isCustom ? customTimeInput.value : timeButton.dataset.timeValue;
          picker.dataset.selectedTime = selectedTime;
          popup.querySelectorAll("[data-time-value]").forEach((button) => {
            button.classList.toggle("selected", button === timeButton);
          });
          customTimeField.hidden = !isCustom;
          if (isCustom) {
            customTimeInput.focus();
          }
          updateSummary();
        }
      }, true);

      customTimeInput.addEventListener("input", () => {
        const customButton = popup.querySelector("[data-time-custom]");
        if (!customButton?.classList.contains("selected")) return;
        selectedTime = customTimeInput.value;
        picker.dataset.selectedTime = selectedTime;
        updateSummary();
      });
    },
    preConfirm: () => {
      const popup = Swal.getPopup();
      const picker = popup?.querySelector(".schedule-picker");
      const date = picker?.dataset.selectedDate;
      const time = picker?.dataset.selectedTime;
      const chosenDate = parseDateValue(date);

      if (!date || !time) {
        Swal.showValidationMessage("Please choose both date and time.");
        return false;
      }

      if (!chosenDate || !isScheduleDateAllowed(chosenDate, minDate, maxDate)) {
        Swal.showValidationMessage("Please choose a date on or before your 14-day shelter attendance deadline.");
        return false;
      }

      return { date, time };
    },
  });

  return result.isConfirmed ? result.value : null;
}

async function saveSchedule(item, kind) {
  const schedule = await promptForSchedule(kind, item);
  if (!schedule) {
    showSubmissionDetails(item);
    return;
  }

  const isSurrender = kind === "surrender";

  const endpoint = kind === "surrender"
    ? `${API_BASE_URL}/surrenders/my-requests/${encodeURIComponent(item.id)}/appointment`
    : `${API_BASE_URL}/adoptions/my-applications/${encodeURIComponent(item.id)}/pickup-schedule`;

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(schedule),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Failed to save schedule.");
  }

  if (isSurrender) {
    if (result.request) {
      item.details = result.request;
    } else if (result.requiresApproval) {
      item.details = {
        ...item.details,
        surrenderRescheduleRequest: result.surrenderRescheduleRequest,
      };
    } else {
      item.details = {
        ...item.details,
        surrenderAppointment: result.surrenderAppointment,
        dropoffDate: schedule.date,
      };
    }
  } else {
    if (result.request) {
      item.details = result.request;
    } else {
      item.details = result.requiresApproval
      ? {
          ...item.details,
          pickupRescheduleRequest: result.pickupRescheduleRequest,
        }
      : {
          ...item.details,
          pickupSchedule: result.pickupSchedule || schedule,
        };
    }
  }

  item.scheduleFeedback = result.requiresApproval
    ? null
    : getScheduleSavedFeedback(kind);

  showSubmissionDetails(item);
}

async function showSubmissionDetails(item) {
  const Swal = await getSwal();
  if (item.type !== "adoption") {
    const status = cleanStatus(item.status, item.type);
    const isAccepted = isApprovedDecision(status, "surrender");
    const submittedDate = formatDate(item.submittedAt);
    const metaParts = [item.sex, item.species, item.age].filter(Boolean);
    const details = item.details || {};
    const pet = details.pet || {};
    const reason = valueOrFallback(details.surrenderReason);
    const healthCondition = Array.isArray(pet.status) && pet.status.length
      ? pet.status.join(", ")
      : valueOrFallback(pet.status, "Healthy");
    const vaccinationStatus = valueOrFallback(pet.vaccinationHistory, "Not provided");
    const decisionDate = formatDate(details.acceptedDate || details.acceptedAt || details.approvedDate || details.approvedAt || details.reviewedAt || details.updatedAt || item.submittedAt);

    Swal.fire({
      html: `
        <section class="application-detail-modal surrender-detail-modal">
          <header class="application-detail-header">
            <span class="application-detail-accent">
              <i class="fa-regular fa-file-lines" aria-hidden="true"></i>
            </span>
            <div>
              <h2>Request Details</h2>
              <p>View the latest status and next steps for this request.</p>
            </div>
            <button type="button" class="application-detail-x" data-close-application-modal aria-label="Close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </header>

          <div class="application-detail-hero">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
            <div class="application-detail-main">
              <h3>${escapeHtml(item.name)}</h3>
              <p>${metaParts.map(escapeHtml).join(' <span class="submission-dot">&bull;</span> ')}</p>
              <span class="application-type-badge surrender-type-badge">
                <i class="fa-solid fa-hands-holding-circle"></i>
                Surrender Request
              </span>
              <div class="application-detail-line">
                <i class="fa-regular fa-calendar-days"></i>
                <span>Submitted on ${submittedDate}</span>
              </div>
              <div class="application-reference">Reference: <strong>${escapeHtml(item.reference)}</strong></div>
            </div>
            <span class="application-modal-status submission-status ${statusClass(status)}">
              <i class="${iconForStatus(status)}"></i>
              ${escapeHtml(status)}
            </span>
          </div>

          ${renderSurrenderTimeline(status, submittedDate, decisionDate)}

          ${isAccepted ? "" : `
          <div class="application-detail-note surrender-detail-note">
            <i class="fa-solid fa-info"></i>
            <p>${escapeHtml(getSurrenderMessage(status))}</p>
          </div>
          `}

          ${isAccepted ? renderAcceptedSurrenderNextSteps(item) : `
          ${String(status).toLowerCase().includes("expired") ? renderAttendanceDeadline(item, "surrender") : ""}
          <div class="application-summary surrender-summary">
            <h3>Request Summary</h3>
            <div class="surrender-summary-list">
              <article>
                <span><i class="fa-solid fa-paw"></i></span>
                <strong>Reason for Surrender</strong>
                <p>${escapeHtml(reason)}</p>
              </article>
              <article>
                <span><i class="fa-regular fa-heart"></i></span>
                <strong>Health Condition</strong>
                <p>${escapeHtml(healthCondition)}</p>
              </article>
              <article>
                <span><i class="fa-solid fa-syringe"></i></span>
                <strong>Vaccination Status</strong>
                <p>${escapeHtml(vaccinationStatus)}</p>
              </article>
            </div>
          </div>

          <button type="button" class="application-answers-toggle surrender-answers-toggle" data-toggle-answers>
            <span><i class="fa-regular fa-image"></i>View animal details and photos</span>
            <i class="fa-solid fa-chevron-right"></i>
          </button>

          <div class="application-answers-panel" data-answers-panel hidden>
            ${renderSurrenderAnimalDetails(details, item)}
          </div>
          `}

        </section>
      `,
      showConfirmButton: false,
      showCloseButton: false,
      width: "min(620px, calc(100vw - 28px))",
      padding: 0,
      background: "transparent",
      customClass: {
        popup: "application-detail-popup surrender-detail-popup",
      },
      didOpen: (popup) => {
        popup.querySelectorAll("[data-close-application-modal]").forEach((button) => {
          button.addEventListener("click", () => Swal.close());
        });

        popup.querySelector("[data-toggle-answers]")?.addEventListener("click", (event) => {
          const panel = popup.querySelector("[data-answers-panel]");
          const isHidden = panel?.hasAttribute("hidden");
          panel?.toggleAttribute("hidden", !isHidden);
          event.currentTarget.classList.toggle("open", Boolean(isHidden));
        });

        popup.querySelectorAll("[data-schedule-kind]").forEach((button) => button.addEventListener("click", async (event) => {
          try {
            Swal.close();
            await saveSchedule(item, event.currentTarget.dataset.scheduleKind);
          } catch (error) {
            await Swal.fire({
              title: "Unable to Save Schedule",
              text: error.message || "Please try again.",
              confirmButtonText: "OK",
              customClass: {
                popup: "animua-popup",
                confirmButton: "animua-confirm",
              },
              buttonsStyling: false,
            });
            showSubmissionDetails(item);
          }
        }));
      },
    });
    return;
  }

  const status = cleanStatus(item.status, item.type);
  const submittedDate = formatDate(item.submittedAt);
  const metaParts = [item.sex, item.species, item.age].filter(Boolean);
  const details = item.details || {};
  const applicant = details.applicant || {};
  const homeType = valueOrFallback(applicant.address);
  const petExperience = valueOrFallback(details.other_information?.existing_pets, "Not provided");
  const isApproved = isApprovedDecision(status, "adoption");
  const decisionDate = formatDate(details.approvedDate || details.approvedAt || details.acceptedDate || details.acceptedAt || details.updatedAt || item.submittedAt);

  Swal.fire({
    html: `
      <section class="application-detail-modal adoption-detail-modal">
        <header class="application-detail-header">
          <span class="application-detail-accent">
            <i class="fa-regular fa-file-lines" aria-hidden="true"></i>
          </span>
          <div>
            <h2>Application Details</h2>
            <p>View the latest status and next steps for this application.</p>
          </div>
          <button type="button" class="application-detail-x" data-close-application-modal aria-label="Close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div class="application-detail-hero">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
          <div class="application-detail-main">
            <h3>${escapeHtml(item.name)}</h3>
            <p>${metaParts.map(escapeHtml).join(' <span class="submission-dot">&bull;</span> ')}</p>
            <span class="application-type-badge">
              <i class="fa-solid fa-house-chimney"></i>
              Adoption Application
            </span>
            <div class="application-detail-line">
              <i class="fa-regular fa-calendar-days"></i>
              <span>Submitted on ${submittedDate}</span>
            </div>
            <div class="application-reference">Reference: <strong>${escapeHtml(item.reference)}</strong></div>
          </div>
          <span class="application-modal-status submission-status ${statusClass(status)}">
            <i class="${iconForStatus(status)}"></i>
            ${escapeHtml(status)}
          </span>
        </div>

        ${renderApplicationTimeline(status, submittedDate, decisionDate)}

        ${isApproved ? "" : `
        <div class="application-detail-note">
          <i class="fa-solid fa-info"></i>
          <p>${escapeHtml(getApplicationMessage(status))}</p>
        </div>
        `}

        ${isApproved ? renderApprovedAdoptionNextSteps(item) : `
        ${String(status).toLowerCase().includes("expired") ? renderAttendanceDeadline(item, "adoption") : ""}
        <div class="application-summary">
          <h3>Application Summary</h3>
          <div class="application-summary-grid">
            <article>
              <span><i class="fa-solid fa-house-chimney"></i></span>
              <div>
                <strong>Home Type</strong>
                <p>${escapeHtml(homeType)}</p>
              </div>
            </article>
            <article>
              <span><i class="fa-solid fa-paw"></i></span>
              <div>
                <strong>Pet Experience</strong>
                <p>${escapeHtml(petExperience)}</p>
              </div>
            </article>
            <article>
              <span><i class="fa-solid fa-heart"></i></span>
              <div>
                <strong>Compatibility</strong>
                <p class="application-match"><i class="fa-solid fa-check"></i>${escapeHtml(getCompatibilityLabel(item))}</p>
              </div>
            </article>
          </div>
        </div>

        <button type="button" class="application-answers-toggle" data-toggle-answers>
          <span><i class="fa-regular fa-file-lines"></i>View submitted answers</span>
          <i class="fa-solid fa-chevron-right"></i>
        </button>

        <div class="application-answers-panel" data-answers-panel hidden>
          ${renderSubmittedAnswers(details)}
        </div>
        `}

      </section>
    `,
    showConfirmButton: false,
    showCloseButton: false,
    width: "min(620px, calc(100vw - 28px))",
    padding: 0,
    background: "transparent",
    customClass: {
      popup: "application-detail-popup adoption-detail-popup",
    },
    didOpen: (popup) => {
      popup.querySelectorAll("[data-close-application-modal]").forEach((button) => {
        button.addEventListener("click", () => Swal.close());
      });

      popup.querySelector("[data-toggle-answers]")?.addEventListener("click", (event) => {
        const panel = popup.querySelector("[data-answers-panel]");
        const isHidden = panel?.hasAttribute("hidden");
        panel?.toggleAttribute("hidden", !isHidden);
        event.currentTarget.classList.toggle("open", Boolean(isHidden));
      });

      popup.querySelectorAll("[data-schedule-kind]").forEach((button) => button.addEventListener("click", async (event) => {
        try {
          Swal.close();
          await saveSchedule(item, event.currentTarget.dataset.scheduleKind);
        } catch (error) {
          await Swal.fire({
            title: "Unable to Save Schedule",
            text: error.message || "Please try again.",
            confirmButtonText: "OK",
            customClass: {
              popup: "animua-popup",
              confirmButton: "animua-confirm",
            },
            buttonsStyling: false,
          });
          showSubmissionDetails(item);
        }
      }));
    },
  });
}

filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    currentFilter = tab.dataset.filter || "all";
    currentPage = 1;
    updateTabs();
    renderSubmissions();
  });
});

function closeSortMenu() {
  submissionSortMenu?.classList.add("hidden");
  submissionSortBtn?.setAttribute("aria-expanded", "false");
}

function syncSortMenuState() {
  submissionSortMenu?.querySelectorAll("[data-sort-value]").forEach((button) => {
    const isActive = button.dataset.sortValue === currentSort;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));

    if (isActive && submissionSortLabel) {
      submissionSortLabel.textContent = button.textContent.trim();
    }
  });

  if (submissionSortControl) {
    submissionSortControl.dataset.sortValue = currentSort;
  }
}

submissionSortBtn?.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = !submissionSortMenu?.classList.contains("hidden");

  syncSortMenuState();
  submissionSortMenu?.classList.toggle("hidden", isOpen);
  submissionSortBtn.setAttribute("aria-expanded", String(!isOpen));
});

submissionSortMenu?.addEventListener("click", (event) => {
  const option = event.target.closest("[data-sort-value]");
  if (!option) return;

  currentSort = option.dataset.sortValue || "newest";
  currentPage = 1;

  syncSortMenuState();
  closeSortMenu();
  renderSubmissions();
});

document.addEventListener("click", (event) => {
  if (!submissionSortControl?.contains(event.target)) {
    closeSortMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSortMenu();
  }
});

syncSortMenuState();
loadCompatibilityAccount();
loadSubmissions();
