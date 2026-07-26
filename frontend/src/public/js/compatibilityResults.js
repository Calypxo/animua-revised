// /src/public/js/compatibilityResults.js
// ─────────────────────────────────────────────────────
// NOTE: The new compatibilityResults.html has ALL logic
// inline and does NOT import this file anymore.
//
// This file is kept only for backward compatibility.
// If you haven't updated the HTML yet, this will still
// render the results — but without the new design.
// Update the HTML first, then you can delete this file.
// ─────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // If the new inline script already ran and rendered content, do nothing.
  const shell = document.getElementById("resultsShell");
  if (!shell) return;
  if (shell.querySelector(".results-hero, .results-grid, .no-results")) {
    console.log("[compatibilityResults.js] New inline renderer already active — skipping.");
    return;
  }

  // ── Fallback render (old design) ─────────────────────
  let savedResults = [];
  try { savedResults = JSON.parse(localStorage.getItem("animua_match_results")) || []; }
  catch (e) { console.error("Failed to parse results:", e); }

  if (!savedResults.length) {
    shell.innerHTML = `<div style="padding:20px;border:1px solid #ddd;border-radius:16px;background:#fff3cd;">
      No compatibility results found. Please take the quiz first.</div>`;
    return;
  }

  const topResults = savedResults.slice(0, 5);

  shell.innerHTML = topResults.map(pet => {
    const displayLabel =
      pet.displayLabel ||
      pet.shelterLabel ||
      pet.identifyingDescription ||
      pet.name ||
      `Animal ${pet.id || pet.petId || ""}`.trim();
    const traits = [];
    if (Number(pet.affectionLevel)    >= 4) traits.push("affectionate");
    if (Number(pet.playfulness)       >= 4) traits.push("playful");
    if (Number(pet.goodWithKids)      >= 4) traits.push("good with kids");
    if (Number(pet.goodWithOtherPets) >= 4) traits.push("good with other pets");
    if (Number(pet.groomingNeeds) > 0 && Number(pet.groomingNeeds) <= 2) traits.push("low-maintenance grooming");
    if (Number(pet.noiseLevel)    > 0 && Number(pet.noiseLevel)    <= 2) traits.push("relatively quiet");
    const summary = traits.length
      ? `${displayLabel} is a strong match because this animal is ${traits.join(", ")}.`
      : `${displayLabel} is one of the strongest compatibility matches based on your answers.`;

    return `
      <article class="result-card" style="background:#fff;border:1px solid #e5e7eb;border-radius:22px;padding:22px;margin-bottom:16px;box-shadow:0 4px 16px rgba(0,0,0,0.05)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;flex-wrap:wrap">
          <div>
            <h2 style="font-size:1.3rem;font-weight:800;margin-bottom:4px">${displayLabel}</h2>
            <p style="color:#9ca3af;font-size:0.76rem;margin-bottom:2px">Shelter description</p>
            <p style="color:#6b7280;font-size:0.875rem">${pet.breed || "Mixed Breed"} · ${pet.species || "Pet"}</p>
          </div>
          <div style="background:rgba(87,134,188,0.1);color:#2558a8;border:1px solid rgba(87,134,188,0.2);border-radius:999px;padding:8px 14px;font-weight:700;white-space:nowrap">
            ${Math.round(Number(pet.matchPercent || 0))}% Match
          </div>
        </div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;font-size:0.84rem;color:#6b7280;line-height:1.65;margin-bottom:14px">${summary}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="view-btn" data-pet-id="${pet.id||pet.petId||""}"
            style="padding:9px 16px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;font-weight:600;cursor:pointer">
            View Profile
          </button>
          <button class="adopt-btn" data-pet-id="${pet.id||pet.petId||""}"
            style="padding:9px 16px;background:#6f191c;color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer">
            Adopt Now
          </button>
        </div>
      </article>`;
  }).join("");

  // Attach handlers
  shell.querySelectorAll(".adopt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      localStorage.setItem("animua_selected_pet_id", btn.dataset.petId);
      if (!localStorage.getItem("animua_token")) { window.location.href = "/index.html"; return; }
      window.location.href = "/pages/public/find-furbabies.html";
    });
  });
  shell.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      localStorage.setItem("animua_selected_pet_id", btn.dataset.petId);
      window.location.href = "/pages/public/find-furbabies.html";
    });
  });
});
