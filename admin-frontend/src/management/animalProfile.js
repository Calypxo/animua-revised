import { API_BASE_URL } from "../utils/api.js";
import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../css/animalProfiling.css";

import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { getUserName } from "../utils/storage.js";

import {
  getAnimalById,
  updateAnimal,
  saveBehavioralAssessment as saveBehavioralAssessmentApi,
  addMedicalRecord as addMedicalRecordApi,
  updateMedicalRecord as updateMedicalRecordApi,
  archiveAnimal as archiveAnimalApi
} from "../services/animal.service.js";

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
  "#186534", "#2558a8", "#0d6e6e", "#b86a00", "#6f191c", "#9b2c4e", "#97262b",
  "#2f855a", "#3182ce", "#2c7a7b", "#d69e2e", "#c05621", "#805ad5", "#dd6b20",
  "#38a169", "#4c51bf", "#b83280"
];

let animal = null;
let editingMedId = null;

const speciesEmoji = s => ({ Dog: "🐶", Cat: "🐱", Rabbit: "🐰", Bird: "🐦" }[s] || "🐾");

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
  "Quarantine Clearance": { cls: "med-clearance", icon: "bi-patch-check-fill" },
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
  "Status changed": "#6f191c",
  "Adopted": "#9b2c4e",
  "Cleared from quarantine": "#186534",
  "Marked ready": "#186534",
};

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
    window.location.href = "/pages/animalProfiling.html";
    return;
  }

  try {
    animal = await getAnimalById(id);
    animal.history = animal.history || [];
    animal.medicalRecords = animal.medicalRecords || [];
  } catch (err) {
    console.error("[loadAnimal]", err);
    alert("Animal not found.");
    window.location.href = "/pages/animalProfiling.html";
  }
}

async function refreshAnimal() {
  animal = await getAnimalById(animal.id);
  animal.history = animal.history || [];
  animal.medicalRecords = animal.medicalRecords || [];
}

function renderHero() {
  document.title = `ANIMUA — ${animal.name}`;
  document.getElementById("profileBreadcrumb").textContent = animal.name;
  document.getElementById("profileName").textContent = animal.name;
  document.getElementById("profileStatusBadge").innerHTML = statusBadge(animal.status);
  const profilePhotoEl = document.getElementById("profilePhoto");
  profilePhotoEl.innerHTML = animal.photoURL
    ? `<img src="${animal.photoURL}" alt="${animal.name}" />`
    : speciesEmoji(animal.species);

  document.getElementById("profileMeta").innerHTML = `
    <span><i class="bi bi-tag-fill" style="color:var(--clay)"></i> ${animal.id}</span>
    <span>·</span>
    <span>${animal.species} · ${animal.breed || "Unknown breed"}</span>
    <span>·</span>
    <span>${animal.sex}</span>
    <span>·</span>
    <span>${animal.ageEstimate || "Age unknown"}</span>
    <span>·</span>
    <span>${daysSince(animal.intakeDate)}d in shelter</span>`;

  const sc = statusCfg[animal.status] || statusCfg.Profiling;
  document.getElementById("profileTags").innerHTML = `
    <span class="profile-tag" style="background:${sc.bg};color:${sc.color}">${animal.status}</span>
    <span class="profile-tag" style="background:var(--cream-2);color:var(--stone)">${animal.source}</span>
    <span class="profile-tag" style="background:var(--cream-2);color:var(--stone)">${animal.color || "Unknown color"}</span>`;

  const btn = document.getElementById("btnStatusChange");
  if (animal.status === "Profiling" || animal.status === "Quarantine") {
    btn.style.display = "";
    btn.innerHTML = `<i class="bi bi-house-heart-fill"></i> Mark Ready`;
    btn.onclick = () => markStatusChange("Ready");
  } else if (animal.status === "Ready") {
    btn.style.display = "";
    btn.innerHTML = `<i class="bi bi-house-heart-fill"></i> Process Adoption`;
    btn.onclick = () => window.location.href = `/pages/adoptionApplications.html?animalId=${animal.id}`;
  } else {
    btn.style.display = "none";
  }
}

async function uploadAnimalPhoto() {
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
      ? `<img src="${animal.photoURL}" alt="${animal.name}" />`
      : `<span>${(animal.name || "A")[0]}</span>`;

    input.value = "";

    showToast("success", "Photo updated successfully.");
  } catch (err) {
    console.error("[uploadAnimalPhoto]", err);
    showToast("error", err.message || "Failed to upload image.");
  }
}


async function markStatusChange(newStatus) {
  try {
    await updateAnimal(animal.id, { status: newStatus });
    await refreshAnimal();
    renderHero();
    renderOverviewTab();
    renderMedicalTab();
    renderBehavioralTab();
    renderAdoptionTab();
    renderHistoryTab();
    showToast("success", `${animal.name} marked as ${newStatus}.`);
  } catch (err) {
    console.error("[markStatusChange]", err);
    showToast("error", err.message || "Failed to update status.");
  }
}

function renderOverviewTab() {
  const infoField = (lbl, val) =>
    `<div class="info-item"><div class="info-lbl">${lbl}</div><div class="info-val">${val || "—"}</div></div>`;

  document.getElementById("basicInfoGrid").innerHTML = `
    ${infoField("Animal ID", `<span style="font-family:var(--mono);font-size:0.82rem">${animal.id}</span>`)}
    ${infoField("Name / Alias", animal.name)}
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
    ${infoField("Condition Notes", animal.conditionNotes ? `<span style="font-size:0.84rem;color:var(--stone)">${animal.conditionNotes}</span>` : "None recorded")}`;
    
}

function renderMedicalTab() {
  const list = document.getElementById("medicalRecordsList");
  const recs = animal.medicalRecords || [];

  if (!recs.length) {
    list.innerHTML = `<div class="behavioral-empty"><i class="bi bi-clipboard2-x"></i><p>No medical records yet. Add the first record.</p></div>`;
  } else {
    list.innerHTML = recs.slice().reverse().map(r => {
      const tc = medTypeCfg[r.type] || medTypeCfg.Checkup;
      const cc = clearanceCfg[r.clearance] || clearanceCfg.Pending;
      return `
        <div class="medical-record-card">
          <div class="med-card-header">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="med-type-badge ${tc.cls}"><i class="bi ${tc.icon}"></i>${r.type}</span>
              <span class="clearance-badge ${cc.cls}">${cc.label}</span>
            </div>
            <div class="d-flex align-items-center gap-3">
              <span class="med-card-date">${formatDate(r.date)}</span>
              <span class="med-card-vet"><i class="bi bi-person-fill me-1"></i>${r.vet || "—"}</span>
              <button class="tbl-action-btn" data-med-edit="${r.id}" title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
            </div>
          </div>
          <div class="med-card-body">
            ${r.diagnosis ? `<p><strong>Findings:</strong> ${r.diagnosis}</p>` : ""}
            ${r.treatment ? `<p><strong>Treatment:</strong> ${r.treatment}</p>` : ""}
            ${r.weight ? `<p><strong>Weight:</strong> ${r.weight} kg</p>` : ""}
            ${r.notes ? `<p><strong>Notes:</strong> ${r.notes}</p>` : ""}
          </div>
        </div>`;
    }).join("");

    list.querySelectorAll("[data-med-edit]").forEach(btn => {
      btn.addEventListener("click", () => openMedicalModal(btn.dataset.medEdit));
    });
  }

  const lastClearance = recs.filter(r => r.clearance).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const clearStatus = lastClearance?.clearance || "Pending";
  const cc = clearanceCfg[clearStatus] || clearanceCfg.Pending;

  document.getElementById("quarantineCard").innerHTML = `
    <div class="qs-title"><i class="bi bi-shield-plus"></i> Quarantine Summary</div>
    <div class="qs-grid">
      <div class="qs-item"><div class="qs-lbl">Clearance Status</div>
        <div class="qs-val"><span class="clearance-badge ${cc.cls}">${cc.label}</span></div>
      </div>
      <div class="qs-item"><div class="qs-lbl">Total Records</div><div class="qs-val">${recs.length}</div></div>
      <div class="qs-item"><div class="qs-lbl">Last Visit</div><div class="qs-val">${lastClearance ? formatDate(lastClearance.date) : "—"}</div></div>
    </div>`;
}

function renderBehavioralTab() {
  const el = document.getElementById("behavioralContent");
  const lbl = document.getElementById("behavioralBtnLabel");

  if (!animal.behavioralAssessment) {
    lbl.textContent = "Add Assessment";
    el.innerHTML = `
      <div class="behavioral-empty">
        <i class="bi bi-cpu"></i>
        <p>No behavioral assessment recorded yet.</p>
        <p style="font-size:0.82rem;color:var(--stone-2)">
          Record the animal's behavioral dimensions for compatibility matching.
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
          <p style="margin-top:6px;font-size:0.82rem;color:var(--ink-3)">
            ${traitCount} behavioral dimensions scored on a 1–5 scale.
          </p>
          ${animal.behavioralNotes
            ? `<p style="margin-top:6px;font-size:0.82rem;color:var(--ink-3)">"${animal.behavioralNotes}"</p>`
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
      <div class="adoption-ready-banner" style="background:var(--rose-soft);border-color:rgba(155,44,78,0.2)">
        <i class="bi bi-balloon-heart-fill" style="color:var(--rose)"></i>
        <div>
          <h4 style="color:var(--rose)">Animal Adopted!</h4>
          <p style="color:#6b1432">This animal has found their forever home.</p>
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
        <div class="qs-item"><div class="qs-lbl">Behavioral Assessment</div><div class="qs-val">${animal.behavioralAssessment ? "✓ Complete" : "✗ Pending"}</div></div>
      </div>
    </div>
    <div class="mt-3">
      <a href="/pages/adoptionApplications.html?animalId=${animal.id}" class="btn-primary-clay">
        <i class="bi bi-person-check-fill"></i> View Adoption Applications
      </a>
    </div>`;
  return;
}

  const missingItems = [];
  if (!animal.behavioralAssessment) missingItems.push("Behavioral assessment not yet completed");
  const lastMed = (animal.medicalRecords || []).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  if (!lastMed || lastMed.clearance !== "Cleared") missingItems.push("Medical / quarantine not yet cleared");

  btn.style.display = missingItems.length === 0 ? "" : "none";

  el.innerHTML = `
    <div class="adoption-status-card">
      <div class="qs-title mb-3"><i class="bi bi-info-circle-fill"></i> Adoption Readiness</div>
      <div class="qs-grid" style="margin-bottom:16px">
        <div class="qs-item"><div class="qs-lbl">Current Status</div><div class="qs-val">${animal.status}</div></div>
        <div class="qs-item"><div class="qs-lbl">Behavioral Assessment</div>
          <div class="qs-val" style="color:${animal.behavioralAssessment ? "var(--green)" : "var(--clay)"}">
            ${animal.behavioralAssessment ? "✓ Complete" : "✗ Pending"}
          </div>
        </div>
        <div class="qs-item"><div class="qs-lbl">Medical Clearance</div>
          <div class="qs-val" style="color:${lastMed?.clearance === "Cleared" ? "var(--green)" : "var(--amber)"}">
            ${lastMed?.clearance === "Cleared" ? "✓ Cleared" : "⚠ Not cleared"}
          </div>
        </div>
      </div>
      ${missingItems.length ? `
        <div style="background:var(--amber-soft);border-radius:10px;padding:12px 16px;">
          <p style="font-size:0.82rem;font-weight:700;color:var(--amber);margin-bottom:8px"><i class="bi bi-exclamation-triangle-fill me-1"></i>Required before marking Ready:</p>
          <ul style="margin:0;padding-left:18px;font-size:0.82rem;color:var(--ink-3)">
            ${missingItems.map(m => `<li>${m}</li>`).join("")}
          </ul>
        </div>` : `
        <div style="background:var(--green-soft);border-radius:10px;padding:12px 16px;">
          <p style="font-size:0.82rem;font-weight:700;color:var(--green);margin:0"><i class="bi bi-check-circle-fill me-1"></i>All requirements met. Animal can be marked as Ready for Adoption.</p>
        </div>`}
    </div>`;
}

function renderHistoryTab() {
  const hist = (animal.history || []).slice().reverse();
  if (!hist.length) {
    document.getElementById("historyTimeline").innerHTML =
      `<p style="color:var(--stone);font-size:0.88rem">No history recorded yet.</p>`;
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

function openBehavioralModal() {
  const ba = animal.behavioralAssessment || {};
  document.getElementById("behavioralNotes").value = animal.behavioralNotes || "";
  document.getElementById("behavioralAssessor").value = animal.behavioralAssessor || getUserName()?.split(" ")[0] || "";

  const grid = document.getElementById("traitGrid");
  grid.innerHTML = TRAITS.map((t, i) => {
    const val = ba[t.key] ?? 3;
    return `
      <div class="trait-modal-row">
        <div class="trait-modal-header">
          <span class="trait-modal-name">${t.label}</span>
          <span class="trait-modal-score" id="score-${t.key}">${val}</span>
        </div>
        <input type="range" class="trait-slider" id="slider-${t.key}"
          min="1" max="5" step="1" value="${val}"
          style="--val:${val}" />
        <div class="trait-modal-desc">${t.desc}</div>
      </div>`;
  }).join("");

  TRAITS.forEach(t => {
    const slider = document.getElementById(`slider-${t.key}`);
    const score = document.getElementById(`score-${t.key}`);
    slider?.addEventListener("input", () => {
      score.textContent = slider.value;
      slider.style.setProperty("--val", slider.value);
    });
  });

  openModal("behavioralModalBackdrop");
}

async function saveBehavioralAssessment() {
  const traits = {};
  TRAITS.forEach(t => {
    traits[t.key] = parseInt(document.getElementById(`slider-${t.key}`)?.value || 3);
  });

  const notes = document.getElementById("behavioralNotes").value.trim();
  const assessor = document.getElementById("behavioralAssessor").value.trim() || getUserName()?.split(" ")[0] || "Staff";

  try {
    await saveBehavioralAssessmentApi(animal.id, { traits, notes, assessor });
    await refreshAnimal();

    closeModal("behavioralModalBackdrop");
    renderBehavioralTab();
    renderHistoryTab();
    renderAdoptionTab();
    showToast("success", "Behavioral assessment saved.");
  } catch (err) {
    console.error("[saveBehavioralAssessment]", err);
    showToast("error", err.message || "Failed to save behavioral assessment.");
  }
}

function openMedicalModal(medId = null) {
  editingMedId = medId;
  document.getElementById("medicalModalTitle").textContent = medId ? "Edit Medical Record" : "Add Medical Record";
  document.getElementById("medicalForm").reset();
  document.getElementById("fMedDate").value = new Date().toISOString().split("T")[0];

  if (medId) {
    const rec = (animal.medicalRecords || []).find(r => r.id === medId);
    if (rec) {
      document.getElementById("fMedType").value = rec.type;
      document.getElementById("fMedDate").value = rec.date;
      document.getElementById("fMedVet").value = rec.vet || "";
      document.getElementById("fMedDiagnosis").value = rec.diagnosis || "";
      document.getElementById("fMedTreatment").value = rec.treatment || "";
      document.getElementById("fMedNotes").value = rec.notes || "";
      document.getElementById("fMedClearance").value = rec.clearance || "Pending";
      document.getElementById("fMedWeight").value = rec.weight || "";
    }
  }

  openModal("medicalModalBackdrop");
}

async function saveMedicalRecord() {
  const type = document.getElementById("fMedType").value;
  const date = document.getElementById("fMedDate").value;

  if (!type) {
    showToast("error", "Please select a record type.");
    return;
  }

  if (!date) {
    showToast("error", "Please select a date.");
    return;
  }

  const payload = {
    type,
    date,
    vet: document.getElementById("fMedVet").value.trim(),
    diagnosis: document.getElementById("fMedDiagnosis").value.trim(),
    treatment: document.getElementById("fMedTreatment").value.trim(),
    notes: document.getElementById("fMedNotes").value.trim(),
    clearance: document.getElementById("fMedClearance").value || "Pending",
    weight: parseFloat(document.getElementById("fMedWeight").value) || null,
  };

  try {
    if (editingMedId) {
      await updateMedicalRecordApi(animal.id, editingMedId, payload);
      showToast("success", "Medical record updated.");
    } else {
      await addMedicalRecordApi(animal.id, payload);
      showToast("success", "Medical record added.");
    }

    await refreshAnimal();
    closeModal("medicalModalBackdrop");
    renderMedicalTab();
    renderAdoptionTab();
    renderHistoryTab();
  } catch (err) {
    console.error("[saveMedicalRecord]", err);
    showToast("error", err.message || "Failed to save medical record.");
  }
}

function openEditModal() {
  document.getElementById("eName").value = animal.name || "";
  document.getElementById("eSpecies").value = animal.species || "Dog";
  document.getElementById("eBreed").value = animal.breed || "";
  document.getElementById("eSex").value = animal.sex || "Unknown";
  document.getElementById("eAge").value = animal.ageEstimate || "";
  document.getElementById("eColor").value = animal.color || "";
  document.getElementById("eWeight").value = animal.weight || "";
  document.getElementById("eStatus").value = animal.status || "Profiling";
  document.getElementById("eNotes").value = animal.notes || "";
  document.getElementById("eCageNumber").value = animal.cageNumber || "";
  document.getElementById("eHousingType").value = animal.housingType || "Unassigned";
  openModal("editModalBackdrop");
}

async function saveEditProfile() {
  const payload = {
    name: document.getElementById("eName").value.trim() || animal.name,
    species: document.getElementById("eSpecies").value,
    breed: document.getElementById("eBreed").value.trim(),
    sex: document.getElementById("eSex").value,
    ageEstimate: document.getElementById("eAge").value.trim(),
    color: document.getElementById("eColor").value.trim(),
    weight: parseFloat(document.getElementById("eWeight").value) || animal.weight || null,
    status: document.getElementById("eStatus").value,
    notes: document.getElementById("eNotes").value.trim(),
    cageNumber: document.getElementById("eCageNumber").value.trim(),
    housingType: document.getElementById("eHousingType").value,
  };

  try {
    await updateAnimal(animal.id, payload);
    await refreshAnimal();

    closeModal("editModalBackdrop");
    renderHero();
    renderOverviewTab();
    renderMedicalTab();
    renderBehavioralTab();
    renderAdoptionTab();
    renderHistoryTab();
    showToast("success", "Profile updated successfully.");
  } catch (err) {
    console.error("[saveEditProfile]", err);
    showToast("error", err.message || "Failed to update profile.");
  }
}

function bindTabs() {
  document.querySelectorAll(".profile-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".profile-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      const tab = document.getElementById(`tab-${btn.dataset.tab}`);
      if (tab) tab.classList.add("active");
    });
  });
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


async function init() {
  try {
    await protectManagementPage();
    renderTopbarUser();
    loadSidebar();
    await loadAnimal();

    renderHero();
    renderOverviewTab();
    renderMedicalTab();
    renderBehavioralTab();
    renderAdoptionTab();
    renderHistoryTab();

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
    document.getElementById("medicalModalClose")?.addEventListener("click", () => closeModal("medicalModalBackdrop"));
    document.getElementById("medicalModalCancel")?.addEventListener("click", () => closeModal("medicalModalBackdrop"));
    document.getElementById("medicalModalSave")?.addEventListener("click", saveMedicalRecord);

    document.getElementById("ddArchive")?.addEventListener("click", async () => {
      try {
        await archiveAnimalApi(animal.id);
        await refreshAnimal();
        renderHero();
        renderHistoryTab();
        renderAdoptionTab();
        showToast("info", `${animal.name} has been archived.`);
      } catch (err) {
        console.error("[archiveAnimal]", err);
        showToast("error", err.message || "Failed to archive animal.");
      }
    });

    const uploadBtn = document.querySelector(".photo-upload-btn");

    if (uploadBtn) {
      uploadBtn.style.position = "absolute";
      uploadBtn.style.bottom = "-5px";
      uploadBtn.style.right = "-5px";
    }

      document.getElementById("photoInput")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // preview
        const reader = new FileReader();
        reader.onload = (ev) => {
          const ph = document.getElementById("profilePhoto");
          ph.innerHTML = `<img src="${ev.target.result}" alt="${animal.name}" />`;
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