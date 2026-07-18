import { API_BASE_URL } from "../utils/api.js";
import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../css/animalProfiling.css";

import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import {
  getUserName,
} from "../utils/storage.js";

import {
  hasPermission,
} from "../auth/permissions.js";

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
let currentRole = "";

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

  btn.style.display = "none";
  btn.onclick = null;

  if (
    animal.status === "Profiling" &&
    can("send_to_quarantine")
  ) {
    btn.style.display = "";

    btn.innerHTML = `
      <i class="bi bi-shield-plus"></i>
      Send to Quarantine
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
      window.location.href =
        `/pages/adoptionApplications.html?animalId=${encodeURIComponent(
          animal.id
        )}`;
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
      ? `<img src="${animal.photoURL}" alt="${animal.name}" />`
      : `<span>${(animal.name || "A")[0]}</span>`;

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
      <p style="font-size:0.82rem;color:var(--stone-2)">
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
              <span class="med-type-badge ${tc.cls}"><i class="bi ${tc.icon}"></i>${r.type}</span>
              <span class="clearance-badge ${cc.cls}">${cc.label}</span>
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

  document.getElementById("quarantineCard").innerHTML = `
    <div class="qs-title"><i class="bi bi-shield-plus"></i> Quarantine Summary</div>
    <div class="qs-grid">
      <div class="qs-item"><div class="qs-lbl">Clearance Status</div>
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
      <div class="qs-grid" style="margin-bottom:16px">
        <div class="qs-item"><div class="qs-lbl">Current Status</div><div class="qs-val">${animal.status}</div></div>
        <div class="qs-item"><div class="qs-lbl">Behavioral Assessment</div>
          <div class="qs-val" style="color:${animal.behavioralAssessment ? "var(--green)" : "var(--clay)"}">
            ${animal.behavioralAssessment ? "✓ Complete" : "✗ Pending"}
          </div>
        </div>
        <div class="qs-item"><div class="qs-lbl">Medical Clearance</div>
          <div class="qs-val" style="color:${clearanceStatus === "Cleared"? "var(--green)" : "var(--amber)"}">
            ${clearanceStatus === "Cleared" ? "✓ Cleared" : "⚠ Not cleared"}
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

async function sendToQuarantine() {
  if (!can("send_to_quarantine")) {
  showToast(
    "error",
    "You do not have permission to send animals to quarantine."
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
    await updateAnimal(animal.id, {
      status: "Quarantine",
      profilingStatus: "Completed",
      quarantineStatus: "Active",
      quarantineClearance: "Pending",
      quarantineStartedAt: new Date().toISOString(),
    });

    await refreshAnimal();
    renderAllTabs();

    showToast(
      "success",
      `${animal.name} has been sent to quarantine.`
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
  if (!can("edit_behavioral")) {
  showToast(
    "error",
    "You do not have permission to save behavioral assessments."
  );
  return;
}

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
    renderAllTabs();
    showToast("success", "Behavioral assessment saved.");
  } catch (err) {
    console.error("[saveBehavioralAssessment]", err);
    showToast("error", err.message || "Failed to save behavioral assessment.");
  }
}

function openMedicalModal(medId = null) {
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

  document.getElementById("medicalModalTitle").textContent =
    medId ? "Edit Medical Record" : "Add Medical Record";

  document.getElementById("medicalForm").reset();

  document.getElementById("fMedDate").value =
    new Date().toISOString().split("T")[0];

  const typeSelect = document.getElementById("fMedType");
  const clearanceField = document.getElementById("fMedClearance")?.parentElement;

  const updateClearanceVisibility = () => {
    const selectedType = typeSelect?.value;
    if (clearanceField) {
      clearanceField.style.display =
        selectedType === "Quarantine Clearance" ? "" : "none";
    }
  };

  typeSelect?.addEventListener("change", updateClearanceVisibility);

  if (medId) {
    const record = (animal.medicalRecords || []).find(
      (item) => item.id === medId
    );

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

  const selectedClearance =
    document.getElementById("fMedClearance").value ||
    "Pending";

  const clearance =
    type === "Quarantine Clearance"
      ? selectedClearance
      : "Pending";

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
      await addMedicalRecordApi(
        animal.id,
        payload
      );

      showToast(
        "success",
        "Medical record added."
      );
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
  const clearanceRecords = [
    ...(animal.medicalRecords || []),
  ].filter(
    (record) =>
      record.type === "Quarantine Clearance" &&
      record.clearance
  );

  if (clearanceRecords.length === 0) {
    return "Pending";
  }

  clearanceRecords.sort((a, b) => {
    const dateA =
      parseDateValue(a.date)?.getTime() || 0;

    const dateB =
      parseDateValue(b.date)?.getTime() || 0;

    return dateB - dateA;
  });

  return clearanceRecords[0].clearance || "Pending";
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
    await updateAnimal(animal.id, {
      status: "Ready",
      quarantineStatus: "Completed",
      quarantineClearance: "Cleared",
      quarantineClearedAt: new Date().toISOString(),
      readyForAdoptionAt: new Date().toISOString(),
    });

    await refreshAnimal();
    renderAllTabs();

    showToast(
      "success",
      `${animal.name} is now ready for adoption.`
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
    animal.name || "";

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
    name:
      document.getElementById("eName").value.trim() ||
      animal.name,

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

function can(action) {
  return hasPermission(
    currentRole,
    "animals",
    action
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
      can("edit_behavioral") ? "" : "none";
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
    const session = await protectManagementPage();

    currentRole = session.role;

    renderTopbarUser();
    loadSidebar();
    await loadAnimal();

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
        `${animal.name} has been archived.`
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
          alt="${animal.name}"
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