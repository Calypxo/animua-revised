document.addEventListener("DOMContentLoaded", () => {
  const resultsContainer = document.getElementById("results-container");
  if (!resultsContainer) return;

  const savedResults =
    JSON.parse(localStorage.getItem("animua_match_results")) || [];

  if (!savedResults.length) {
    resultsContainer.innerHTML = `
      <div style="padding:20px; border:1px solid #ddd; border-radius:16px; background:#fff3cd;">
        No compatibility results found. Please take the quiz first.
      </div>
    `;
    return;
  }

  const topResults = savedResults.slice(0, 5);

  resultsContainer.innerHTML = topResults
    .map((pet) => {
      const summary = buildMatchSummary(pet);

      return `
        <article class="result-card">
          <div class="result-card-body">
            <div class="result-top">
              <div>
                <h2 class="result-name">${pet.name}</h2>
                <p class="result-breed">${pet.breed || "Mixed Breed"} • ${pet.species}</p>
              </div>
              <div class="match-badge">${pet.matchPercent}% Match</div>
            </div>

            <div class="result-info">
              <div class="info-box">
                <div class="info-label">Species</div>
                <div class="info-value">${pet.species || "N/A"}</div>
              </div>
              <div class="info-box">
                <div class="info-label">Sex</div>
                <div class="info-value">${pet.sex || "N/A"}</div>
              </div>
              <div class="info-box">
                <div class="info-label">Size</div>
                <div class="info-value">${pet.size || "N/A"}</div>
              </div>
              <div class="info-box">
                <div class="info-label">Status</div>
                <div class="info-value">${pet.status || "N/A"}</div>
              </div>
            </div>

            <div class="result-summary">
              ${summary}
            </div>

            <div class="result-actions">
              <button class="btn-soft view-btn" data-pet-id="${pet.id || pet.petId}">
                View Profile
              </button>
              <button class="btn-primary-match adopt-btn" data-pet-id="${pet.id || pet.petId}">
                Adopt Now
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  attachAdoptButtons();
  attachViewButtons();
});

function buildMatchSummary(pet) {
  const traits = [];

  if (pet.affectionLevel >= 4) traits.push("affectionate");
  if (pet.playfulness >= 4) traits.push("playful");
  if (pet.goodWithKids >= 4) traits.push("good with kids");
  if (pet.goodWithOtherPets >= 4) traits.push("good with other pets");
  if (pet.groomingNeeds <= 2) traits.push("low-maintenance grooming");
  if (pet.noiseLevel <= 2) traits.push("relatively quiet");

  if (!traits.length) {
    return `${pet.name} is one of the strongest compatibility matches based on the selected lifestyle and preference answers.`;
  }

  return `${pet.name} is a strong match because this pet is ${traits.join(", ")}.`;
}

function attachAdoptButtons() {
  const buttons = document.querySelectorAll(".adopt-btn");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const petId = button.dataset.petId;
      localStorage.setItem("animua_selected_pet_id", petId);

      const token = localStorage.getItem("animua_token");

      if (!token) {
        window.location.href = "/index.html";
        return;
      }

      window.location.href = "/pages/public/find-furbabies.html";
    });
  });
}

function attachViewButtons() {
  const buttons = document.querySelectorAll(".view-btn");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const petId = button.dataset.petId;
      localStorage.setItem("animua_selected_pet_id", petId);
      window.location.href = "/pages/public/find-furbabies.html";
    });
  });
}