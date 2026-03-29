import "../css/management/admin-dashboard.css";
import "../css/management/sidebar.css";
import "../css/management/animalRecords.css";

import Swal from "sweetalert2";
import { API_BASE_URL } from "../utils/api.js";
import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { compatFields, mockPets } from "../data/petCompatibilitySchema.js";

window.Swal = Swal;

let pets = [];
let displayedPets = [];
let editingId = null;
let currentPhotoBase64 = null;

let currentPage = 1;
const ROWS_PER_PAGE = 7;

async function loadPets() {
  try {
    const token = localStorage.getItem("animua_token");

    const res = await fetch(`${API_BASE_URL}/pets`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to fetch pets");
    }

    pets = await res.json();
    displayedPets = [...pets];
    applyFilters();
  } catch (error) {
    console.error("Error loading pets:", error);
    Swal.fire({
      icon: "error",
      title: "Load Failed",
      text: "Could not load animal records from the server.",
    });
  }
}

const speciesEmoji = { Dog: "🐕", Cat: "🐈", Bird: "🐦", Rabbit: "🐰", Other: "🐾" };
const speciesClass = { Dog: "em-dog", Cat: "em-cat", Bird: "em-bird", Rabbit: "em-rabbit", Other: "em-other" };
const speciesBadge = { Dog: "b-dog", Cat: "b-cat", Bird: "b-bird", Rabbit: "b-rabbit", Other: "b-other" };
const sexBadge = { Male: "b-male", Female: "b-female" };
const sizeBadge = { Small: "b-small", Medium: "b-medium", Large: "b-large", "X-Large": "b-xl" };
const statusBadge = {"Intake": "b-intake", "Quarantine": "b-quarantine", "Ready for Adoption": "b-ready"};


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

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / ROWS_PER_PAGE) || 1;

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  const start = (currentPage - 1) * ROWS_PER_PAGE;
  const end = start + ROWS_PER_PAGE;
  const pageData = data.slice(start, end);

if (petCount) {
  petCount.textContent = String(totalItems);
}

  if (totalItems === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align:center;padding:48px 20px;">
          <div style="color:var(--txt-g);font-size:1.8rem;margin-bottom:8px;">🐾</div>
          <div style="font-size:0.83rem;color:var(--txt-m);">
            No pets found matching your filters.
          </div>
        </td>
      </tr>
    `;
    pageInfo.textContent = "Showing 0–0 of 0 pets";
    renderPagination(0);
    return;
  }

  tbody.innerHTML = pageData.map((pet, index) => `
    <tr style="animation:fadeUp .35s ${index * 0.04}s cubic-bezier(0.16,1,0.3,1) both;">
      <td>
        <div class="pet-cell">
          <div class="pet-emoji ${speciesClass[pet.species] || "em-other"}">
            ${speciesEmoji[pet.species] || "🐾"}
          </div>
          <div>
            <div class="pet-name">${pet.name}</div>
            <div class="pet-id-tag">#PET-${pet.id?.slice(0, 6).toUpperCase() || "—"}</div>
          </div>
        </div>
      </td>

      <td>
        <span class="badge ${speciesBadge[pet.species] || "b-other"}">
          ${pet.species}
        </span>
      </td>

      <td>
        <span class="badge b-breed">${pet.breed || "—"}</span>
      </td>

      <td>
        <span class="badge ${sexBadge[pet.sex] || ""}">
          ${pet.sex || "—"}
        </span>
      </td>

      <td>${pet.age ? `${pet.age} yrs` : "—"}</td>

      <td>
        <span class="badge ${sizeBadge[pet.size] || ""}">
          ${pet.size || "—"}
        </span>
      </td>

      <td>${pet.barangay || "—"}</td>
      <td>${pet.coatColor || "—"}</td>
      <td>${pet.weightKg ? `${pet.weightKg} kg` : "—"}</td>

      <td>
        <span class="badge ${statusBadge?.[pet.status] || "b-breed"}">
          ${pet.status || "—"}
        </span>
      </td>

      <td>
        <div class="act-btns" style="justify-content:center;">
          <button class="btn-act view" type="button" data-action="view" data-id="${pet.id}">
            <i class="bi bi-eye-fill"></i>
          </button>

          <button class="btn-act edit" type="button" data-action="edit" data-id="${pet.id}">
            <i class="bi bi-pencil-fill"></i>
          </button>

          <button class="btn-act delete" type="button" data-action="delete" data-id="${pet.id}">
            <i class="bi bi-trash-fill"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  pageInfo.textContent = `Showing ${start + 1}–${Math.min(end, totalItems)} of ${totalItems} pet${totalItems !== 1 ? "s" : ""}`;

  renderPagination(totalItems);
}

function renderPagination(totalItems) {
  const container = document.querySelector(".pagination");
  if (!container) return;

  const totalPages = Math.ceil(totalItems / ROWS_PER_PAGE);
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `
    <button class="pg-btn" ${currentPage === 1 ? "disabled" : ""} data-page="${currentPage - 1}">
      ‹
    </button>
  `;

  const maxVisible = 5;
  let start = Math.max(1, currentPage - 2);
  let end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  if (start > 1) {
    html += `<button class="pg-btn" data-page="1">1</button>`;
    if (start > 2) html += `<span class="pg-dots">...</span>`;
  }

  for (let i = start; i <= end; i++) {
    html += `
      <button class="pg-btn ${i === currentPage ? "active" : ""}" data-page="${i}">
        ${i}
      </button>
    `;
  }

  if (end < totalPages) {
    if (end < totalPages - 1) html += `<span class="pg-dots">...</span>`;
    html += `<button class="pg-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  html += `
    <button class="pg-btn" ${currentPage === totalPages ? "disabled" : ""} data-page="${currentPage + 1}">
      ›
    </button>
  `;

  container.innerHTML = html;

  container.querySelectorAll(".pg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = Number(btn.dataset.page);
      if (!page) return;

      currentPage = page;
      renderTable(displayedPets);
    });
  });
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

function collectCompatibility() {
  const compatibility = {};

  compatFields.forEach((field) => {
    const slider = document.getElementById(`s_${field.id}`);
    compatibility[field.id] = slider ? Number(slider.value) : 3;
  });

  return compatibility;
}

function applyFilters() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const species = document.getElementById("filterSpecies").value;
  const sex = document.getElementById("filterSex").value;
  const size = document.getElementById("filterSize").value;
  const status = document.getElementById("filterStatus").value;
  const barangay = document.getElementById("filterBarangay").value.toLowerCase();

  displayedPets = pets.filter((pet) => {
    const text = `${pet.name} ${pet.species} ${pet.breed} ${pet.coatColor}`.toLowerCase();

    return (
      (!q || text.includes(q)) &&
      (!species || pet.species === species) &&
      (!sex || pet.sex === sex) &&
      (!size || pet.size === size) &&
      (!status || pet.status === status) &&
      (!barangay || (pet.barangay || "").toLowerCase().includes(barangay))
    );
  });

  currentPage = 1;

  renderTable(displayedPets);
}

function toggleSection(sectionId) {
  document.getElementById(sectionId)?.classList.toggle("open");
}

function openModal(mode, pet = null) {
  editingId = pet ? pet.id : null;

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
      recordMetaId.textContent = `#PET-${pet.id?.slice(0, 6).toUpperCase()}`;
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
  document.getElementById("fIntakeType").value = pet?.intakeSourceType || "";
  document.getElementById("fIntakeName").value = pet?.intakeSourceName || "";
  document.getElementById("fIntakeDate").value = pet?.intakeDate || "";

  document.getElementById("fVaccinated").value =
    pet?.isVaccinated === true ? "true" :
    pet?.isVaccinated === false ? "false" : "";

  document.getElementById("fMedicalStatus").value = pet?.medicalStatus || "";
  document.getElementById("fNotes").value = pet?.quarantineNotes || "";
  document.getElementById("fColor").value = pet?.coatColor || "";
  document.getElementById("fColor2").value = pet?.secondaryColor || "";
  document.getElementById("fWeight").value = pet?.weightKg || "";
  document.getElementById("fStatus").value = pet?.status || "";
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

async function deletePet(petId) {
  try {
    const token = localStorage.getItem("animua_token");

    const res = await fetch(`${API_BASE_URL}/pets/${petId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const message = await res.text();
      throw new Error(message || "Failed to delete pet");
    }

    await loadPets();

    Swal.fire({
      icon: "success",
      title: "Deleted!",
      text: "Pet record deleted successfully.",
      timer: 1500,
      showConfirmButton: false,
    });
  } catch (error) {
    console.error("Delete error:", error);

    Swal.fire({
      icon: "error",
      title: "Delete Failed",
      text: error.message || "Could not delete pet.",
    });
  }
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

async function savePet() {
  try {
    const requiredFields = [
    "fName",
    "fSpeciesForm",
    "fBreed",
    "fSexForm",
    "fAge",
    "formSize",
    "fBarangay",
    "fColor",
    "fWeight",
    "fStatus",
  ];

  let isValid = true;

  requiredFields.forEach((id) => {
    const element = document.getElementById(id);
    const group = element?.closest(".form-group");
    const value = element?.value?.toString().trim();

    if (!value) {
      element?.classList.add("input-error");
      group?.classList.add("has-err");
      isValid = false;
    } else {
      element?.classList.remove("input-error");
      group?.classList.remove("has-err");
    }
  });

  if (!isValid) {
    document.getElementById("secBasic")?.classList.add("open");
    document.getElementById("secPhysical")?.classList.add("open");
    return;
  }

    const token = localStorage.getItem("animua_token");
    const status = document.getElementById("fStatus").value;

    const petData = {
      name: document.getElementById("fName").value,
      species: document.getElementById("fSpeciesForm").value,
      breed: document.getElementById("fBreed").value,
      sex: document.getElementById("fSexForm").value,
      age: Number(document.getElementById("fAge").value),
      size: document.getElementById("formSize").value,
      barangay: document.getElementById("fBarangay").value,
      intakeSourceType: document.getElementById("fIntakeType").value,
      intakeSourceName: document.getElementById("fIntakeName").value,
      intakeDate: document.getElementById("fIntakeDate").value,

      isVaccinated: document.getElementById("fVaccinated").value === "true",
      medicalStatus: document.getElementById("fMedicalStatus").value,
      quarantineNotes: document.getElementById("fNotes").value,
      coatColor: document.getElementById("fColor").value,
      secondaryColor: document.getElementById("fColor2").value,
      weightKg: Number(document.getElementById("fWeight").value),
      distinctFeatures: document.getElementById("fDistinct").value,
      compatibility: collectCompatibility(),
      flags: {
        allergyFriendly: document.getElementById("fAllergy").checked,
        aggressive: document.getElementById("fAggressive").checked,
        specialNeeds: document.getElementById("fSpecialNeeds").checked,
      },
      photoUrl: currentPhotoBase64 || null,
      status,
      isVisibleToPublic: status === "Ready for Adoption"
    };

    const url = editingId
      ? `${API_BASE_URL}/pets/${editingId}`
      : `${API_BASE_URL}/pets`;

    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(petData),
    });

    const responseText = await res.text();

    if (!res.ok) {
      throw new Error(responseText || "Failed to save pet");
    }

    await loadPets();
    closeModal();

    Swal.fire({
      icon: "success",
      title: editingId ? "Updated!" : "Added!",
      text: "Pet saved successfully.",
      timer: 1500,
      showConfirmButton: false
    });

  } catch (error) {
    console.error("Save error:", error);

    Swal.fire({
      icon: "error",
      title: "Error",
      text: error.message || "Failed to save pet."
    });
  }
}


function bindEvents() {
  document.getElementById("btnAddPet").addEventListener("click", () => openModal("add"));
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("btnCancel").addEventListener("click", closeModal);
  document.getElementById("btnSave").addEventListener("click", savePet);

  document.getElementById("petModal").addEventListener("click", (event) => {
    if (event.target.id === "petModal") closeModal();
  });

  ["searchInput", "filterSpecies", "filterSex", "filterSize", "filterStatus", "filterBarangay"].forEach((id) => {
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

  const petId = actionButton.dataset.id;
  const action = actionButton.dataset.action;
  const pet = pets.find((item) => item.id === petId);

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
            <div class="pet-detail-id">#PET-${pet.id?.slice(0, 6).toUpperCase()}</div>
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
                <span class="badge ${statusBadge?.[pet.status] || "b-breed"}">
                  ${pet.status || "—"}
                </span>
              </div>

              <div class="pet-stat-card">
                <span class="stat-label">Intake Source Type</span>
                <span class="stat-value">${pet.intakeSourceType || "—"}</span>
              </div>

              <div class="pet-stat-card">
                <span class="stat-label">Intake Source Name</span>
                <span class="stat-value">${pet.intakeSourceName || "—"}</span>
              </div>

              <div class="pet-stat-card">
                <span class="stat-label">Intake Date</span>
                <span class="stat-value">${pet.intakeDate || "—"}</span>
              </div>

              <div class="pet-stat-card">
                <span class="stat-label">Vaccinated</span>
                <span class="stat-value">${
                  pet.isVaccinated === true ? "Yes" :
                  pet.isVaccinated === false ? "No" : "—"
                }</span>
              </div>
              <div class="pet-stat-card">
                <span class="stat-label">Medical Status</span>
                <span class="stat-value">${pet.medicalStatus || "—"}</span>
              </div>
              <div class="pet-stat-card">
                <span class="stat-label">Quarantine Notes</span>
                <span class="stat-value" style="white-space: normal; line-height: 1.4;">
                  ${pet.quarantineNotes || "—"}
                </span>
              </div>
              <div class="pet-stat-card">
                <span class="stat-label">Visible to Public</span>
                <span class="stat-value">${pet.isVisibleToPublic === true || pet.status === "Ready for Adoption" ? "Yes" : "No"}</span>
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
        text: `This will permanently remove ${pet.name} from the database.`,
        showCancelButton: true,
        confirmButtonText: "Delete",
        confirmButtonColor: "#dc3545",
      });

      if (result.isConfirmed) {
        await deletePet(petId);
      }
      return;
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

[
  "fName",
  "fSpeciesForm",
  "fBreed",
  "fSexForm",
  "fAge",
  "formSize",
  "fBarangay",
  "fColor",
  "fWeight",
  "fStatus",
].forEach((id) => {
  const element = document.getElementById(id);

  const clearError = () => {
    const value = element?.value?.toString().trim();
    const group = element?.closest(".form-group");

    if (value) {
      element.classList.remove("input-error");
      group?.classList.remove("has-err");
    }
  };

  element?.addEventListener("input", clearError);
  element?.addEventListener("change", clearError);
});

}

async function initAnimalRecords() {
  try {
    await protectManagementPage();
    loadSidebar();
    renderTopbarUser();
    buildCompatGrid();
    await loadPets();
    bindEvents();
    document.body.style.display = "block";
  } catch (error) {
    console.error("Animal records init failed:", error);
  }
}

window.addEventListener("DOMContentLoaded", initAnimalRecords);