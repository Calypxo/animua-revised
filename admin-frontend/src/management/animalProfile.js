import { API_BASE_URL } from "../utils/api.js";
import "../css/animalProfiling.css";
import "../css/managementTables.css";

import { protectPageByModule } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar, navigateManagementPage } from "../components/management/sidebarLoader.js";
import { showManagementNotice } from "../components/management/managementAlerts.js";
import {
  getUserName,
} from "../utils/storage.js";

import {
  hasPermission,
} from "../auth/permissions.js";

import {
  getAnimalById,
  updateAnimal,
  sendAnimalToQuarantine,
  markAnimalReady,
  saveBehavioralAssessment as saveBehavioralAssessmentApi,
  addMedicalRecord as addMedicalRecordApi,
  updateMedicalRecord as updateMedicalRecordApi,
  archiveAnimal as archiveAnimalApi
} from "../services/animal.service.js";

import {
  getInventoryItems,
} from "../services/inventoryFirestore.service.js";

const TRAITS = [
  { key: "energyLevel", label: "Energy Level", desc: "Overall energy of the animal" },
  { key: "exerciseNeeds", label: "Exercise Needs", desc: "Amount of exercise the animal needs" },
  { key: "independenceLevel", label: "Independence Level", desc: "Comfort being alone or self-directed" },
  { key: "attentionNeeds", label: "Attention Needs", desc: "How much daily attention the animal needs" },
  { key: "playfulness", label: "Playfulness", desc: "Interest in play and interaction" },
  { key: "friendlinessToHumans", label: "Friendliness to Humans", desc: "How friendly the animal is with people" },
  { key: "goodWithKids", label: "Good with Kids", desc: "Suitability around children" },
  { key: "goodWithOtherPets", label: "Good with Other Pets", desc: "Compatibility with other pets" },
  { key: "strangerTolerance", label: "Stranger Tolerance", desc: "Comfort level around unfamiliar people" },
  { key: "noiseLevel", label: "Noise Level", desc: "How noisy or vocal the animal tends to be" },
  { key: "spaceNeeds", label: "Space Needs", desc: "How much living space the animal needs" },
  { key: "adaptability", label: "Adaptability", desc: "Ability to adjust to new routines or homes" },
  { key: "trainingDifficulty", label: "Training Difficulty", desc: "How difficult the animal is to train" },
  { key: "affectionLevel", label: "Affection Level", desc: "Desire for closeness and affection" },
  { key: "separationAnxiety", label: "Separation Anxiety", desc: "Stress when left alone" },
  { key: "aggressive", label: "Aggression", desc: "Level of aggressive behavior (lower is better)" },
  { key: "specialNeeds", label: "Special Needs", desc: "Presence of special handling or care needs" },
];

const TRAIT_COLORS = [
  "#186534", "#2558a8", "#0d6e6e", "#b86a00", "#780116", "#780116", "#780116",
  "#2f855a", "#3182ce", "#2c7a7b", "#d69e2e", "#c05621", "#805ad5", "#dd6b20",
  "#38a169", "#4c51bf", "#b83280"
];

let animal = null;
let editingMedId = null;
let currentRole = "";
let currentUser = null;
let medicalInventoryItems = [];

function signedInUserName() {
  return String(
    currentUser?.fullName ||
    getUserName() ||
    currentUser?.email ||
    "Staff"
  ).trim();
}

const speciesInitial = species => String(species || "Animal").charAt(0).toUpperCase();

function animalDisplayLabel(record = animal || {}) {
  const legacyName = String(record.name || "").trim();
  const meaningfulLegacyName =
    legacyName &&
    !["unknown", "unnamed", "unnamed pet"].includes(
      legacyName.toLowerCase()
    );

  return (
    record.adoptedName ||
    record.identifyingDescription ||
    record.shelterLabel ||
    [
      record.color,
      record.ageEstimate,
      record.sex,
      record.species,
    ].filter(Boolean).join(" ") ||
    (meaningfulLegacyName ? legacyName : "") ||
    record.id ||
    "Shelter animal"
  );
}

const statusCfg = {
  Profiling:  { cls: "badge-profiling",  bg: "var(--amber-soft)", color: "var(--amber)" },
  Quarantine: { cls: "badge-quarantine", bg: "var(--blue-soft)",  color: "var(--blue)" },
  Ready:      { cls: "badge-ready",      bg: "var(--green-soft)", color: "var(--green)" },
  Adopted:    { cls: "badge-adopted",    bg: "var(--rose-soft)",  color: "var(--rose)" },
  Fostered:   { cls: "badge-fostered",   bg: "var(--teal-soft)",  color: "var(--teal)" },
  Archived:   { cls: "badge-archived",   bg: "var(--cream-3)",    color: "var(--stone)" },
};

const medTypeCfg = {
  Checkup: { cls: "med-checkup", icon: "bi-clipboard2-pulse" },
  Vaccination: { cls: "med-vaccination", icon: "bi-shield-plus" },
  Treatment: { cls: "med-treatment", icon: "bi-bandaid-fill" },
  Surgery: { cls: "med-surgery", icon: "bi-activity" },
  Deworming: { cls: "med-deworming", icon: "bi-capsule" },
  "Quarantine Clearance": { cls: "med-clearance", icon: "bi-patch-check-fill", label: "Quarantine Review" },
};

const clearanceCfg = {
  Pending: { cls: "clear-pending", label: "Pending" },
  Cleared: { cls: "clear-cleared", label: "Cleared" },
  Hold: { cls: "clear-hold", label: "On Hold" },
};

const dotColors = {
  "Intake recorded": "#b86a00",
  "Converted to profile": "#2558a8",
  "Medical": "#0d6e6e",
  "Vaccination": "#186534",
  "Status changed": "#780116",
  "Adopted": "#780116",
  "Cleared from quarantine": "#186534",
  "Marked ready": "#186534",
};

const MEDICAL_CATEGORIES = [
  "Antibiotic",
  "Antiparasitic",
  "Antifungal",
  "Anesthetic",
  "Supplement",
  "Vaccine",
  "Surgical Supply",
  "Topical Medicine",
  "Hormonal Medicine",
  "Respiratory Medicine",
  "Pain Relief",
  "Sedative",
  "Diagnostic",
];

function isMedicalInventoryItem(item) {
  return MEDICAL_CATEGORIES.includes(item.category);
}

async function loadMedicalInventoryItems() {
  const items = await getInventoryItems();

  medicalInventoryItems = items
    .map(mapInventoryItem)
    .filter(isMedicalInventoryItem);
}

function parseDateValue(d) {
  if (!d) return null;
  if (typeof d === "string") return d.includes("T") ? new Date(d) : new Date(`${d}T00:00:00`);
  if (d._seconds) return new Date(d._seconds * 1000);
  return new Date(d);
}

function formatDate(d) {
  const date = parseDateValue(d);
  if (!date || isNaN(date)) return "—";
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function daysSince(d) {
  const date = parseDateValue(d);
  if (!date || isNaN(date)) return 0;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function countScoredTraits(assessment) {
  if (!assessment) return 0;
  return Object.keys(assessment).length;
}

function statusBadge(status) {
  const c = statusCfg[status] || statusCfg.Profiling;
  return `<span class="status-badge ${c.cls}">${status}</span>`;
}

function getDotColor(event) {
  const key = Object.keys(dotColors).find(k => event.toLowerCase().includes(k.toLowerCase()));
  return dotColors[key] || "var(--stone-3)";
}

async function loadAnimal() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    navigateManagementPage("/pages/animalProfiling.html");
    return;
  }

  try {
    animal = await getAnimalById(id);
    animal.history = animal.history || [];
    animal.medicalRecords = animal.medicalRecords || [];
  } catch (err) {
    console.error("[loadAnimal]", err);
    await showManagementNotice({
      icon: "error",
      title: "Animal record not found",
      text: "The record may have been archived, removed, or is no longer available.",
      confirmButtonText: "Back to animal profiles",
    });
    navigateManagementPage("/pages/animalProfiling.html");
  }
}

async function refreshAnimal() {
  animal = await getAnimalById(animal.id);
  animal.history = animal.history || [];
  animal.medicalRecords = animal.medicalRecords || [];
}

function renderHero() {
  const displayLabel = animalDisplayLabel();
  document.title = `ANIMUA — ${displayLabel}`;
  document.getElementById("profileBreadcrumb").textContent = displayLabel;
  document.getElementById("profileName").textContent = displayLabel;
  document.getElementById("profileStatusBadge").innerHTML = statusBadge(animal.status);
  const profilePhotoEl = document.getElementById("profilePhoto");
  profilePhotoEl.innerHTML = animal.photoURL
    ? `<img src="${animal.photoURL}" alt="${displayLabel}" />`
    : `<span class="profile-photo-initial" aria-label="${animal.species || "Animal"}">${speciesInitial(animal.species)}</span>`;

  document.getElementById("profileMeta").innerHTML = `
    <div class="profile-meta-item"><span>Record ID</span><strong><i class="bi bi-upc-scan"></i>${animal.id}</strong></div>
    <div class="profile-meta-item"><span>Animal</span><strong>${animal.species || "Unknown"} · ${animal.breed || "Unknown breed"}</strong></div>
    <div class="profile-meta-item"><span>Sex & age</span><strong>${animal.sex || "Unknown"} · ${animal.ageEstimate || "Age unknown"}</strong></div>
    <div class="profile-meta-item"><span>Time in care</span><strong>${daysSince(animal.intakeDate)} days</strong></div>`;

  document.getElementById("profileTags").innerHTML = `
    <span class="profile-tag"><i class="bi bi-box-arrow-in-down"></i>${animal.source || "Source unknown"}</span>
    <span class="profile-tag"><i class="bi bi-palette"></i>${animal.color || "Color not recorded"}</span>
    <span class="profile-tag"><i class="bi bi-door-open"></i>${animal.cageNumber || animal.housingType || "Housing unassigned"}</span>`;

  const btn = document.getElementById("btnStatusChange");

  btn.style.display = "none";
  btn.onclick = null;

  if (
    animal.status === "Profiling" &&
    can("send_to_quarantine")
  ) {
    btn.style.display = "";

    btn.innerHTML = `
      <i class="bi bi-shield-plus"></i>
      Place in Quarantine
    `;

    btn.onclick = sendToQuarantine;
  } else if (
    animal.status === "Quarantine" &&
    can("mark_ready")
  ) {
    const clearanceStatus = getLatestClearanceStatus();

    const requirementsComplete =
      clearanceStatus === "Cleared" &&
      Boolean(animal.behavioralAssessment);

    if (requirementsComplete) {
      btn.style.display = "";

      btn.innerHTML = `
        <i class="bi bi-house-heart-fill"></i>
        Mark Ready
      `;

      btn.onclick = markReadyForAdoption;
    }
  } else if (
    animal.status === "Ready" &&
    can("process_adoption")
  ) {
    btn.style.display = "";

    btn.innerHTML = `
      <i class="bi bi-person-check-fill"></i>
      Process Adoption
    `;

    btn.onclick = () => {
      navigateManagementPage(
        `/pages/adoptionApplications.html?animalId=${encodeURIComponent(
          animal.id
        )}`
      );
    };
  }
}

async function uploadAnimalPhoto() {
  if (!can("upload_photo")) {
    showToast(
      "error",
      "You do not have permission to upload or change the animal photo."
    );
    return;
  }

  const input = document.getElementById("photoInput");
  const file = input?.files?.[0];

  if (!file) {
    showToast("warning", "Please select an image first.");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("photo", file);

    const token = localStorage.getItem("animua_token");

    const res = await fetch(`${API_BASE_URL}/animals/${animal.id}/photo`, {
      method: "PATCH",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[uploadAnimalPhoto] server response:", errText);
      throw new Error("Upload failed");
    }

    const data = await res.json();

    animal.photoURL = data.photoURL || "";

    const ph = document.getElementById("profilePhoto");

    ph.innerHTML = animal.photoURL
      ? `<img src="${animal.photoURL}" alt="${animalDisplayLabel()}" />`
      : `<span>${animalDisplayLabel()[0]}</span>`;

    input.value = "";

    showToast("success", "Photo updated successfully.");
  } catch (err) {
    console.error("[uploadAnimalPhoto]", err);

    showToast(
      "error",
      err.message || "Failed to upload image."
    );
  }
}

function renderOverviewTab() {
  const infoField = (lbl, val) =>
    `<div class="info-item"><div class="info-lbl">${lbl}</div><div class="info-val">${val || "—"}</div></div>`;

  document.getElementById("basicInfoGrid").innerHTML = `
    ${infoField("Animal ID", `<span class="record-code">${animal.id}</span>`)}
    ${infoField("Shelter Description", animalDisplayLabel())}
    ${infoField("Species", animal.species)}
    ${infoField("Breed", animal.breed || "Unknown")}
    ${infoField("Sex", animal.sex)}
    ${infoField("Age Estimate", animal.ageEstimate || "Unknown")}
    ${infoField("Color", animal.color || "Unknown")}
    ${infoField("Weight", animal.weight ? animal.weight + " kg" : "Not recorded")}`;

  document.getElementById("intakeInfoGrid").innerHTML = `
    ${infoField("Intake Date", formatDate(animal.intakeDate))}
    ${infoField("Cage Number", animal.cageNumber || "Unassigned")}
    ${infoField("Housing Type", animal.housingType || "Unassigned")}
    ${infoField("Days in Shelter", daysSince(animal.intakeDate) + " days")}
    ${infoField("Source", animal.source)}
    ${infoField("Location", animal.intakeLocation || "—")}
    ${infoField("Intake ID", animal.intakeId || "—")}
    ${infoField("Intake Staff", animal.intakedBy || "—")}`;

  document.getElementById("conditionInfoGrid").innerHTML = `
    ${infoField("Initial Condition", animal.initialCondition || "—")}
    ${infoField("Injuries at Intake", animal.injuries || "Unknown")}
    ${infoField("Vaccinated at Intake", animal.vaccinated || "Unknown")}
    ${infoField("Spay / Neuter Status", animal.alteredStatus || "Unknown")}
    ${infoField("Visible Defects / Features", animal.visibleDefects || "None recorded")}
    ${infoField("Known Previous Name", animal.previousName || "None recorded")}
    ${infoField("Condition Notes", animal.conditionNotes ? `<span class="record-note">${animal.conditionNotes}</span>` : "None recorded")}`;
    
}

function renderMedicalTab() {

  const addMedicalButton =
  document.getElementById("btnAddMedical");

if (addMedicalButton) {
  addMedicalButton.style.display =
    animal.status === "Quarantine" &&
    can("add_medical")
      ? ""
      : "none";
}

  const list = document.getElementById("medicalRecordsList");
  const recs = animal.medicalRecords || [];

  if (animal.status === "Profiling") {
  list.innerHTML = `
    <div class="behavioral-empty">
      <i class="bi bi-shield-plus"></i>
      <p>This animal has not entered quarantine yet.</p>
      <p class="empty-state-detail">
        Complete the basic profile and select
        “Send to Quarantine” before adding medical records.
      </p>
    </div>
  `;
} else if (!recs.length) {
  list.innerHTML = `
    <div class="behavioral-empty">
      <i class="bi bi-clipboard2-x"></i>
      <p>No medical records yet. Add the first record.</p>
    </div>
  `;
} else {
    list.innerHTML = recs.slice().reverse().map(r => {
      const tc = medTypeCfg[r.type] || medTypeCfg.Checkup;
      const cc = clearanceCfg[r.clearance] || clearanceCfg.Pending;
      return `
        <div class="medical-record-card">
          <div class="med-card-header">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="med-type-badge ${tc.cls}"><i class="bi ${tc.icon}"></i>${tc.label || r.type}</span>
              ${
                r.type === "Quarantine Clearance"
                  ? `
                    <span class="clearance-badge ${cc.cls}">
                      ${cc.label}
                    </span>
                  `
                  : ""
              }
            </div>
            <div class="d-flex align-items-center gap-3">
              <span class="med-card-date">${formatDate(r.date)}</span>
              <span class="med-card-vet"><i class="bi bi-person-fill me-1"></i>${r.vet || "—"}</span>
              ${
              animal.status === "Quarantine" && can("edit_medical")
                ? `
                  <button
                    class="tbl-action-btn"
                    data-med-edit="${r.id}"
                    title="Edit"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                `
                : ""
            }
            </div>
          </div>
          <div class="med-card-body">
            ${r.diagnosis ? `<p><strong>Findings:</strong> ${r.diagnosis}</p>` : ""}
            ${r.treatment ? `<p><strong>Treatment:</strong> ${r.treatment}</p>` : ""}
            ${
              r.inventoryItemName
                ? `<p><strong>Inventory Used:</strong> ${r.quantityUsed || 0} ${r.inventoryUnit || "pcs"} — ${r.inventoryItemName}</p>`
                : ""
            }
            ${r.weight ? `<p><strong>Weight:</strong> ${r.weight} kg</p>` : ""}
            ${r.notes ? `<p><strong>Notes:</strong> ${r.notes}</p>` : ""}
          </div>
        </div>`;
    }).join("");

    list.querySelectorAll("[data-med-edit]").forEach(btn => {
      btn.addEventListener("click", () => openMedicalModal(btn.dataset.medEdit));
    });
  }

  const clearStatus = getLatestClearanceStatus();

  const cc =
    clearanceCfg[clearStatus] ||
    clearanceCfg.Pending;

  const latestMedicalRecord =
    getLatestMedicalRecord();

  const quarantineCard = document.getElementById("quarantineCard");
  const behaviorComplete = Boolean(animal.behavioralAssessment);
  const latestClearanceRecord = getLatestClearanceRecord();
  quarantineCard.innerHTML = `
    <div class="qs-title"><i class="bi bi-shield-plus"></i> Care readiness</div>
    <p class="quarantine-workflow-help">Medical visits document care. A single <strong>Quarantine Review</strong> records the final decision; update that review if the decision changes.</p>
    <div class="care-workflow" aria-label="Animal care readiness workflow">
      <div class="care-workflow-step is-complete"><i class="bi bi-check-lg"></i><span><strong>In quarantine</strong><small>Care tracking active</small></span></div>
      <div class="care-workflow-step ${recs.length ? "is-complete" : "is-current"}"><i class="bi ${recs.length ? "bi-check-lg" : "bi-clipboard2-pulse"}"></i><span><strong>Medical care</strong><small>${recs.length} record${recs.length === 1 ? "" : "s"}</small></span></div>
      <div class="care-workflow-step ${clearStatus === "Cleared" ? "is-complete" : "is-current"}"><i class="bi ${clearStatus === "Cleared" ? "bi-check-lg" : "bi-shield-check"}"></i><span><strong>Quarantine decision</strong><small>${cc.label}</small></span></div>
      <div class="care-workflow-step ${behaviorComplete ? "is-complete" : ""}"><i class="bi ${behaviorComplete ? "bi-check-lg" : "bi-sliders"}"></i><span><strong>Behavior assessment</strong><small>${behaviorComplete ? "Complete" : "Pending"}</small></span></div>
    </div>
    <div class="qs-grid">
      <div class="qs-item"><div class="qs-lbl">Quarantine decision</div>
        <div class="qs-val"><span class="clearance-badge ${cc.cls}">${cc.label}</span></div>
      </div>
      <div class="qs-item"><div class="qs-lbl">Total Records</div><div class="qs-val">${recs.length}</div></div>
      <div class="qs-item">
  <div class="qs-lbl">Last Visit</div>
  <div class="qs-val">
    ${
      latestMedicalRecord
        ? formatDate(latestMedicalRecord.date)
        : "—"
    }
  </div>
</div>
    </div>
    ${animal.status === "Quarantine" && can("set_clearance") ? `<button type="button" class="btn-primary-clay quarantine-decision-btn" id="btnRecordQuarantineDecision"><i class="bi bi-shield-check"></i>${latestClearanceRecord ? "Update quarantine decision" : "Record quarantine decision"}</button>` : ""}`;

  quarantineCard.querySelector("#btnRecordQuarantineDecision")?.addEventListener("click", () => {
    openMedicalModal(latestClearanceRecord?.id || null, "Quarantine Clearance");
  });
}

function renderBehavioralTab() {
  const el = document.getElementById("behavioralContent");
  const lbl = document.getElementById("behavioralBtnLabel");

  if (!animal.behavioralAssessment) {
    lbl.textContent = "Add Assessment";
    el.innerHTML = `
      <div class="behavioral-empty">
        <i class="bi bi-sliders"></i>
        <p>No behavioral assessment recorded yet.</p>
        <p class="empty-state-detail">
          Record observed behavior to support responsible adopter matching.
        </p>
      </div>`;
    return;
  }

  lbl.textContent = "Edit Assessment";
  const ba = animal.behavioralAssessment;
  const traitCount = Object.keys(ba).length;

  el.innerHTML = `
    <div class="behavioral-result-card">
      <div class="behavioral-meta">
        <div class="behavioral-meta-text">
          <h4>Behavioral Assessment Recorded</h4>
          <p>
            Assessed by ${animal.behavioralAssessor || "Staff"} ·
            ${formatDate(animal.behavioralDate || animal.intakeDate)}
          </p>
          <p class="behavioral-summary">
            ${traitCount} behavioral dimensions scored on a 1–5 scale.
          </p>
          ${animal.behavioralNotes
            ? `<p class="behavioral-note">${animal.behavioralNotes}</p>`
            : ""}
        </div>
      </div>

      <div class="trait-bars">
        ${TRAITS.map((t, i) => {
          const val = ba[t.key] || 0;
          const pct = (val / 5) * 100;
          const fillColor = TRAIT_COLORS[i] || "var(--clay)";
          return `
            <div class="trait-row">
              <span class="trait-name">${t.label}</span>
              <div class="trait-bar-track">
                <div class="trait-bar-fill" style="width:${pct}%;background:${fillColor}"></div>
              </div>
              <span class="trait-score">${val}/5</span>
            </div>`;
        }).join("")}
      </div>
    </div>`;
}

function renderAdoptionTab() {
  const el = document.getElementById("adoptionContent");
  const btn = document.getElementById("btnMarkReady");

  if (animal.status === "Adopted") {
    btn.style.display = "none";
    el.innerHTML = `
      <div class="adoption-ready-banner is-adopted">
        <i class="bi bi-balloon-heart-fill"></i>
        <div>
          <h4>Adoption completed</h4>
          <p>This record has moved into post-adoption care.</p>
        </div>
      </div>
      <div class="adoption-status-card">
        <div class="qs-grid">
          <div class="qs-item"><div class="qs-lbl">Adoption Date</div><div class="qs-val">${formatDate(animal.adoptionDate || "")}</div></div>
          <div class="qs-item"><div class="qs-lbl">Adopter</div><div class="qs-val">${animal.adopterName || "—"}</div></div>
          <div class="qs-item"><div class="qs-lbl">Processed By</div><div class="qs-val">${animal.adoptionStaff || "—"}</div></div>
        </div>
      </div>`;
    return;
  }

  if (animal.status === "Ready") {
  btn.style.display = "none";
  el.innerHTML = `
    <div class="adoption-ready-banner">
      <i class="bi bi-house-heart-fill"></i>
      <div>
        <h4>Ready for Adoption</h4>
        <p>This animal is cleared and waiting for the right adopter.</p>
      </div>
    </div>
    <div class="adoption-status-card">
      <div class="qs-grid">
        <div class="qs-item"><div class="qs-lbl">Behavioral Dimensions</div><div class="qs-val">${countScoredTraits(animal.behavioralAssessment)} recorded</div></div>
        <div class="qs-item"><div class="qs-lbl">Days Waiting</div><div class="qs-val">${daysSince(animal.intakeDate)}d</div></div>
        <div class="qs-item"><div class="qs-lbl">Behavioral Assessment</div><div class="qs-val"><span class="readiness-value ${animal.behavioralAssessment ? "is-complete" : "is-pending"}"><i class="bi ${animal.behavioralAssessment ? "bi-check-circle-fill" : "bi-clock-fill"}"></i>${animal.behavioralAssessment ? "Complete" : "Pending"}</span></div></div>
      </div>
    </div>
    <div class="mt-3">
      ${
  can("process_adoption")
    ? `
      <div class="mt-3">
        <a
          href="/pages/adoptionApplications.html?animalId=${encodeURIComponent(
            animal.id
          )}"
          class="btn-primary-clay"
        >
          <i class="bi bi-person-check-fill"></i>
          View Adoption Applications
        </a>
      </div>
    `
    : ""
}
    </div>`;
  return;
}

  const missingItems = [];

  if (animal.status === "Profiling") {
    missingItems.unshift(
      "Animal must first be sent to quarantine"
    );
  }

  if (!animal.behavioralAssessment) {
    missingItems.push(
      "Behavioral assessment not yet completed"
    );
  }

  const clearanceStatus = getLatestClearanceStatus();

  if (clearanceStatus !== "Cleared") {
    missingItems.push(
      "Medical / quarantine not yet cleared"
    );
  }

  const canMarkReady =
  animal.status === "Quarantine" &&
  missingItems.length === 0 &&
  can("mark_ready");

btn.style.display = canMarkReady ? "" : "none";

  el.innerHTML = `
    <div class="adoption-status-card">
      <div class="qs-title mb-3"><i class="bi bi-info-circle-fill"></i> Adoption Readiness</div>
      <div class="qs-grid readiness-grid">
        <div class="qs-item"><div class="qs-lbl">Current Status</div><div class="qs-val">${animal.status}</div></div>
        <div class="qs-item"><div class="qs-lbl">Behavioral Assessment</div>
          <div class="qs-val">
            <span class="readiness-value ${animal.behavioralAssessment ? "is-complete" : "is-pending"}"><i class="bi ${animal.behavioralAssessment ? "bi-check-circle-fill" : "bi-clock-fill"}"></i>${animal.behavioralAssessment ? "Complete" : "Pending"}</span>
          </div>
        </div>
        <div class="qs-item"><div class="qs-lbl">Medical Clearance</div>
          <div class="qs-val">
            <span class="readiness-value ${clearanceStatus === "Cleared" ? "is-complete" : "is-pending"}"><i class="bi ${clearanceStatus === "Cleared" ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}"></i>${clearanceStatus === "Cleared" ? "Cleared" : "Not cleared"}</span>
          </div>
        </div>
      </div>
      ${missingItems.length ? `
        <div class="readiness-callout is-pending">
          <p><i class="bi bi-exclamation-triangle-fill"></i> Required before marking ready</p>
          <ul>
            ${missingItems.map(m => `<li>${m}</li>`).join("")}
          </ul>
        </div>` : `
        <div class="readiness-callout is-complete">
          <p><i class="bi bi-check-circle-fill"></i> All requirements are complete. This animal can be marked ready for adoption.</p>
        </div>`}
    </div>`;
}

function renderHistoryTab() {
  const hist = (animal.history || []).slice().reverse();
  if (!hist.length) {
    document.getElementById("historyTimeline").innerHTML =
      `<div class="history-empty"><i class="bi bi-clock-history"></i><strong>No history recorded</strong><span>Lifecycle events will appear here as the record progresses.</span></div>`;
    return;
  }

  document.getElementById("historyTimeline").innerHTML = `
    <div class="timeline">
      ${hist.map(h => `
        <div class="timeline-item">
          <div class="timeline-date">${formatDate(h.date)}</div>
          <div class="timeline-dot-wrap">
            <div class="timeline-dot" style="background:${getDotColor(h.event)}"></div>
            <div class="timeline-line"></div>
          </div>
          <div class="timeline-body">
            <div class="timeline-event">${h.event}</div>
            ${h.detail ? `<div class="timeline-detail">${h.detail}</div>` : ""}
            ${h.actor ? `<div class="timeline-actor">by ${h.actor}</div>` : ""}
          </div>
        </div>`).join("")}
    </div>`;
}

async function sendToQuarantine() {
  if (!can("send_to_quarantine")) {
    showToast(
      "error",
      "Only a veterinarian or administrator can place an animal in quarantine."
    );
    return;
  }

  if (animal.status !== "Profiling") {
    showToast(
      "warning",
      "Only animals currently in profiling can be sent to quarantine."
    );
    return;
  }

  if (
    !animal.species ||
    !animal.sex ||
    !animal.cageNumber ||
    !animal.housingType
  ) {
    showToast(
      "warning",
      "Complete the animal profile before sending to quarantine."
    );
    return;
  }

  try {
    await sendAnimalToQuarantine(animal.id);

    await refreshAnimal();
    renderAllTabs();

    showToast(
      "success",
      `${animalDisplayLabel()} has been placed in quarantine.`
    );
  } catch (error) {
    console.error("[sendToQuarantine]", error);

    showToast(
      "error",
      error.message || "Failed to send animal to quarantine."
    );
  }
}

function openBehavioralModal() {
  if (!can("edit_behavioral")) {
    showToast(
      "error",
      "Only veterinarians or administrators can evaluate behavior."
    );
    return;
  }

  if (
    animal.status === "Adopted" ||
    animal.status === "Archived"
  ) {
    showToast(
      "warning",
      "Behavioral assessments cannot be edited for adopted or archived animals."
    );
    return;
  }

  const ba = animal.behavioralAssessment || {};
  document.getElementById("behavioralNotes").value = animal.behavioralNotes || "";
  document.getElementById("behavioralAssessor").value = signedInUserName();

  const behaviorGroups = [
    { title: "Activity & routine", icon: "bi-activity", keys: ["energyLevel", "exerciseNeeds", "playfulness", "attentionNeeds"] },
    { title: "Social comfort", icon: "bi-people", keys: ["friendlinessToHumans", "goodWithKids", "goodWithOtherPets", "strangerTolerance", "affectionLevel"] },
    { title: "Home fit", icon: "bi-house-check", keys: ["independenceLevel", "noiseLevel", "spaceNeeds", "adaptability", "trainingDifficulty"] },
    { title: "Support & safety", icon: "bi-shield-check", keys: ["separationAnxiety", "aggressive", "specialNeeds"] },
  ];

  const grid = document.getElementById("traitGrid");
  grid.innerHTML = behaviorGroups.map(group => `
    <section class="trait-group" aria-labelledby="group-${group.keys[0]}">
      <header class="trait-group-header">
        <span><i class="bi ${group.icon}" aria-hidden="true"></i></span>
        <div><strong id="group-${group.keys[0]}">${group.title}</strong><small>${group.keys.length} observations</small></div>
      </header>
      <div class="trait-group-list">
        ${group.keys.map(key => {
          const trait = TRAITS.find(item => item.key === key);
          const val = ba[key] ?? 3;
          return `
            <div class="trait-modal-row">
              <div class="trait-modal-copy">
                <label class="trait-modal-name" id="label-${key}">${trait.label}</label>
                <div class="trait-modal-desc" id="desc-${key}">${trait.desc}</div>
              </div>
              <input type="hidden" id="slider-${key}" value="${val}" />
              <div class="trait-score-options" role="group" aria-labelledby="label-${key}" aria-describedby="desc-${key}">
                ${[1, 2, 3, 4, 5].map(score => `<button type="button" class="trait-score-option${Number(val) === score ? " is-selected" : ""}" data-trait-key="${key}" data-score="${score}" aria-pressed="${Number(val) === score}">${score}</button>`).join("")}
              </div>
            </div>`;
        }).join("")}
      </div>
    </section>`).join("");

  grid.querySelectorAll(".trait-score-option").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.traitKey;
      const score = button.dataset.score;
      const input = document.getElementById(`slider-${key}`);
      if (input) input.value = score;
      button.parentElement.querySelectorAll(".trait-score-option").forEach(option => {
        const selected = option === button;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
    });
  });

  openModal("behavioralModalBackdrop");
}

async function saveBehavioralAssessment() {
  if (!can("edit_behavioral")) {
  showToast(
    "error",
    "You do not have permission to save behavioral assessments."
  );
  return;
}

  if (
  animal.status === "Adopted" ||
  animal.status === "Archived"
) {
  showToast(
    "warning",
    "Behavioral assessments cannot be saved for adopted or archived animals."
  );
  return;
}

  const traits = {};
  TRAITS.forEach(t => {
    traits[t.key] = parseInt(document.getElementById(`slider-${t.key}`)?.value || 3);
  });

  const notes = document.getElementById("behavioralNotes").value.trim();
  const assessor = signedInUserName();

  try {
    await saveBehavioralAssessmentApi(animal.id, { traits, notes, assessor });
    await refreshAnimal();

    closeModal("behavioralModalBackdrop");
    renderAllTabs();
    showToast("success", "Behavioral assessment saved.");
  } catch (err) {
    console.error("[saveBehavioralAssessment]", err);
    showToast("error", err.message || "Failed to save behavioral assessment.");
  }
}

function openMedicalModal(medId = null, defaultType = "") {
  const requiredPermission =
  medId
    ? "edit_medical"
    : "add_medical";

if (!can(requiredPermission)) {
  showToast(
    "error",
    "Only veterinarians or administrators can manage medical records."
  );
  return;
}

  if (animal.status !== "Quarantine") {
    showToast(
      "warning",
      "Send the animal to quarantine before adding medical records."
    );
    return;
  }

  editingMedId = medId;
  const editingRecord = medId
    ? (animal.medicalRecords || []).find((item) => item.id === medId)
    : null;
  const isQuarantineReview =
    defaultType === "Quarantine Clearance" ||
    editingRecord?.type === "Quarantine Clearance";

  document.getElementById("medicalModalTitle").textContent =
    isQuarantineReview
      ? medId ? "Update Quarantine Review" : "Record Quarantine Review"
      : medId ? "Edit Medical Record" : "Add Medical Record";
  document.getElementById("medicalModalSubtitle").textContent =
    isQuarantineReview
      ? "Review the animal and record one clear quarantine decision."
      : "Record a clinical visit, treatment, vaccination, or procedure.";

  document.getElementById("medicalForm").reset();
  document.getElementById("fMedVet").value = signedInUserName();

  const inventorySelect =
  document.getElementById("fMedInventoryItem");

if (inventorySelect) {
  inventorySelect.innerHTML = `
    <option value="">No inventory item used</option>
    ${medicalInventoryItems
      .map(
        (item) => `
          <option value="${item.docId}">
            ${item.name.trim()} - ${item.currentStock} ${item.unit || "pcs"} available
          </option>
        `
      )
      .join("")}
  `;
}

const quantityInput =
  document.getElementById("fMedQuantityUsed");

if (quantityInput) {
  quantityInput.value = "";
}

const itemErr =
  document.getElementById("errMedInventoryItem");

if (itemErr) {
  itemErr.textContent = "";
}

const qtyErr =
  document.getElementById("errMedQuantityUsed");

if (qtyErr) {
  qtyErr.textContent = "";
}

  document.getElementById("fMedDate").value =
    new Date().toISOString().split("T")[0];

  const typeSelect = document.getElementById("fMedType");
const clearanceField =
  document.getElementById("medClearanceGroup") ||
  document.getElementById("fMedClearance")?.parentElement;

const clearanceOption =
  typeSelect?.querySelector(
    'option[value="Quarantine Clearance"]'
  );

if (clearanceOption) {
  const existingClearanceRecord = getLatestClearanceRecord();
  clearanceOption.disabled =
    !can("set_clearance") || Boolean(existingClearanceRecord && existingClearanceRecord.id !== medId);
}

const updateClearanceVisibility = () => {
  const selectedType = typeSelect?.value;

  if (!clearanceField) {
    return;
  }

  const isClearanceRecord =
    selectedType === "Quarantine Clearance";

  clearanceField.style.display =
    isClearanceRecord ? "" : "none";

  const clearanceSelect =
    document.getElementById("fMedClearance");

  if (clearanceSelect) {
    clearanceSelect.disabled =
      isClearanceRecord &&
      !can("set_clearance");
  }
};

if (typeSelect) {
  typeSelect.disabled = false;
  typeSelect.onchange =
    updateClearanceVisibility;
  if (!medId && defaultType) typeSelect.value = defaultType;
  if (isQuarantineReview) typeSelect.disabled = true;
}

  if (medId) {
    const record = editingRecord;

    if (record) {
      document.getElementById("fMedType").value =
        record.type || "";

      document.getElementById("fMedDate").value =
        record.date || "";

      document.getElementById("fMedVet").value =
        record.vet || "";

      document.getElementById("fMedDiagnosis").value =
        record.diagnosis || "";

      document.getElementById("fMedTreatment").value =
        record.treatment || "";

      document.getElementById("fMedNotes").value =
        record.notes || "";

      document.getElementById("fMedClearance").value =
        record.clearance || "Pending";

      document.getElementById("fMedWeight").value =
        record.weight || "";

      const medInventoryInput =
      document.getElementById("fMedInventoryItem");

    if (medInventoryInput) {
      const linkedInventoryItem =
        medicalInventoryItems.find(
          (item) =>
            item.docId === record.inventoryItemId ||
            item.itemId === record.inventoryItemId
        );
      medInventoryInput.value =
        linkedInventoryItem?.docId || "";
    }

    const medQuantityInput =
      document.getElementById("fMedQuantityUsed");

    if (medQuantityInput) {
      medQuantityInput.value =
        record.quantityUsed || "";
    }
    }
  }

  updateClearanceVisibility();
  openModal("medicalModalBackdrop");
}

async function saveMedicalRecord() {
  const requiredPermission = editingMedId
    ? "edit_medical"
    : "add_medical";

  if (!can(requiredPermission)) {
    showToast(
      "error",
      "Only veterinarians or administrators can save medical records."
    );
    return;
  }

  if (animal.status !== "Quarantine") {
    showToast(
      "warning",
      "Medical records can only be saved while the animal is in quarantine."
    );
    return;
  }

  const type =
    document.getElementById("fMedType").value;

  const date =
    document.getElementById("fMedDate").value;

  if (!type) {
    showToast(
      "error",
      "Please select a record type."
    );
    return;
  }

  if (!date) {
    showToast(
      "error",
      "Please select a date."
    );
    return;
  }

  if (
    type === "Quarantine Clearance" &&
    !can("set_clearance")
  ) {
    showToast(
      "error",
      "You do not have permission to set quarantine clearance."
    );

    return;
  }

  const inventoryItemId =
    document.getElementById(
      "fMedInventoryItem"
    )?.value || "";

  const quantityUsed =
    parseInt(
      document.getElementById(
        "fMedQuantityUsed"
      )?.value,
      10
    ) || 0;

  if (quantityUsed > 0 && !inventoryItemId) {
    showToast(
      "error",
      "Please select the medicine or medical supply used."
    );

    return;
  }

  if (inventoryItemId && quantityUsed < 1) {
    showToast(
      "error",
      "Please enter the quantity used."
    );

    return;
  }

  const selectedClearance =
    document.getElementById("fMedClearance").value ||
    "Pending";

  const clearance =
    type === "Quarantine Clearance"
      ? selectedClearance
      : null;

  const payload = {
  type,
  date,

  vet:
    document
      .getElementById("fMedVet")
      .value
      .trim(),

  diagnosis:
    document
      .getElementById("fMedDiagnosis")
      .value
      .trim(),

  treatment:
    document
      .getElementById("fMedTreatment")
      .value
      .trim(),

  notes:
    document
      .getElementById("fMedNotes")
      .value
      .trim(),

  clearance,

  weight:
    parseFloat(
      document.getElementById("fMedWeight").value
    ) || null,

  inventoryItemId,
  quantityUsed,
};

  try {
    if (editingMedId) {
      await updateMedicalRecordApi(
        animal.id,
        editingMedId,
        payload
      );

      showToast(
        "success",
        "Medical record updated."
      );
    } else {
      const result = await addMedicalRecordApi(
        animal.id,
        payload
      );

      if (result.inventory) {
        showToast(
          "success",
          `Medical record added and ${quantityUsed} ${
            result.inventory.unit
          } deducted from ${
            result.inventory.itemName
          }.`
        );
      } else {
        showToast(
          "success",
          "Medical record added."
        );
      }
    }

    await refreshAnimal();

    closeModal("medicalModalBackdrop");
    renderAllTabs();
  } catch (err) {
    console.error("[saveMedicalRecord]", err);

    showToast(
      "error",
      err.message || "Failed to save medical record."
    );
  }
}

function mapInventoryItem(item, index = 0) {
  return {
    docId: item.docId || "",
    itemId:
      item.id ||
      item.itemId ||
      item.docId ||
      `INV-${String(index + 1).padStart(3, "0")}`,

    name:
      item.itemDescription ||
      item.name ||
      "Unnamed Item",

    category:
      item.category ||
      "Uncategorized",

    unit:
      item.unit ||
      "pcs",

    currentStock:
      Number(
        item.currentStock ??
        item.quantity ??
        item.stock ??
        item.onHand ??
        0
      ),

    avgMonthlyUsage:
      Number(item.avgMonthlyUsage || 0),

    leadTimeDays:
      Number(item.leadTimeDays || item.leadTime || 7),

    stockoutFrequency:
      Number(item.stockoutFrequency || 0),

    monthlyTurnoverRatio:
      Number(item.monthlyTurnoverRatio || 0),

    averageInventory:
      Number(item.averageInventory || item.currentStock || 0),
  };
}

function getLatestMedicalRecord() {
  const records = [...(animal.medicalRecords || [])];

  if (records.length === 0) {
    return null;
  }

  records.sort((a, b) => {
    const dateA = parseDateValue(a.date)?.getTime() || 0;
    const dateB = parseDateValue(b.date)?.getTime() || 0;

    return dateB - dateA;
  });

  return records[0];
}

function getLatestClearanceStatus() {
  return getLatestClearanceRecord()?.clearance || "Pending";
}

function getLatestClearanceRecord() {
  const clearanceRecords = [
    ...(animal.medicalRecords || []),
  ].filter(
    (record) =>
      record.type === "Quarantine Clearance" &&
      record.clearance
  );

  if (clearanceRecords.length === 0) {
    return null;
  }

  clearanceRecords.sort((a, b) => {
    const dateA =
      parseDateValue(a.date)?.getTime() || 0;

    const dateB =
      parseDateValue(b.date)?.getTime() || 0;

    return dateB - dateA;
  });

  return clearanceRecords[0];
}

async function markReadyForAdoption() {
  if (!can("mark_ready")) {
  showToast(
    "error",
    "You do not have permission to mark animals as ready."
  );
  return;
}

  const clearanceStatus = getLatestClearanceStatus();

  if (animal.status !== "Quarantine") {
    showToast(
      "error",
      "Only animals currently in quarantine can be marked ready."
    );

    return;
  }

  if (clearanceStatus !== "Cleared") {
    showToast(
      "warning",
      "The veterinarian must clear the animal from quarantine first."
    );

    return;
  }

  if (!animal.behavioralAssessment) {
    showToast(
      "warning",
      "Complete the behavioral assessment before marking the animal ready."
    );

    return;
  }

  try {
    await markAnimalReady(animal.id);

    await refreshAnimal();
    renderAllTabs();

    showToast(
      "success",
      `${animalDisplayLabel()} is now ready for adoption.`
    );
  } catch (error) {
    console.error("[markReadyForAdoption]", error);

    showToast(
      "error",
      error.message || "Failed to mark animal as ready."
    );
  }
}

function renderAllTabs() {
  renderHero();
  renderOverviewTab();
  renderMedicalTab();
  renderBehavioralTab();
  renderAdoptionTab();
  renderHistoryTab();
  applyRolePermissions();
}

function openEditModal() {
  if (!can("edit_basic")) {
    showToast(
      "error",
      "You do not have permission to edit the basic animal profile."
    );
    return;
  }

  document.getElementById("eName").value =
    animal.identifyingDescription ||
    animal.shelterLabel ||
    animalDisplayLabel();

  document.getElementById("eSpecies").value =
    animal.species || "Dog";

  document.getElementById("eBreed").value =
    animal.breed || "";

  document.getElementById("eSex").value =
    animal.sex || "Unknown";

  document.getElementById("eAge").value =
    animal.ageEstimate || "";

  document.getElementById("eColor").value =
    animal.color || "";

  document.getElementById("eWeight").value =
    animal.weight || "";

  document.getElementById("eNotes").value =
    animal.notes || "";

  document.getElementById("eCageNumber").value =
    animal.cageNumber || "";

  document.getElementById("eHousingType").value =
    animal.housingType || "Unassigned";

  openModal("editModalBackdrop");
}

async function saveEditProfile() {
  if (!can("edit_basic")) {
    showToast(
      "error",
      "You do not have permission to update the basic animal profile."
    );
    return;
  }

  const payload = {
  identifyingDescription:
    document.getElementById("eName").value.trim(),

  shelterLabel:
    document.getElementById("eName").value.trim(),

  species:
    document.getElementById("eSpecies").value,

  breed:
    document.getElementById("eBreed").value.trim(),

  sex:
    document.getElementById("eSex").value,

  ageEstimate:
    document.getElementById("eAge").value.trim(),

  color:
    document.getElementById("eColor").value.trim(),

  weight:
    parseFloat(
      document.getElementById("eWeight").value
    ) ||
    animal.weight ||
    null,

  notes:
    document.getElementById("eNotes").value.trim(),

  cageNumber:
    document.getElementById("eCageNumber").value.trim(),

  housingType:
    document.getElementById("eHousingType").value,
};

  try {
    await updateAnimal(
      animal.id,
      payload
    );

    await refreshAnimal();

    closeModal("editModalBackdrop");
    renderAllTabs();

    showToast(
      "success",
      "Profile updated successfully."
    );
  } catch (err) {
    console.error(
      "[saveEditProfile]",
      err
    );

    showToast(
      "error",
      err.message ||
        "Failed to update profile."
    );
  }
}

function activateProfileTab(tabName, moveFocus = false) {
  const buttons = [...document.querySelectorAll(".profile-tab")];
  const selectedButton = buttons.find(button => button.dataset.tab === tabName) || buttons[0];
  if (!selectedButton) return;

  buttons.forEach(button => {
    const selected = button === selectedButton;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });

  document.querySelectorAll(".tab-content").forEach(panel => {
    const selected = panel.id === `tab-${selectedButton.dataset.tab}`;
    panel.classList.toggle("active", selected);
    panel.hidden = !selected;
  });

  window.history.replaceState(null, "", `#${selectedButton.dataset.tab}`);
  if (moveFocus) selectedButton.focus();
}

function bindTabs() {
  const buttons = [...document.querySelectorAll(".profile-tab")];
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => activateProfileTab(button.dataset.tab));
    button.addEventListener("keydown", event => {
      if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) return;
      event.preventDefault();
      const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
      const nextIndex = (index + (forward ? 1 : -1) + buttons.length) % buttons.length;
      activateProfileTab(buttons[nextIndex].dataset.tab, true);
    });
  });

  const requestedTab = window.location.hash.replace("#", "");
  activateProfileTab(buttons.some(button => button.dataset.tab === requestedTab) ? requestedTab : "overview");
}

function openModal(id) {
  document.getElementById(id)?.classList.add("open");
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}

function closeAll() {
  ["editModalBackdrop", "behavioralModalBackdrop", "medicalModalBackdrop"].forEach(closeModal);
}

let toastT;
function showToast(type, msg) {
  const t = document.getElementById("umToast");
  const i = document.getElementById("toastIcon");
  const m = document.getElementById("toastMsg");
  if (!t) return;
  const icons = {
    success: "bi-check-circle-fill",
    error: "bi-x-circle-fill",
    info: "bi-info-circle-fill",
    warning: "bi-exclamation-triangle-fill"
  };
  t.className = `um-toast toast-${type}`;
  i.className = `bi ${icons[type] || "bi-info-circle-fill"}`;
  m.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 3500);
}

function can(action) {
  return hasPermission(
    currentRole,
    "animals",
    action
  );
}

function canEditBehavioralAssessment() {
  const lockedStatuses = ["Adopted", "Archived"];

  return (
    can("edit_behavioral") &&
    !lockedStatuses.includes(animal.status)
  );
}

function applyRolePermissions() {
  const editProfileButton =
    document.getElementById("btnEditProfile");

  const behavioralButton =
    document.getElementById("btnEditBehavioral");

  const addMedicalButton =
    document.getElementById("btnAddMedical");

  const archiveButton =
    document.getElementById("ddArchive");

  const photoUploadButton =
    document.querySelector(".photo-upload-btn");

  if (editProfileButton) {
    editProfileButton.style.display =
      can("edit_basic") ? "" : "none";
  }

if (behavioralButton) {
  behavioralButton.style.display =
    canEditBehavioralAssessment() ? "" : "none";
}

  if (addMedicalButton) {
    const canShowMedical =
      animal.status === "Quarantine" &&
      can("add_medical");

    addMedicalButton.style.display =
      canShowMedical ? "" : "none";
  }

  if (archiveButton) {
    archiveButton.style.display =
      can("archive") ? "" : "none";
  }

  if (photoUploadButton) {
    photoUploadButton.style.display =
      can("upload_photo") ? "" : "none";
  }
}


async function init() {
  try {
    const session = await protectPageByModule("animals");
    currentRole = session.role;
    currentUser = session.user || null;

    renderTopbarUser();
    await loadSidebar();
    await loadAnimal();
    await loadMedicalInventoryItems();

    renderAllTabs();

    bindTabs();

    document.getElementById("btnEditProfile")?.addEventListener("click", openEditModal);
    document.getElementById("editModalClose")?.addEventListener("click", () => closeModal("editModalBackdrop"));
    document.getElementById("editModalCancel")?.addEventListener("click", () => closeModal("editModalBackdrop"));
    document.getElementById("editModalSave")?.addEventListener("click", saveEditProfile);

    document.getElementById("btnEditBehavioral")?.addEventListener("click", openBehavioralModal);
    document.getElementById("behavioralModalClose")?.addEventListener("click", () => closeModal("behavioralModalBackdrop"));
    document.getElementById("behavioralModalCancel")?.addEventListener("click", () => closeModal("behavioralModalBackdrop"));
    document.getElementById("behavioralModalSave")?.addEventListener("click", saveBehavioralAssessment);

    document.getElementById("btnAddMedical")?.addEventListener("click", () => openMedicalModal());
    document.getElementById("btnMarkReady")?.addEventListener("click", markReadyForAdoption);
    document.getElementById("medicalModalClose")?.addEventListener("click", () => closeModal("medicalModalBackdrop"));
    document.getElementById("medicalModalCancel")?.addEventListener("click", () => closeModal("medicalModalBackdrop"));
    document.getElementById("medicalModalSave")?.addEventListener("click", saveMedicalRecord);

    document
  .getElementById("ddArchive")
  ?.addEventListener("click", async () => {
    if (!can("archive")) {
      showToast(
        "error",
        "Only administrators can archive animal records."
      );
      return;
    }

    try {
      await archiveAnimalApi(animal.id);
      await refreshAnimal();

      renderAllTabs();

      showToast(
        "info",
        `${animalDisplayLabel()} has been archived.`
      );
    } catch (err) {
      console.error("[archiveAnimal]", err);

      showToast(
        "error",
        err.message || "Failed to archive animal."
      );
    }
  });

    const uploadBtn = document.querySelector(".photo-upload-btn");

    if (uploadBtn) {
      uploadBtn.style.position = "absolute";
      uploadBtn.style.bottom = "-5px";
      uploadBtn.style.right = "-5px";
    }

    document
  .getElementById("photoInput")
  ?.addEventListener("change", async (event) => {
    if (!can("upload_photo")) {
      event.target.value = "";

      showToast(
        "error",
        "You do not have permission to upload or change the animal photo."
      );

      return;
    }

    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const photoElement =
        document.getElementById("profilePhoto");

      photoElement.innerHTML = `
        <img
          src="${readerEvent.target.result}"
          alt="${animalDisplayLabel()}"
        />
      `;
    };

    reader.readAsDataURL(file);

    await uploadAnimalPhoto();
  });

    ["editModalBackdrop", "behavioralModalBackdrop", "medicalModalBackdrop"].forEach(id => {
      document.getElementById(id)?.addEventListener("click", e => {
        if (e.target.id === id) closeModal(id);
      });
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeAll();
    });

    document.body.classList.remove("loading");
  } catch (err) {
    console.error("Animal Profile init failed:", err);
    document.body.classList.remove("loading");
  }
}

window.addEventListener("DOMContentLoaded", init);
