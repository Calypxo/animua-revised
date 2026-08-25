import { API_BASE_URL } from "../../utils/api.js";
import { ensureUserSession, hasUserSession } from "../../utils/storage.js";

const DOG_IMAGE = new URL("../../assets/images/dog.jpg", import.meta.url).href;
const CAT_IMAGE = new URL("../../assets/images/cat.jpg", import.meta.url).href;

const compatibilityAccountBody = document.getElementById("compatibilityAccountBody");
const compatibilityAccountTitle = document.querySelector(".compatibility-account-title");
const compatibilityAccountAction = document.querySelector("[data-review-answers]");
const compatibilityCompletedDate = document.getElementById("compatibilityCompletedDate");
const compatibilityRetakeDate = document.getElementById("compatibilityRetakeDate");
let nextAllowedRetakeDate = null;
let loadedResults = [];
let currentResultsMode = "saved";
let swalModulePromise;
const compatibilityPhotoCache = new Map();

async function getSwal() {
  swalModulePromise ||= import("sweetalert2").then((module) => module.default);
  return swalModulePromise;
}

const traitLabels = {
  energyLevel: "Energy level",
  exerciseNeeds: "Exercise needs",
  independenceLevel: "Independence",
  attentionNeeds: "Attention needs",
  playfulness: "Playfulness",
  friendlinessToHumans: "Friendliness",
  goodWithKids: "Good with kids",
  goodWithOtherPets: "Good with pets",
  strangerTolerance: "Stranger tolerance",
  noiseLevel: "Noise tolerance",
};

const matchDetailTraits = [
  { key: "energyLevel", icon: "fa-bolt" },
  { key: "exerciseNeeds", icon: "fa-person-running" },
  { key: "independenceLevel", icon: "fa-user-group" },
  { key: "attentionNeeds", icon: "fa-bell" },
  { key: "playfulness", icon: "fa-face-smile" },
  { key: "friendlinessToHumans", icon: "fa-heart" },
  { key: "goodWithKids", icon: "fa-child-reaching" },
  { key: "goodWithOtherPets", icon: "fa-paw" },
];

const answerSections = [
  {
    title: "Lifestyle & Activity",
    icon: "fa-paw",
    items: [
      { source: "preferences", key: "energyLevel", label: "Energy preference", scale: ["Very calm", "Low energy", "Moderate", "Active", "Very energetic"] },
      { source: "preferences", key: "exerciseNeeds", label: "Exercise needs", scale: ["Very little", "A little", "Moderate", "A lot", "Very high"] },
      { source: "preferences", key: "adaptability", label: "Routine stability", scale: ["Very stable", "Slightly changing", "Moderate changes", "Often changing", "Very unpredictable"] },
      { source: "preferences", key: "playfulness", label: "Playfulness", scale: ["Very calm", "Slightly playful", "Balanced", "Playful", "Very playful"] },
    ],
  },
  {
    title: "Home Environment",
    icon: "fa-house",
    items: [
      { source: "filters", key: "preferredSpecies", label: "Preferred species", options: { any: "No preference", dog: "Dog", cat: "Cat" } },
      { source: "filters", key: "preferredSex", label: "Preferred sex", options: { any: "No preference", male: "Male", female: "Female" } },
      { source: "preferences", key: "spaceNeeds", label: "Living space", scale: ["Very small (studio)", "Small", "Average", "Large", "Very large with yard"] },
      { source: "preferences", key: "goodWithKids", label: "Kids at home", scale: ["Never", "Rarely", "Sometimes", "Often", "Daily - it's a must"] },
      { source: "preferences", key: "goodWithOtherPets", label: "Other pets", scale: ["No other pets", "Rare contact", "Sometimes", "Often", "Yes, definitely"] },
      { source: "preferences", key: "strangerTolerance", label: "Visitor comfort", scale: ["Very cautious", "Reserved", "Balanced", "Friendly", "Very welcoming"] },
    ],
  },
  {
    title: "Care Preferences",
    icon: "fa-heart",
    items: [
      { source: "preferences", key: "attentionNeeds", label: "Daily attention", scale: ["Very little", "A little", "Moderate", "A lot", "Very high"] },
      { source: "preferences", key: "groomingNeeds", label: "Grooming commitment", scale: ["Not willing", "Slightly willing", "Moderate effort", "Willing", "Very willing"] },
      { source: "preferences", key: "healthRiskLevel", label: "Vet budget", scale: ["Not prepared", "Slightly prepared", "Somewhat prepared", "Prepared", "Fully prepared"] },
      { source: "preferences", key: "affectionLevel", label: "Affection preference", scale: ["Very independent", "Not very affectionate", "Balanced", "Affectionate", "Very cuddly"] },
      { source: "preferences", key: "noiseLevel", label: "Noise tolerance", scale: ["Very little", "Low", "Moderate", "High", "Very high"] },
      { source: "filters", key: "acceptSpecialNeeds", label: "Significant special-care needs", options: { yes: "Include pets rated 4-5/5", no: "Exclude pets rated 4-5/5" } },
    ],
  },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCompatibilityAnimalPhoto(animal) {
  if (!animal || typeof animal !== "object") return "";
  const candidates = [
    animal.photoURL,
    animal.photoUrl,
    animal.imageUrl,
    animal.imageURL,
    animal.image,
    animal.photo,
    animal.thumbnailUrl,
    animal.primaryPhotoUrl,
    animal.animalPhotoUrl,
    animal.pet?.photoURL,
    animal.pet?.photoUrl,
    animal.animal?.photoURL,
    animal.animal?.photoUrl,
    ...(Array.isArray(animal.photos) ? animal.photos : []),
  ];
  return candidates.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function getCompatibilityAnimalFallback(animal) {
  const species = String(animal?.species || animal?.type || "").toLowerCase();
  return species.includes("cat") ? CAT_IMAGE : DOG_IMAGE;
}

async function resolveCompatibilityAnimalPhoto(match) {
  const directPhoto = getCompatibilityAnimalPhoto(match);
  const directFallback = getCompatibilityAnimalFallback(match);
  if (directPhoto) return { src: directPhoto, fallback: directFallback };

  const animalId = String(match?.animalId || match?.petId || match?.id || "");
  if (!animalId) return { src: directFallback, fallback: directFallback };
  if (compatibilityPhotoCache.has(animalId)) return compatibilityPhotoCache.get(animalId);

  const request = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/public/pets/${encodeURIComponent(animalId)}`);
      if (!response.ok) throw new Error(`Animal photo request failed (${response.status})`);
      const data = await response.json().catch(() => ({}));
      const pet = data.pet || data.animal || data;
      const fallback = getCompatibilityAnimalFallback(pet);
      return { src: getCompatibilityAnimalPhoto(pet) || fallback, fallback };
    } catch (error) {
      console.warn("[compatibility result photo]", error.message);
      return { src: directFallback, fallback: directFallback };
    }
  })();

  compatibilityPhotoCache.set(animalId, request);
  return request;
}

function formatDate(value) {
  if (!value) return "Not available";

  const rawDate =
    typeof value === "object" && value.seconds
      ? new Date(value.seconds * 1000)
      : typeof value === "object" && value._seconds
        ? new Date(value._seconds * 1000)
        : new Date(value);

  if (Number.isNaN(rawDate.getTime())) return String(value);

  return rawDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function toDate(value) {
  if (!value) return null;
  if (typeof value === "object" && value.seconds) return new Date(value.seconds * 1000);
  if (typeof value === "object" && value._seconds) return new Date(value._seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function updateRetakeState(nextRetakeAt) {
  nextAllowedRetakeDate = startOfDay(toDate(nextRetakeAt));
  const today = startOfDay(new Date());
  const isBlocked = Boolean(nextAllowedRetakeDate && today < nextAllowedRetakeDate);

  document.querySelectorAll("[data-retake-quiz]").forEach((link) => {
    link.classList.toggle("is-disabled", isBlocked);
    link.setAttribute("aria-disabled", String(isBlocked));
    link.setAttribute(
      "title",
      isBlocked ? `You can retake the quiz on ${formatDate(nextAllowedRetakeDate)}.` : "Open the compatibility quiz"
    );
  });
}

function setAccountHeader(mode = "results") {
  if (!compatibilityAccountTitle || !compatibilityAccountAction) return;
  if (mode === "answers") {
    compatibilityAccountTitle.innerHTML = `
      <span class="compatibility-account-icon"><i class="fa-regular fa-pen-to-square"></i></span>
      <div>
        <span>Saved quiz response</span>
        <h2>Latest Quiz Answers</h2>
        <p>These are the answers you submitted in your most recent quiz.</p>
      </div>
    `;
    compatibilityAccountAction.innerHTML = `<i class="fa-solid fa-paw"></i>View Compatibility Results`;
    compatibilityAccountAction.dataset.viewResults = "true";
    delete compatibilityAccountAction.dataset.reviewAnswers;
    return;
  }

  if (mode === "fresh") {
    compatibilityAccountTitle.innerHTML = `
      <span class="compatibility-account-icon"><i class="fa-solid fa-paw"></i></span>
      <div>
        <span>Best matches</span>
        <h2>Your Recommended Animals</h2>
        <p>Ranked from the quiz answers you just submitted.</p>
      </div>
    `;
    compatibilityAccountAction.innerHTML = `<i class="fa-regular fa-pen-to-square"></i>Review Quiz Answers`;
    compatibilityAccountAction.dataset.reviewAnswers = "true";
    delete compatibilityAccountAction.dataset.viewResults;
    return;
  }

  compatibilityAccountTitle.innerHTML = `
    <span class="compatibility-account-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
    <div>
      <span>Saved recommendation</span>
      <h2>My Compatibility Result</h2>
      <p>Your latest lifestyle match and quiz history.</p>
    </div>
  `;
  compatibilityAccountAction.innerHTML = `<i class="fa-regular fa-pen-to-square"></i>Review Quiz Answers`;
  compatibilityAccountAction.dataset.reviewAnswers = "true";
  delete compatibilityAccountAction.dataset.viewResults;
}

function getFreshQuizResult() {
  const params = new URLSearchParams(window.location.search);
  const shouldUseFresh = params.get("source") === "quiz" || sessionStorage.getItem("animua_match_fresh") === "1";
  if (!shouldUseFresh) return null;

  try {
    const matches = JSON.parse(sessionStorage.getItem("animua_match_results") || "[]");
    const quizData = JSON.parse(sessionStorage.getItem("animua_quiz_data") || "{}");
    const metadata = JSON.parse(sessionStorage.getItem("animua_match_metadata") || "{}");
    if (!Array.isArray(matches)) return null;

    return {
      resultId: metadata.resultId || "latest-quiz",
      completedAt: metadata.completedAt || new Date().toISOString(),
      nextRetakeAt: metadata.nextRetakeAt || null,
      filters: quizData.filters || {},
      preferences: quizData.preferences || {},
      matches,
      isLatest: true,
      source: "fresh",
    };
  } catch (error) {
    console.warn("[fresh compatibility result]", error.message);
    return null;
  }
}

function formatQuizAnswer(item, latest) {
  const source = item.source === "filters" ? latest.filters || {} : latest.preferences || {};
  const raw = source[item.key];
  if (raw === undefined || raw === null || raw === "") return "Not answered";
  if (item.options) return item.options[String(raw).toLowerCase()] || String(raw);
  if (item.scale) {
    const index = Number(raw) - 1;
    return item.scale[index] || String(raw);
  }
  return String(raw);
}

function renderQuizAnswers(results) {
  const latest = results.find((item) => item.isLatest) || results[0];
  if (!latest || !compatibilityAccountBody) return;
  setAccountHeader("answers");

  const sections = answerSections
    .map((section, index) => {
      const answers = section.items
        .map(
          (item) => `
            <article class="quiz-answer-card">
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(formatQuizAnswer(item, latest))}</strong>
            </article>
          `
        )
        .join("");

      return `
        <section class="quiz-answer-section">
          <div class="quiz-answer-section-head">
            <span><i class="fa-solid ${section.icon}"></i></span>
            <h3>${index + 1}. ${escapeHtml(section.title)}</h3>
          </div>
          <div class="quiz-answer-grid">${answers}</div>
        </section>
      `;
    })
    .join("");

  compatibilityAccountBody.innerHTML = `
    <div class="quiz-answers-box">
      ${sections}
    </div>
    <div class="quiz-answers-footer">
      <span class="quiz-answers-info"><i class="fa-solid fa-info"></i></span>
      <p>These are the answers used to generate your latest compatibility result. You may retake the quiz when the retake date becomes available.</p>
      <button type="button" data-view-results><i class="fa-solid fa-paw"></i>View Compatibility Results</button>
    </div>
  `;
  updateRetakeState(latest.nextRetakeAt);
}

function renderEmpty(message, actionText = "Take the quiz") {
  if (!compatibilityAccountBody) return;
  if (compatibilityCompletedDate) compatibilityCompletedDate.textContent = "Not available";
  if (compatibilityRetakeDate) compatibilityRetakeDate.textContent = "Not available";
  updateRetakeState(null);
  compatibilityAccountBody.innerHTML = `
    <div class="compatibility-empty">
      <i class="fa-solid fa-paw"></i>
      <h3>${escapeHtml(message)}</h3>
      <a href="petCompatibility.html">${escapeHtml(actionText)}</a>
    </div>
  `;
}

async function renderResults(results, mode = "saved") {
  loadedResults = results;
  currentResultsMode = mode;
  setAccountHeader(mode === "fresh" ? "fresh" : "results");
  const latest = results.find((item) => item.isLatest) || results[0];
  if (compatibilityCompletedDate) compatibilityCompletedDate.textContent = formatDate(latest.completedAt);
  if (compatibilityRetakeDate) compatibilityRetakeDate.textContent = formatDate(latest.nextRetakeAt);
  updateRetakeState(latest.nextRetakeAt);

  const matches = (await Promise.all((latest.matches || [])
    .slice(0, 5)
    .map(async (match, index) => {
      const score = Number(match.compatibilityPercent ?? match.matchPercent ?? match.score ?? 0);
      const animalId = match.animalId || match.petId || match.id || "";
      const animalName =
        match.animalName ||
        match.displayLabel ||
        match.shelterLabel ||
        match.identifyingDescription ||
        match.name ||
        "Shelter animal";
      const subtitle = index === 0
        ? "Best match for your profile"
        : "Recommended match";
      const photo = await resolveCompatibilityAnimalPhoto(match);
      return `
        <li class="${index === 0 ? "is-top-match" : ""}">
          <span class="compatibility-rank" aria-label="Rank ${index + 1}">${index + 1}</span>
          <div class="compatibility-photo-wrap">
            <img class="compatibility-pet-photo" src="${escapeHtml(photo.src)}" data-fallback-photo="${escapeHtml(photo.fallback)}" data-match-photo alt="${escapeHtml(animalName)}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async">
            ${index === 0 ? '<span class="compatibility-top-chip"><i class="fa-solid fa-star"></i>Top match</span>' : ""}
          </div>
          <div class="compatibility-pet-copy">
            <strong>${escapeHtml(animalName)}</strong>
            <small>${escapeHtml(subtitle)}</small>
          </div>
          <span class="compatibility-score" aria-label="${score.toFixed(1)} percent compatibility">${score.toFixed(1)}%</span>
          <button class="compatibility-view-pet" type="button" data-saved-animal-id="${escapeHtml(animalId)}" data-saved-animal-name="${escapeHtml(animalName)}" data-saved-animal-score="${score.toFixed(1)}">
            <i class="fa-regular fa-eye"></i>
            <span>View details</span>
          </button>
        </li>
      `;
    }))).join("");

  const history = results
    .slice(1)
    .map((item) => `<li>${formatDate(item.completedAt)} <small>${escapeHtml(item.resultId)}</small></li>`)
    .join("");

  compatibilityAccountBody.innerHTML = `
    <div class="compatibility-result-grid">
      <section class="compatibility-recommendations-section">
        <div class="compatibility-section-title">
          <span>Ranked for you</span>
          <h3>Top recommended animals</h3>
          <p>Your closest matches based on the preferences from your latest quiz.</p>
        </div>
        <ol class="compatibility-matches">${matches || "<li>No animals matched the selected filters.</li>"}</ol>
      </section>
    </div>
    ${history ? `<details><summary>Previous result history (${results.length - 1})</summary><ul>${history}</ul></details>` : ""}
  `;

  compatibilityAccountBody.querySelectorAll("[data-match-photo]").forEach((image) => {
    image.addEventListener("error", () => {
      const fallback = image.dataset.fallbackPhoto;
      if (fallback && image.src !== fallback) image.src = fallback;
    }, { once: true });
  });
}

async function showSavedAnimalDetails(button) {
  const Swal = await getSwal();
  const animalId = button.dataset.savedAnimalId || "";
  const savedName = button.dataset.savedAnimalName || "Shelter animal";
  const savedScore = button.dataset.savedAnimalScore || "0.0";
  const latest = loadedResults.find((item) => item.isLatest) || loadedResults[0] || {};
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
  const meta = pet ? [pet.sex, pet.species, pet.ageEstimate].filter(Boolean).join(" • ") : "Historical recommendation";
  const image = pet?.photoURL || (String(pet?.species || "").toLowerCase() === "cat" ? CAT_IMAGE : DOG_IMAGE);
  const traitSource = pet?.behavioralAssessment && typeof pet.behavioralAssessment === "object" ? pet.behavioralAssessment : latest.preferences || {};
  const traitRows = matchDetailTraits
    .map(({ key, icon }) => {
      const numericValue = Number(traitSource[key] ?? latest.preferences?.[key] ?? 0);
      const value = Number.isFinite(numericValue) ? Math.max(0, Math.min(5, numericValue)) : 0;
      const amount = value * 20;
      return `
        <article class="match-detail-trait">
          <span class="match-detail-trait-icon"><i class="fa-solid ${icon}"></i></span>
          <strong>${escapeHtml(traitLabels[key] || key)}</strong>
          <div class="match-detail-track"><i style="width:${amount}%"></i></div>
          <b>${escapeHtml(value || "N/A")}${value ? "<small>/5</small>" : ""}</b>
        </article>
      `;
    })
    .join("");

  await Swal.fire({
    html: `
      <section class="match-detail-modal">
        <header class="match-detail-head">
          <div>
            <h2>Match Details</h2>
            <p>Here's why this pet is a great match for you.</p>
          </div>
          <button type="button" data-close-saved-animal aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        </header>
        <div class="match-detail-hero">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(name)}">
          <div>
            <h2>${escapeHtml(name)}</h2>
            <p>${escapeHtml(meta)}</p>
            <span class="match-detail-score">${escapeHtml(savedScore)}% Match</span>
            <small>${pet ? "Best match for your profile" : "Saved historical recommendation"}</small>
          </div>
        </div>
        <section class="match-detail-traits">
          <h3>Why ${escapeHtml(name)} matches you</h3>
          <div>${traitRows}</div>
        </section>
        <aside class="match-detail-note">
          <i class="fa-solid fa-info"></i>
          <p>This match is based on your quiz answers and the pet's recorded traits. It is a guide to help you find the best companion.</p>
        </aside>
        <footer class="match-detail-actions">
          ${pet ? `<a href="find-furbabies.html" data-open-saved-animal>View Full Profile <i class="fa-solid fa-arrow-right"></i></a>` : ""}
        </footer>
      </section>
    `,
    showConfirmButton: false,
    width: "min(620px, calc(100vw - 28px))",
    padding: 0,
    background: "transparent",
    customClass: { popup: "saved-animal-popup" },
    didOpen: (popup) => {
      popup.querySelectorAll("[data-close-saved-animal]").forEach((item) => item.addEventListener("click", () => Swal.close()));
      popup.querySelector("[data-open-saved-animal]")?.addEventListener("click", () => {
        sessionStorage.setItem("animua_selected_pet_id", animalId);
        sessionStorage.setItem("animua_selected_pet_action", "view");
      });
    },
  });
}

async function loadCompatibilityAccount() {
  const freshResult = getFreshQuizResult();
  if (freshResult) {
    await renderResults([freshResult], "fresh");
    sessionStorage.removeItem("animua_match_fresh");
    return;
  }

  await ensureUserSession();
  if (!hasUserSession()) {
    renderEmpty("Log in to view your saved compatibility result.", "Go to login");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/match/my-results`, {
      credentials: "include",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Unable to load compatibility results.");

    const results = data.results || [];
    if (!results.length) {
      renderEmpty("You have not completed the compatibility quiz yet.");
      return;
    }

    loadedResults = results;
    await renderResults(results, "saved");
  } catch (error) {
    renderEmpty(error.message || "Unable to load compatibility results.", "Try the quiz");
  }
}

compatibilityAccountBody?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-saved-animal-id]");
  if (button) showSavedAnimalDetails(button);

  if (event.target.closest("[data-view-results]")) {
    await renderResults(loadedResults, currentResultsMode);
  }
});

compatibilityAccountAction?.addEventListener("click", async (event) => {
  event.preventDefault();
  if (event.currentTarget.dataset.viewResults) {
    await renderResults(loadedResults, currentResultsMode);
    return;
  }
  renderQuizAnswers(loadedResults);
});

document.addEventListener("click", async (event) => {
  const retakeLink = event.target.closest("[data-retake-quiz]");
  if (!retakeLink) return;

  const today = startOfDay(new Date());
  if (!nextAllowedRetakeDate || today >= nextAllowedRetakeDate) return;

  event.preventDefault();
  const Swal = await getSwal();
  await Swal.fire({
    icon: "warning",
    title: "Retake Not Available Yet",
    text: `You can retake the compatibility quiz on ${formatDate(nextAllowedRetakeDate)}.`,
    confirmButtonText: "OK",
    customClass: {
      popup: "animua-popup",
      confirmButton: "animua-confirm",
    },
    buttonsStyling: false,
  });
});

loadCompatibilityAccount();
