import "../css/management/admin-dashboard.css";
import "../css/management/sidebar.css";
import "../css/management/animalRecords.css";

import Swal from "sweetalert2";
import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { compatFields, mockPets } from "../data/petCompatibilitySchema.js";

window.Swal = Swal;

let pets = [...mockPets];
let displayedPets = [...mockPets];
let editingId = null;
let currentPhotoBase64 = null;

const speciesEmoji = { Dog: "🐕", Cat: "🐈", Bird: "🐦", Rabbit: "🐰", Other: "🐾" };
const speciesClass = { Dog: "em-dog", Cat: "em-cat", Bird: "em-bird", Rabbit: "em-rabbit", Other: "em-other" };
const speciesBadge = { Dog: "b-dog", Cat: "b-cat", Bird: "b-bird", Rabbit: "b-rabbit", Other: "b-other" };
const sexBadge = { Male: "b-male", Female: "b-female" };
const sizeBadge = { Small: "b-small", Medium: "b-medium", Large: "b-large", "X-Large": "b-xl" };

function flagsHtml(flags) {
  let out = "";
  if (flags?.allergyFriendly) out += `<span class="badge b-allergy">Allergy-Friendly</span>`;
  if (flags?.aggressive) out += `<span class="badge b-aggro">Aggressive</span>`;
  if (flags?.specialNeeds) out += `<span class="badge b-special">Special Needs</span>`;
  return out || `<span style="color:var(--txt-g);font-size:0.72rem;">—</span>`;
}

function renderTable(data) {
  const tbody = document.getElementById("petTableBody");
  const petCount = document.getElementById("petCount");
  const pageInfo = document.getElementById("pageInfo");

  if (!data.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align:center;padding:48px 20px;">
          <div style="color:var(--txt-g);font-size:1.8rem;margin-bottom:8px;">🐾</div>
          <div style="font-size:0.83rem;color:var(--txt-m);">No pets found matching your filters.</div>
        </td>
      </tr>
    `;
    petCount.textContent = "0";
    pageInfo.textContent = "No results";
    return;
  }

  tbody.innerHTML = data.map((pet, index) => `
    <tr style="animation:fadeUp .35s ${index * 0.04}s cubic-bezier(0.16,1,0.3,1) both;">
      <td>
        <div class="pet-cell">
          <div class="pet-emoji ${speciesClass[pet.species] || "em-other"}">${speciesEmoji[pet.species] || "🐾"}</div>
          <div>
            <div class="pet-name">${pet.name}</div>
            <div class="pet-id-tag">#PET-${String(pet.petId).padStart(4, "0")}</div>
          </div>
        </div>
      </td>
      <td><span class="badge ${speciesBadge[pet.species] || "b-other"}">${pet.species}</span></td>
      <td><span class="badge b-breed">${pet.breed}</span></td>
      <td><span class="badge ${sexBadge[pet.sex] || ""}">${pet.sex}</span></td>
      <td>${pet.age || "—"} yrs</td>
      <td><span class="badge ${sizeBadge[pet.size] || ""}">${pet.size || "—"}</span></td>
      <td>${pet.barangay || "—"}</td>
      <td>${pet.coatColor || "—"}</td>
      <td>${pet.weightKg ? `${pet.weightKg} kg` : "—"}</td>
      <td><span class="badge b-breed">${pet.status || "Available"}</span></td>
      <td>
        <div class="act-btns" style="justify-content:center;">
          <button class="btn-act view" type="button" data-action="view" data-id="${pet.petId}">
            <i class="bi bi-eye-fill"></i>
          </button>
          <button class="btn-act edit" type="button" data-action="edit" data-id="${pet.petId}">
            <i class="bi bi-pencil-fill"></i>
          </button>
          <button class="btn-act delete" type="button" data-action="delete" data-id="${pet.petId}">
            <i class="bi bi-trash-fill"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  petCount.textContent = String(data.length);
  pageInfo.textContent = `Showing 1–${data.length} of ${data.length} pet${data.length !== 1 ? "s" : ""}`;
}

function buildCompatGrid(values = {}) {
  const grid = document.getElementById("compatGrid");

  grid.innerHTML = compatFields.map((field) => {
    const value = values[field.id] ?? 3;
    const pct = `${((value - 1) / 4) * 100}%`;

    return `
      <div class="form-group">
        <label class="form-label">${field.label}</label>
        <div class="slider-row">
          <input
            type="range"
            class="form-slider compat-slider"
            id="s_${field.id}"
            min="1"
            max="5"
            value="${value}"
            style="--pct:${pct}"
            data-field="${field.id}"
          />
          <div class="slider-badge" id="sv_${field.id}">${value}</div>
        </div>
        <div class="slider-hints">
          <span>${field.low}</span>
          <span>${field.high}</span>
        </div>
      </div>
    `;
  }).join("");
}

function applyFilters() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const species = document.getElementById("filterSpecies").value;
  const sex = document.getElementById("filterSex").value;
  const size = document.getElementById("filterSize").value;

  displayedPets = pets.filter((pet) => {
    const text = `${pet.name} ${pet.species} ${pet.breed} ${pet.coatColor}`.toLowerCase();

    return (
      (!q || text.includes(q)) &&
      (!species || pet.species === species) &&
      (!sex || pet.sex === sex) &&
      (!size || pet.size === size)
    );
  });

  renderTable(displayedPets);
}

function toggleSection(sectionId) {
  document.getElementById(sectionId)?.classList.toggle("open");
}

function openModal(mode, pet = null) {
  editingId = pet ? pet.petId : null;

  const modalHeader = document.getElementById("petModalHeader");
  const modalModeBadge = document.getElementById("modalModeBadge");
  const modalTitle = document.getElementById("modalTitle");
  const modalDesc = document.getElementById("modalDesc");
  const recordMetaStrip = document.getElementById("recordMetaStrip");
  const recordMetaId = document.getElementById("recordMetaId");
  const recordMetaMode = document.getElementById("recordMetaMode");
  const recordMetaStatus = document.getElementById("recordMetaStatus");
  const btnSave = document.getElementById("btnSave");

  const isEdit = mode === "edit";

  if (modalHeader) modalHeader.classList.toggle("edit-mode", isEdit);
  if (btnSave) btnSave.classList.toggle("edit-save", isEdit);

  if (isEdit && pet) {
    if (modalModeBadge) {
      modalModeBadge.innerHTML = `<i class="bi bi-pencil-square"></i> Edit Mode`;
    }
    if (modalTitle) {
      modalTitle.textContent = `Edit — ${pet.name}`;
    }
    if (modalDesc) {
      modalDesc.textContent = `Update this pet's profile, physical traits, and compatibility dimensions.`;
    }
    if (btnSave) {
      btnSave.innerHTML = `<i class="bi bi-check2-circle"></i> Update Pet Profile`;
    }

    if (recordMetaStrip) recordMetaStrip.style.display = "grid";
    if (recordMetaId) {
      recordMetaId.textContent = `#PET-${String(pet.petId).padStart(4, "0")}`;
    }
    if (recordMetaMode) {
      recordMetaMode.textContent = "Editing Existing Record";
    }
    if (recordMetaStatus) {
      recordMetaStatus.textContent = pet.status || "Available";
    }
  } else {
    if (modalModeBadge) {
      modalModeBadge.innerHTML = `<i class="bi bi-plus-circle-fill"></i> Add Mode`;
    }
    if (modalTitle) {
      modalTitle.textContent = "Add New Pet";
    }
    if (modalDesc) {
      modalDesc.textContent = "Fill in the animal profile and compatibility dimensions.";
    }
    if (btnSave) {
      btnSave.innerHTML = `<i class="bi bi-check-lg"></i> Save Pet Profile`;
    }

    if (recordMetaStrip) recordMetaStrip.style.display = "none";
  }

  document.getElementById("fName").value = pet?.name || "";
  document.getElementById("fSpeciesForm").value = pet?.species || "";
  document.getElementById("fBreed").value = pet?.breed || "";
  document.getElementById("fSexForm").value = pet?.sex || "";
  document.getElementById("fAge").value = pet?.age || "";
  document.getElementById("formSize").value = pet?.size || "";
  document.getElementById("fBarangay").value = pet?.barangay || "";
  document.getElementById("fColor").value = pet?.coatColor || "";
  document.getElementById("fColor2").value = pet?.secondaryColor || "";
  document.getElementById("fWeight").value = pet?.weightKg || "";
  document.getElementById("fHeight").value = pet?.heightCm || "";
  document.getElementById("fDistinct").value = pet?.distinctFeatures || "";
  document.getElementById("fAllergy").checked = pet?.flags?.allergyFriendly || false;
  document.getElementById("fAggressive").checked = pet?.flags?.aggressive || false;
  document.getElementById("fSpecialNeeds").checked = pet?.flags?.specialNeeds || false;

  buildCompatGrid(pet?.compatibility || {});
  resetPhoto(pet?.photoUrl || null);

  document.querySelectorAll(".form-group.has-err").forEach((group) => {
    group.classList.remove("has-err");
  });

  document.getElementById("petModal").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("petModal").classList.remove("open");
  document.body.style.overflow = "";
  editingId = null;
}

function resetPhoto(existingUrl = null) {
  const photoInput = document.getElementById("fPhoto");
  const photoPreview = document.getElementById("photoPreview");
  const btnRemovePhoto = document.getElementById("btnRemovePhoto");

  currentPhotoBase64 = existingUrl || null;
  photoInput.value = "";

  if (existingUrl) {
    photoPreview.innerHTML = `<img src="${existingUrl}" alt="Pet photo" />`;
    btnRemovePhoto.style.display = "flex";
  } else {
    photoPreview.innerHTML = `
      <i class="bi bi-camera-fill photo-placeholder-icon"></i>
      <span class="photo-placeholder-text">No photo yet</span>
    `;
    btnRemovePhoto.style.display = "none";
  }
}

function savePet() {
  const required = ["fName", "fSpeciesForm", "fBreed", "fSexForm", "fBarangay"];
  let isValid = true;

  required.forEach((id) => {
    const el = document.getElementById(id);
    const group = el.closest(".form-group");

    if (!String(el.value).trim()) {
      group.classList.add("has-err");
      isValid = false;
    } else {
      group.classList.remove("has-err");
    }
  });

  if (!isValid) {
    document.getElementById("secBasic").classList.add("open");
    return;
  }

  const compatibility = {};
  compatFields.forEach((field) => {
    compatibility[field.id] = Number(document.getElementById(`s_${field.id}`).value);
  });

  const petData = {
    petId: editingId ?? (pets.length ? Math.max(...pets.map((p) => p.petId)) + 1 : 1),
    name: document.getElementById("fName").value.trim(),
    species: document.getElementById("fSpeciesForm").value,
    breed: document.getElementById("fBreed").value.trim(),
    sex: document.getElementById("fSexForm").value,
    age: Number(document.getElementById("fAge").value) || 0,
    size: document.getElementById("formSize").value,
    barangay: document.getElementById("fBarangay").value,
    coatColor: document.getElementById("fColor").value.trim(),
    secondaryColor: document.getElementById("fColor2").value.trim(),
    weightKg: Number(document.getElementById("fWeight").value) || 0,
    heightCm: Number(document.getElementById("fHeight").value) || 0,
    distinctFeatures: document.getElementById("fDistinct").value.trim(),
    photoUrl: currentPhotoBase64,
    status: "Available",
    compatibility,
    flags: {
      allergyFriendly: document.getElementById("fAllergy").checked,
      aggressive: document.getElementById("fAggressive").checked,
      specialNeeds: document.getElementById("fSpecialNeeds").checked,
    },
  };

  if (editingId) {
    const index = pets.findIndex((pet) => pet.petId === editingId);
    if (index > -1) pets[index] = petData;
  } else {
    pets.push(petData);
  }

  closeModal();
  applyFilters();
}

function bindEvents() {
  document.getElementById("btnAddPet").addEventListener("click", () => openModal("add"));
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("btnCancel").addEventListener("click", closeModal);
  document.getElementById("btnSave").addEventListener("click", savePet);

  document.getElementById("petModal").addEventListener("click", (event) => {
    if (event.target.id === "petModal") closeModal();
  });

  ["searchInput", "filterSpecies", "filterSex", "filterSize"].forEach((id) => {
    document.getElementById(id).addEventListener("input", applyFilters);
    document.getElementById(id).addEventListener("change", applyFilters);
  });

  document.addEventListener("click", async (event) => {
    const toggle = event.target.closest("[data-section-toggle]");
    if (toggle) {
      toggleSection(toggle.dataset.sectionToggle);
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const petId = Number(actionButton.dataset.id);
    const action = actionButton.dataset.action;
    const pet = pets.find((item) => item.petId === petId);

    if (!pet) return;

    if (action === "view") {
  const compatibilityChips = pet.compatibility
    ? Object.entries(pet.compatibility)
    .slice(0, 8)
        .map(([key, value]) => {
          const label = key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (s) => s.toUpperCase());

          return `
            <div class="pet-detail-chip">
              <span class="chip-label">${label}</span>
              <span class="chip-value">${value}/5</span>
            </div>
          `;
        })
        .join("")
    : `<div class="pet-empty">No compatibility data available.</div>`;

  const flags = [];
  if (pet.flags?.allergyFriendly) flags.push("Allergy-Friendly");
  if (pet.flags?.aggressive) flags.push("Aggressive");
  if (pet.flags?.specialNeeds) flags.push("Special Needs");

  const petPhoto = pet.photoUrl
    ? `<img src="${pet.photoUrl}" alt="${pet.name}" class="pet-detail-photo" />`
    : `
      <div class="pet-detail-photo placeholder">
        <span>${speciesEmoji[pet.species] || "🐾"}</span>
      </div>
    `;

  await Swal.fire({
    width: 900,
    showConfirmButton: true,
    confirmButtonText: "Close",
    confirmButtonColor: "#5786BC",
    customClass: {
      popup: "pet-detail-popup",
      confirmButton: "pet-detail-confirm"
    },
    html: `
      <div class="pet-detail-modal">
        <div class="pet-detail-top">
          <div class="pet-detail-visual">
            ${petPhoto}
          </div>

          <div class="pet-detail-main">
            <div class="pet-detail-badges">
              <span class="badge ${speciesBadge[pet.species] || "b-other"}">${pet.species}</span>
              <span class="badge ${sexBadge[pet.sex] || ""}">${pet.sex}</span>
              <span class="badge ${sizeBadge[pet.size] || ""}">${pet.size || "—"}</span>
            </div>

            <h2 class="pet-detail-name">${pet.name}</h2>
            <div class="pet-detail-id">#PET-${String(pet.petId).padStart(4, "0")}</div>
            <p class="pet-detail-desc">
              ${pet.distinctFeatures || "No additional description available for this pet yet."}
            </p>

            <div class="pet-detail-stats">
              <div class="pet-stat-card">
                <span class="stat-label">Breed</span>
                <span class="stat-value">${pet.breed || "—"}</span>
              </div>
              <div class="pet-stat-card">
                <span class="stat-label">Age</span>
                <span class="stat-value">${pet.age ? `${pet.age} years` : "—"}</span>
              </div>
              <div class="pet-stat-card">
                <span class="stat-label">Weight</span>
                <span class="stat-value">${pet.weightKg ? `${pet.weightKg} kg` : "—"}</span>
              </div>
              <div class="pet-stat-card">
                <span class="stat-label">Barangay</span>
                <span class="stat-value">${pet.barangay || "—"}</span>
              </div>
              <div class="pet-stat-card">
                <span class="stat-label">Color</span>
                <span class="stat-value">${pet.coatColor || "—"}</span>
              </div>
              <div class="pet-stat-card">
                <span class="stat-label">Status</span>
                <span class="stat-value">${pet.status || "Available"}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="pet-detail-sections">
          <div class="pet-detail-section">
            <div class="section-heading">Care Flags</div>
            <div class="flag-list">
              ${
                flags.length
                  ? flags.map(flag => `<span class="flag-pill">${flag}</span>`).join("")
                  : `<div class="pet-empty">No active flags.</div>`
              }
            </div>
          </div>

          <div class="pet-detail-section">
            <div class="section-heading">Compatibility Snapshot</div>
            <div class="pet-detail-chip-grid">
              ${compatibilityChips}
            </div>
          </div>
        </div>
      </div>
    `
  });

  return;
}

    if (action === "edit") {
      openModal("edit", pet);
      return;
    }

    if (action === "delete") {
      const result = await Swal.fire({
        icon: "warning",
        title: "Delete pet record?",
        text: `This will remove ${pet.name} from the mock list.`,
        showCancelButton: true,
        confirmButtonText: "Delete",
      });

      if (result.isConfirmed) {
        pets = pets.filter((item) => item.petId !== petId);
        applyFilters();
      }
    }
  });

  document.addEventListener("input", (event) => {
    if (!event.target.classList.contains("compat-slider")) return;

    const value = Number(event.target.value);
    const pct = `${((value - 1) / 4) * 100}%`;
    event.target.style.setProperty("--pct", pct);

    const field = event.target.dataset.field;
    const badge = document.getElementById(`sv_${field}`);
    if (badge) badge.textContent = String(value);
  });

  const photoInput = document.getElementById("fPhoto");
  const btnRemovePhoto = document.getElementById("btnRemovePhoto");

  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({
        icon: "error",
        title: "File too large",
        text: "Please upload an image under 5MB.",
      });
      photoInput.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      currentPhotoBase64 = e.target?.result || null;
      document.getElementById("photoPreview").innerHTML =
        `<img src="${currentPhotoBase64}" alt="Pet photo" />`;
      btnRemovePhoto.style.display = "flex";
    };
    reader.readAsDataURL(file);
  });

  btnRemovePhoto.addEventListener("click", () => resetPhoto());
}

async function initAnimalRecords() {
  try {
    await protectManagementPage();
    loadSidebar();
    renderTopbarUser();
    buildCompatGrid();
    renderTable(displayedPets);
    bindEvents();
    document.body.style.display = "block";
  } catch (error) {
    console.error("Animal records init failed:", error);
  }
}

window.addEventListener("DOMContentLoaded", initAnimalRecords);