import Swal from "sweetalert2";
import { API_BASE_URL } from "../../utils/api.js";

const DOG_IMAGE = new URL("../../assets/images/dog.jpg", import.meta.url).href;
const CAT_IMAGE = new URL("../../assets/images/cat.jpg", import.meta.url).href;

const compatibilityAccountBody = document.getElementById("compatibilityAccountBody");

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

function getToken() {
  return localStorage.getItem("animua_token") || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function renderEmpty(message, actionText = "Take the quiz") {
  if (!compatibilityAccountBody) return;
  compatibilityAccountBody.innerHTML = `
    <div class="compatibility-empty">
      <i class="fa-solid fa-paw"></i>
      <h3>${escapeHtml(message)}</h3>
      <a href="petCompatibility.html">${escapeHtml(actionText)}</a>
    </div>
  `;
}

function renderResults(results) {
  const latest = results.find((item) => item.isLatest) || results[0];
  const traits = Object.entries(latest.preferences || {})
    .map(([key, value]) => {
      const amount = Math.max(0, Math.min(100, Number(value) * 20));
      return `
        <article class="compatibility-trait">
          <div>
            <strong>${escapeHtml(traitLabels[key] || key)}</strong>
            <span>${escapeHtml(value)}<small>/5</small></span>
          </div>
          <div class="compatibility-trait-track"><i style="width:${amount}%"></i></div>
        </article>
      `;
    })
    .join("");

  const matches = (latest.matches || [])
    .slice(0, 5)
    .map((match, index) => {
      const score = Number(match.compatibilityPercent || 0);
      return `
        <li class="${index === 0 ? "is-top-match" : ""}">
          <span class="compatibility-rank">${index + 1}</span>
          <span class="compatibility-pet-icon"><i class="fa-solid fa-paw"></i></span>
          <div>
            <strong>${escapeHtml(match.animalName || "Shelter animal")}</strong>
            <small>${index === 0 ? "Best match for your profile" : "Saved recommendation"}</small>
          </div>
          <span class="compatibility-score">${score.toFixed(1)}%</span>
          <button class="compatibility-view-pet" type="button" data-saved-animal-id="${escapeHtml(match.animalId || "")}" data-saved-animal-name="${escapeHtml(match.animalName || "Shelter animal")}" data-saved-animal-score="${score.toFixed(1)}">
            <i class="fa-regular fa-eye"></i>
            <span>Details</span>
          </button>
        </li>
      `;
    })
    .join("");

  const history = results
    .slice(1)
    .map((item) => `<li>${formatDate(item.completedAt)} <small>${escapeHtml(item.resultId)}</small></li>`)
    .join("");

  compatibilityAccountBody.innerHTML = `
    <div class="compatibility-dates">
      <article>
        <span><i class="fa-regular fa-circle-check"></i></span>
        <div><small>Quiz completed</small><strong>${formatDate(latest.completedAt)}</strong></div>
      </article>
      <article>
        <span><i class="fa-regular fa-calendar"></i></span>
        <div><small>Next allowed retake</small><strong>${formatDate(latest.nextRetakeAt)}</strong></div>
      </article>
    </div>
    <div class="compatibility-result-grid">
      <section>
        <div class="compatibility-section-title">
          <span>Your profile</span>
          <h3>Compatibility traits</h3>
        </div>
        <div class="compatibility-traits">${traits || "<p>No trait profile saved yet.</p>"}</div>
      </section>
      <section>
        <div class="compatibility-section-title">
          <span>Ranked for you</span>
          <h3>Top recommended animals</h3>
        </div>
        <ol class="compatibility-matches">${matches || "<li>No animals matched the selected filters.</li>"}</ol>
      </section>
    </div>
    ${history ? `<details><summary>Previous result history (${results.length - 1})</summary><ul>${history}</ul></details>` : ""}
  `;
}

async function showSavedAnimalDetails(button) {
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
  const meta = pet ? [pet.species, pet.breed, pet.sex, pet.ageEstimate].filter(Boolean).join(" - ") : "Historical recommendation";
  const notes = pet?.conditionNotes || pet?.initialCondition || (pet ? "Ready to meet adopters and find a safe, caring home." : "This animal is no longer publicly available, but the saved recommendation remains part of your quiz history.");
  const image = pet?.photoURL || (String(pet?.species || "").toLowerCase() === "cat" ? CAT_IMAGE : DOG_IMAGE);

  await Swal.fire({
    html: `
      <section class="saved-animal-modal">
        <header>
          <span>Saved recommendation</span>
          <button type="button" data-close-saved-animal aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        </header>
        <div class="saved-animal-hero">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(name)}">
          <div>
            <span class="saved-animal-score">${escapeHtml(savedScore)}% match</span>
            <h2>${escapeHtml(name)}</h2>
            <p>${escapeHtml(meta)}</p>
            ${pet ? `<span class="saved-animal-status"><i class="fa-solid fa-circle-check"></i>${escapeHtml(pet.status || "Ready")}</span>` : `<span class="saved-animal-status unavailable"><i class="fa-solid fa-clock-rotate-left"></i>Historical record</span>`}
          </div>
        </div>
        <div class="saved-animal-copy">
          <h3>About this recommendation</h3>
          <p>${escapeHtml(notes)}</p>
        </div>
        <footer>
          <button type="button" data-close-saved-animal>Close</button>
          ${pet ? `<a href="find-furbabies.html" data-open-saved-animal>View in Find Furbabies</a>` : ""}
        </footer>
      </section>
    `,
    showConfirmButton: false,
    width: "min(560px, calc(100vw - 28px))",
    padding: 0,
    background: "transparent",
    customClass: { popup: "saved-animal-popup" },
    didOpen: (popup) => {
      popup.querySelectorAll("[data-close-saved-animal]").forEach((item) => item.addEventListener("click", () => Swal.close()));
      popup.querySelector("[data-open-saved-animal]")?.addEventListener("click", () => {
        localStorage.setItem("animua_selected_pet_id", animalId);
        localStorage.setItem("animua_selected_pet_action", "view");
      });
    },
  });
}

async function loadCompatibilityAccount() {
  const token = getToken();
  if (!token) {
    renderEmpty("Log in to view your saved compatibility result.", "Go to login");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/match/my-results`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Unable to load compatibility results.");

    const results = data.results || [];
    if (!results.length) {
      renderEmpty("You have not completed the compatibility quiz yet.");
      return;
    }

    renderResults(results);
  } catch (error) {
    renderEmpty(error.message || "Unable to load compatibility results.", "Try the quiz");
  }
}

compatibilityAccountBody?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-saved-animal-id]");
  if (button) showSavedAnimalDetails(button);
});

loadCompatibilityAccount();
