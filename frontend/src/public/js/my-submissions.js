import Swal from "sweetalert2";
import { API_BASE_URL } from "../../utils/api.js";

const DOG_IMAGE = new URL("../../assets/images/dog.jpg", import.meta.url).href;
const CAT_IMAGE = new URL("../../assets/images/cat.jpg", import.meta.url).href;
const SHELTER_DOG_IMAGE = new URL("../../assets/images/homepage-shelter-dog.png", import.meta.url).href;
const SURRENDER_IMAGE = new URL("../../assets/images/surrender.jpg", import.meta.url).href;

const submissionsList = document.getElementById("submissionsList");
const filterTabs = document.querySelectorAll(".submission-tab");
const submissionSortControl = document.getElementById("submissionSortControl");
const submissionSortBtn = document.getElementById("submissionSortBtn");
const submissionSortLabel = document.getElementById("submissionSortLabel");
const submissionSortMenu = document.getElementById("submissionSortMenu");
const compatibilityAccountBody = document.getElementById("compatibilityAccountBody");

async function loadCompatibilityAccount() {
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
    const traits = Object.entries(latest.preferences || {}).map(([key, value]) => `<span><strong>${escapeHtml(key.replace(/([A-Z])/g, " $1"))}</strong>${escapeHtml(value)}/5</span>`).join("");
    const matches = (latest.matches || []).map((match) => `<li><strong>${escapeHtml(match.animalName || "Shelter animal")}</strong><span>${Number(match.compatibilityPercent || 0).toFixed(1)}%</span></li>`).join("");
    const history = results.slice(1).map((item) => `<li>${formatDate(item.completedAt)} <small>${escapeHtml(item.resultId)}</small></li>`).join("");
    compatibilityAccountBody.innerHTML = `<div class="compatibility-dates"><p><small>Completed</small>${formatDate(latest.completedAt)}</p><p><small>Next allowed retake</small>${formatDate(latest.nextRetakeAt)}</p></div><h3>Your trait profile</h3><div class="compatibility-traits">${traits}</div><h3>Top recommended animals</h3><ol class="compatibility-matches">${matches || "<li>No animals matched the selected filters.</li>"}</ol>${history ? `<details><summary>Previous result history (${results.length - 1})</summary><ul>${history}</ul></details>` : ""}`;
  } catch (error) { compatibilityAccountBody.innerHTML = `<p>${escapeHtml(error.message)}</p>`; }
}

const DEMO_SUBMISSIONS = [
  {
    id: "demo-adp-gray",
    type: "adoption",
    name: "Gray",
    species: "Cat",
    sex: "Female",
    age: "1 year old",
    submittedAt: "2026-07-20",
    reference: "ADP-2026-0041",
    status: "Approved",
    image: CAT_IMAGE,
    isDemo: true,
  },
  {
    id: "demo-adp-bingo",
    type: "adoption",
    name: "Bingo",
    species: "Dog",
    sex: "Male",
    age: "2 years old",
    submittedAt: "2026-07-12",
    reference: "ADP-2026-0035",
    status: "Approved",
    image: DOG_IMAGE,
    isDemo: true,
  },
  {
    id: "demo-sur-bruno",
    type: "surrender",
    name: "Bruno",
    species: "Dog",
    sex: "Male",
    age: "3 years old",
    submittedAt: "2026-07-22",
    reference: "SUR-2026-0018",
    status: "Approved",
    image: SHELTER_DOG_IMAGE,
    isDemo: true,
    details: {
      id: "SUR-2026-0018",
      owner: {
        name: "Demo User",
        email: "demo@example.com",
        contact: "+63 900 000 0000",
        address: "Angeles City",
        barangay: "Balibago",
      },
      pet: {
        name: "Bruno",
        species: "Dog",
        breed: "Mixed Breed",
        age: "3 years old",
        sex: "Male",
        colorMarkings: "Brown and black coat",
        status: ["Healthy"],
        vaccinationHistory: "Up to date",
      },
      surrenderReason: "Moving to a place that does not allow pets.",
      agreement: {
        agreedToTerms: true,
      },
      submittedAt: "2026-07-22",
    },
  },
  {
    id: "demo-sur-ming",
    type: "surrender",
    name: "Ming",
    species: "Cat",
    sex: "Female",
    age: "8 months old",
    submittedAt: "2026-07-15",
    reference: "SUR-2026-0015",
    status: "Received",
    image: CAT_IMAGE,
    isDemo: true,
    details: {
      id: "SUR-2026-0015",
      owner: {
        name: "Demo User",
        email: "demo@example.com",
        contact: "+63 900 000 0000",
        address: "Angeles City",
        barangay: "Amsic",
      },
      pet: {
        name: "Ming",
        species: "Cat",
        breed: "Domestic Shorthair",
        age: "8 months old",
        sex: "Female",
        colorMarkings: "Tabby coat",
        status: ["Healthy"],
        vaccinationHistory: "Not provided",
      },
      surrenderReason: "Owner can no longer provide care.",
      agreement: {
        agreedToTerms: true,
      },
      submittedAt: "2026-07-15",
    },
  },
];

let allSubmissions = [];
let currentFilter = "all";
let currentSort = "newest";

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
  if (normalized.includes("reject")) return "rejected";
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
  if (normalized.includes("withdraw")) return "fa-solid fa-ban";
  return "fa-regular fa-clock";
}

function normalizeAdoption(item) {
  const animal = item.animal || {};
  const species = animal.species || item.species || "";

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
    image: animal.imageUrl || (String(species).toLowerCase().includes("cat") ? CAT_IMAGE : DOG_IMAGE),
    details: item,
  };
}

function normalizeSurrender(item) {
  const pet = item.pet || {};
  const species = pet.species || "";

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
    image: String(species).toLowerCase().includes("cat") ? CAT_IMAGE : SURRENDER_IMAGE,
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
  try {
    const [adoptionData, surrenderData] = await Promise.all([
      fetchJson(`${API_BASE_URL}/adoptions/my-applications`),
      fetchJson(`${API_BASE_URL}/surrenders/my-requests`),
    ]);

    const adoptionItems = (adoptionData?.adoptions || []).map(normalizeAdoption);
    const surrenderItems = (surrenderData?.requests || []).map(normalizeSurrender);

    allSubmissions = [...adoptionItems, ...surrenderItems];

    if (!allSubmissions.length) {
      allSubmissions = DEMO_SUBMISSIONS;
    }
  } catch (error) {
    console.error("Failed to load submissions:", error);
    allSubmissions = DEMO_SUBMISSIONS;
  }

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
  const filteredItems =
    currentFilter === "all"
      ? allSubmissions
      : allSubmissions.filter((item) => item.type === currentFilter);
  const visibleItems = sortSubmissions(filteredItems);

  if (!visibleItems.length) {
    submissionsList.innerHTML = `
      <article class="submission-empty">
        <i class="fa-regular fa-file-lines"></i>
        <span>No ${currentFilter} submissions yet.</span>
      </article>
    `;
    return;
  }

  submissionsList.innerHTML = visibleItems.map(renderSubmissionCard).join("");

  submissionsList.querySelectorAll("[data-submission-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = allSubmissions.find((submission) => submission.id === button.dataset.submissionId);
      if (item) showSubmissionDetails(item);
    });
  });
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
      <img class="submission-photo" src="${safeImage}" alt="${safeName}">
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

  return `
    <div class="schedule-feedback ${feedback.type === "pending" ? "pending" : "saved"}">
      <i class="fa-solid ${feedback.type === "pending" ? "fa-clock" : "fa-check"}"></i>
      <p><strong>${escapeHtml(feedback.title)}</strong>${escapeHtml(feedback.message)}</p>
    </div>
  `;
}

function renderApplicationTimeline(status, submittedDate) {
  const normalized = String(status || "").toLowerCase();
  const isApproved = normalized.includes("approved") || normalized.includes("finalized");
  const isRejected = normalized.includes("reject");
  const isWithdrawn = normalized.includes("withdraw");

  return `
    <div class="application-timeline ${isApproved || isRejected ? "complete" : ""}">
      <div class="application-step done">
        <span><i class="fa-solid fa-check"></i></span>
        <strong>Submitted</strong>
        <small>${submittedDate}</small>
      </div>
      <div class="application-step ${isApproved || isRejected ? "done" : "active"}">
        <span>${isWithdrawn ? '<i class="fa-solid fa-ban"></i>' : '<i class="fa-solid fa-minus"></i>'}</span>
        <strong>${isWithdrawn ? "Withdrawn" : "Under Review"}</strong>
        <small>${isWithdrawn ? "By user" : submittedDate}</small>
      </div>
      <div class="application-step ${isApproved || isRejected ? "active done" : ""}">
        <span>${isApproved ? '<i class="fa-solid fa-check"></i>' : isRejected ? '<i class="fa-solid fa-xmark"></i>' : "3"}</span>
        <strong>Decision</strong>
        <small>${isApproved ? "Approved" : isRejected ? "Rejected" : "Pending"}</small>
      </div>
    </div>
  `;
}

function getSurrenderMessage(status) {
  const normalized = String(status || "").toLowerCase();

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

function renderSurrenderTimeline(status, submittedDate) {
  const normalized = String(status || "").toLowerCase();
  const isApproved = normalized.includes("approved") || normalized.includes("accepted") || normalized.includes("converted");
  const isRejected = normalized.includes("reject");
  const isReceivedOnly = normalized.includes("received");
  const middleLabel = isReceivedOnly ? "For Assessment" : cleanStatus(status, "surrender");

  return `
    <div class="application-timeline surrender-timeline ${isApproved || isRejected ? "complete" : ""}">
      <div class="application-step done">
        <span><i class="fa-solid fa-check"></i></span>
        <strong>Received</strong>
        <small>${submittedDate}</small>
      </div>
      <div class="application-step ${isApproved || isRejected ? "done" : "active"}">
        <span><i class="fa-solid fa-minus"></i></span>
        <strong>${escapeHtml(middleLabel)}</strong>
        <small>${submittedDate}</small>
      </div>
      <div class="application-step ${isApproved || isRejected ? "active done" : ""}">
        <span>${isApproved ? '<i class="fa-solid fa-check"></i>' : isRejected ? '<i class="fa-solid fa-xmark"></i>' : "3"}</span>
        <strong>Decision</strong>
        <small>${isApproved ? "Accepted" : isRejected ? "Rejected" : "Pending"}</small>
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

function renderApprovedAdoptionNextSteps(item) {
  const details = item.details || {};
  const schedule = details.pickupSchedule || {};
  const scheduleDate = getScheduleDate(schedule, details.adoptionDate);
  const hasSchedule = hasScheduleValue(schedule);
  const pendingReschedule = getPendingReschedule(details, "pickupRescheduleRequest");
  const scheduleLabel = scheduleDate
    ? `${formatScheduleValue(scheduleDate, "Not scheduled")} ${scheduleTimeOrFallback(schedule)}`
    : "Not scheduled yet";

  return `
    <div class="approved-next-steps adoption-next-steps">
      <div class="approved-message">
        <i class="fa-solid fa-circle-check"></i>
        <p><strong>Great news! Your adoption application has been approved.</strong>Please schedule a pickup date and time to bring your new companion home.</p>
      </div>

      <section class="schedule-card">
        <header>
          <span><i class="fa-regular fa-calendar-days"></i></span>
          <div>
            <h3>Schedule Pet Pickup</h3>
            <p>Choose a convenient date and time to pick up ${escapeHtml(item.name)} from the shelter.</p>
          </div>
          <button type="button" data-schedule-kind="adoption">${hasSchedule ? "Request Re-sched" : "Schedule Pickup"}</button>
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
      ${renderScheduleFeedback(item)}
      ${renderPendingReschedule(pendingReschedule, "Pickup reschedule request")}
    </div>
  `;
}

function renderAcceptedSurrenderNextSteps(item) {
  const details = item.details || {};
  const appointment = details.surrenderAppointment || {};
  const scheduleDate = getScheduleDate(appointment, details.dropoffDate);
  const hasSchedule = hasScheduleValue(appointment);
  const pendingReschedule = getPendingReschedule(details, "surrenderRescheduleRequest");
  const scheduleLabel = scheduleDate
    ? `${formatScheduleValue(scheduleDate, "Not scheduled")} ${scheduleTimeOrFallback(appointment)}`
    : "Not scheduled yet";

  return `
    <div class="approved-next-steps surrender-next-steps">
      <div class="approved-message">
        <i class="fa-solid fa-paw"></i>
        <p><strong>Your surrender request has been accepted.</strong>Please schedule an appointment to bring ${escapeHtml(item.name)} to the shelter.</p>
      </div>

      <section class="schedule-card surrender-schedule-card">
        <header>
          <span><i class="fa-regular fa-calendar-days"></i></span>
          <div>
            <h3>Schedule Surrender Appointment</h3>
            <p>Choose a date and time to bring ${escapeHtml(item.name)} to the shelter for turnover.</p>
          </div>
          <button type="button" data-schedule-kind="surrender">${hasSchedule ? "Request Re-sched" : "Schedule"}</button>
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
      ${renderScheduleFeedback(item)}
      ${renderPendingReschedule(pendingReschedule, "Appointment reschedule request")}
    </div>
  `;
}

function collectSurrenderPhotos(details, fallbackImage) {
  const pet = details?.pet || {};
  const possiblePhotos = [
    pet.imageUrl,
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
  { label: "Other", value: "other", custom: true },
];

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatScheduleMonth(date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function renderScheduleCalendar(monthDate, selectedDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedValue = selectedDate ? toDateInputValue(selectedDate) : "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    const isOutside = day.getMonth() !== monthDate.getMonth();
    const isPast = day < today;
    const value = toDateInputValue(day);
    const isSelected = value === selectedValue;

    return `
      <button type="button" class="schedule-day ${isOutside ? "muted" : ""} ${isSelected ? "selected" : ""}" data-date="${value}" ${isPast ? "disabled" : ""}>
        ${day.getDate()}
      </button>
    `;
  }).join("");

  return `
    <div class="schedule-calendar-head">
      <button type="button" data-calendar-prev aria-label="Previous month"><i class="fa-solid fa-chevron-left"></i></button>
      <strong>${formatScheduleMonth(monthDate)}</strong>
      <button type="button" data-calendar-next aria-label="Next month"><i class="fa-solid fa-chevron-right"></i></button>
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
  const isSurrender = kind === "surrender";
  const title = isSurrender ? "Schedule Surrender Appointment" : "Schedule Pet Pickup";
  const subtitle = isSurrender
    ? `Choose an available date and time to bring ${escapeHtml(item?.name || "your pet")} to the shelter.`
    : `Choose an available date and time to pick up ${escapeHtml(item?.name || "your pet")} from the shelter.`;
  const initialDate = new Date();
  initialDate.setDate(initialDate.getDate() + 1);
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
          <h2>${escapeHtml(title)}</h2>
          <p>${subtitle}</p>
        </header>

        <div class="schedule-picker-section">
          <div class="schedule-section-title">
            <span><i class="fa-regular fa-calendar-days"></i></span>
            <strong>1. Select Date</strong>
          </div>
          <div data-calendar-root></div>
        </div>

        <div class="schedule-picker-section schedule-time-section">
          <div class="schedule-section-title">
            <span><i class="fa-regular fa-clock"></i></span>
            <strong>2. Select Time</strong>
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
      </section>
    `,
    showConfirmButton: true,
    showCancelButton: false,
    confirmButtonText: "Save Schedule",
    customClass: {
      popup: "schedule-picker-popup",
      confirmButton: "animua-confirm schedule-picker-save",
    },
    buttonsStyling: false,
    didOpen: (popup) => {
      const picker = popup.querySelector(".schedule-picker");
      const calendarRoot = popup.querySelector("[data-calendar-root]");
      const customTimeField = popup.querySelector(".schedule-custom-time");
      const customTimeInput = popup.querySelector("[data-custom-time-input]");

      const renderCalendar = () => {
        calendarRoot.innerHTML = renderScheduleCalendar(visibleMonth, selectedDate);
        picker.dataset.selectedDate = toDateInputValue(selectedDate);
      };

      renderCalendar();

      popup.addEventListener("click", (event) => {
        const cancelButton = event.target.closest("[data-schedule-cancel]");
        if (cancelButton) {
          Swal.clickCancel();
          return;
        }

        const previousButton = event.target.closest("[data-calendar-prev]");
        if (previousButton) {
          visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
          renderCalendar();
          return;
        }

        const nextButton = event.target.closest("[data-calendar-next]");
        if (nextButton) {
          visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
          renderCalendar();
          return;
        }

        const dayButton = event.target.closest("[data-date]");
        if (dayButton && !dayButton.disabled) {
          selectedDate = new Date(`${dayButton.dataset.date}T00:00:00`);
          visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
          renderCalendar();
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
        }
      });

      customTimeInput.addEventListener("input", () => {
        const customButton = popup.querySelector("[data-time-custom]");
        if (!customButton?.classList.contains("selected")) return;
        selectedTime = customTimeInput.value;
        picker.dataset.selectedTime = selectedTime;
      });
    },
    preConfirm: () => {
      const popup = Swal.getPopup();
      const picker = popup?.querySelector(".schedule-picker");
      const date = picker?.dataset.selectedDate;
      const time = picker?.dataset.selectedTime;

      if (!date || !time) {
        Swal.showValidationMessage("Please choose both date and time.");
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

  const currentDetails = item.details || {};
  const isSurrender = kind === "surrender";
  const existingSchedule = isSurrender
    ? hasScheduleValue(currentDetails.surrenderAppointment || {})
    : hasScheduleValue(currentDetails.pickupSchedule || {});

  if (item.isDemo) {
    if (isSurrender && existingSchedule) {
      item.details = {
        ...item.details,
        surrenderRescheduleRequest: {
          ...schedule,
          status: "Pending",
          requestedAt: new Date().toISOString(),
        },
      };
    } else if (!isSurrender && existingSchedule) {
      item.details = {
        ...item.details,
        pickupRescheduleRequest: {
          ...schedule,
          status: "Pending",
          requestedAt: new Date().toISOString(),
        },
      };
    } else if (isSurrender) {
      item.details = {
        ...item.details,
        surrenderAppointment: {
          ...schedule,
          location: "Angeles City Veterinary Office, Brgy. Pampang, Angeles City",
        },
        dropoffDate: schedule.date,
      };
    } else {
      item.details = {
        ...item.details,
        pickupSchedule: {
          ...schedule,
          location: "Angeles City Veterinary Office, Brgy. Pampang, Angeles City",
        },
      };
    }

    item.scheduleFeedback = existingSchedule
      ? null
      : {
          type: "saved",
          title: "Schedule Saved",
          message: "Your schedule has been saved.",
        };
    showSubmissionDetails(item);
    return;
  }

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

  item.scheduleFeedback = result.requiresApproval
    ? null
    : {
        type: "saved",
        title: "Schedule Saved",
        message: "Your schedule has been saved.",
      };

  showSubmissionDetails(item);
}

function showSubmissionDetails(item) {
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

    Swal.fire({
      html: `
        <section class="application-detail-modal surrender-detail-modal">
          <header class="application-detail-header">
            <span class="application-detail-accent"></span>
            <h2>Request Details</h2>
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

          ${renderSurrenderTimeline(status, submittedDate)}

          ${isAccepted ? "" : `
          <div class="application-detail-note surrender-detail-note">
            <i class="fa-solid fa-info"></i>
            <p>${escapeHtml(getSurrenderMessage(status))}</p>
          </div>
          `}

          ${isAccepted ? renderAcceptedSurrenderNextSteps(item) : `
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

          <footer class="application-detail-actions">
            <button type="button" class="application-close-btn" data-close-application-modal>Close</button>
          </footer>
        </section>
      `,
      showConfirmButton: false,
      showCloseButton: false,
      width: "min(560px, calc(100vw - 28px))",
      padding: 0,
      background: "transparent",
      customClass: {
        popup: "application-detail-popup",
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

        popup.querySelector("[data-schedule-kind]")?.addEventListener("click", async (event) => {
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
        });
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

  Swal.fire({
    html: `
      <section class="application-detail-modal">
        <header class="application-detail-header">
          <span class="application-detail-accent"></span>
          <h2>Application Details</h2>
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

        ${renderApplicationTimeline(status, submittedDate)}

        ${isApproved ? "" : `
        <div class="application-detail-note">
          <i class="fa-solid fa-info"></i>
          <p>${escapeHtml(getApplicationMessage(status))}</p>
        </div>
        `}

        ${isApproved ? renderApprovedAdoptionNextSteps(item) : `
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

        <footer class="application-detail-actions">
          <button type="button" class="application-close-btn" data-close-application-modal>Close</button>
        </footer>
      </section>
    `,
    showConfirmButton: false,
    showCloseButton: false,
    width: "min(560px, calc(100vw - 28px))",
    padding: 0,
    background: "transparent",
    customClass: {
      popup: "application-detail-popup",
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

      popup.querySelector("[data-schedule-kind]")?.addEventListener("click", async (event) => {
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
      });
    },
  });
}

filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    currentFilter = tab.dataset.filter || "all";
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
