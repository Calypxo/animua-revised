// admin-frontend/src/management/intake.js
import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../css/intake.css";

import { protectManagementPage }       from "../auth/authGuard.js";
import { renderTopbarUser }            from "../components/management/topbarUser.js";
import { loadSidebar }                 from "../components/management/sidebarLoader.js";
import { getUserRole, getUserName }    from "../utils/storage.js";
import { BARANGAYS }                   from "../utils/barangays.js";


import {
  getAllIntake,
  getIntakeById,
  createIntake,
  updateIntake,
  approveIntake,
  rejectIntake,
  convertToProfile
} from "../services/intake.service.js";

/* ══════════════════════════════════════════════════════
   MOCK DATA
   Replace with: const data = await apiFetch("/intake")
══════════════════════════════════════════════════════ */
let intakeRecords = [];

/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
let filtered = [];
let currentPage    = 1;
const PAGE_SIZE    = 7;
let activeTab      = "all";
let editingId      = null;
let confirmAction  = null;   // "approve" | "reject" | "convert"
let confirmTargetId = null;
let approvedSurrenderContext = null;

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
const speciesEmoji = s => ({ Dog:"🐶", Cat:"🐱", Rabbit:"🐰", Bird:"🐦" }[s] || "🐾");
const speciesThumb = s => ({ Dog:"thumb-dog", Cat:"thumb-cat", Rabbit:"thumb-rabbit", Bird:"thumb-bird" }[s] || "thumb-other");

const sourceCfg = {
  "Rescue":             { cls:"source-rescue",    icon:"bi-life-preserver",        label:"Rescue"            },
  "Barangay Impound":   { cls:"source-barangay",  icon:"bi-building",              label:"Barangay Impound"  },
  "Approved Surrender": { cls:"source-surrender", icon:"bi-file-earmark-check",    label:"Approved Surrender"},
};

const condCfg = {
  Good:     { cls:"cond-good",     icon:"bi-circle-fill" },
  Fair:     { cls:"cond-fair",     icon:"bi-circle-half" },
  Poor:     { cls:"cond-poor",     icon:"bi-exclamation-circle-fill" },
  Critical: { cls:"cond-critical", icon:"bi-exclamation-triangle-fill" },
};

const statusCfg = {
  Pending:   { cls:"badge-pending",   icon:"bi-hourglass-split"        },
  Approved:  { cls:"badge-approved",  icon:"bi-clipboard2-check-fill"  },
  Converted: { cls:"badge-converted", icon:"bi-check-circle-fill"      },
  Rejected:  { cls:"badge-rejected",  icon:"bi-x-circle-fill"          },
  Draft:     { cls:"badge-draft",     icon:"bi-pencil-square"          },
};

function sourceBadge(source) {
  const c = sourceCfg[source] || { cls:"source-rescue", icon:"bi-question-circle", label:source };
  return `<span class="source-badge ${c.cls}"><i class="bi ${c.icon}"></i>${c.label}</span>`;
}

function condBadge(cond) {
  const c = condCfg[cond] || { cls:"cond-fair", icon:"bi-circle" };
  return `<span class="cond-badge ${c.cls}"><i class="bi ${c.icon}"></i>${cond}</span>`;
}

function statusBadge(status) {
  const c = statusCfg[status] || statusCfg.Pending;
  return `<span class="status-badge ${c.cls}"><i class="bi ${c.icon}"></i>${status}</span>`;
}


function today() {
  return new Date().toISOString().split("T")[0];
}


/* ══════════════════════════════════════════════════════
   STATS
══════════════════════════════════════════════════════ */
function renderStats() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("statAll",       intakeRecords.length);
  set("statPending",   intakeRecords.filter(r => r.status === "Pending").length);
  set("statApproved",  intakeRecords.filter(r => r.status === "Approved").length);
  set("statConverted", intakeRecords.filter(r => r.status === "Converted").length);
  set("statRejected",  intakeRecords.filter(r => r.status === "Rejected").length);
}

/* ══════════════════════════════════════════════════════
   FILTER
══════════════════════════════════════════════════════ */
function applyFilters() {
  const q       = (document.getElementById("searchIntake")?.value  || "").toLowerCase().trim();
  const source  = document.getElementById("filterSource")?.value   || "";
  const species = document.getElementById("filterSpecies")?.value  || "";

  filtered = intakeRecords.filter(r => {
    if (activeTab !== "all" && r.status !== activeTab) return false;
    if (source && r.source !== source) return false;
    if (species && r.species !== species) return false;

    const id = (r.id || "").toLowerCase();
    const animalName = (r.animalName || "").toLowerCase();
    const speciesName = (r.species || "").toLowerCase();
    const breed = (r.breed || "").toLowerCase();

    if (q && !id.includes(q) && !animalName.includes(q) && !speciesName.includes(q) && !breed.includes(q)) {
      return false;
    }

    return true;
  });

  currentPage = 1;
  renderTable();
  renderPagination();
}

/* ══════════════════════════════════════════════════════
   TABLE
══════════════════════════════════════════════════════ */
function renderTable() {
  const tbody = document.getElementById("intakeTableBody");
  if (!tbody) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = filtered.slice(start, start + PAGE_SIZE);

  if (!page.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">No intake records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = page.map(r => {
    const canApprove = r.status === "Pending";
    const canReject  = r.status === "Pending";
    const canConvert = r.status === "Approved";
    const canEdit    = r.status === "Pending" || r.status === "Draft";

    return `
    <tr style="cursor:pointer" data-id="${r.id}">
      <td style="font-family:var(--mono);font-size:0.76rem;color:var(--stone)">${r.id}</td>
      <td>
        <div class="animal-cell">
          <div class="animal-thumb ${speciesThumb(r.species)}">${speciesEmoji(r.species)}</div>
          <div>
            <div class="animal-name">${r.animalName || "Unknown"}</div>
            <div class="animal-sub">${r.species}${r.breed ? " · " + r.breed : ""}</div>
          </div>
        </div>
      </td>
      <td>${sourceBadge(r.source)}</td>
      <td>${condBadge(r.condition)}</td>
      <td style="font-size:0.83rem;color:var(--stone)">${r.encodedBy}</td>
      <td style="font-family:var(--mono);font-size:0.76rem;color:var(--stone)">${formatDate(r.intakeDate)}</td>
      <td>${statusBadge(r.status)}</td>
      <td>
        <button class="tbl-action-btn" title="View Details" data-action="view" data-id="${r.id}">
          <i class="bi bi-eye"></i>
        </button>
        ${canEdit    ? `<button class="tbl-action-btn" title="Edit" data-action="edit" data-id="${r.id}"><i class="bi bi-pencil"></i></button>` : ""}
        ${canApprove ? `<button class="tbl-action-btn approve" title="Approve" data-action="approve" data-id="${r.id}"><i class="bi bi-check-lg"></i></button>` : ""}
        ${canReject  ? `<button class="tbl-action-btn reject"  title="Reject"  data-action="reject"  data-id="${r.id}"><i class="bi bi-x-lg"></i></button>` : ""}
        ${canConvert ? `<button class="tbl-action-btn convert" title="Convert to Profile" data-action="convert" data-id="${r.id}"><i class="bi bi-arrow-right-circle"></i></button>` : ""}
      </td>
    </tr>`;
  }).join("");

  // Row click → view
  tbody.querySelectorAll("tr[data-id]").forEach(row => {
    row.addEventListener("click", e => {
      if (e.target.closest("[data-action]")) return;
      openViewModal(row.dataset.id);
    });
  });

  tbody.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if (action === "view")    openViewModal(id);
      if (action === "edit")    openEditModal(id);
      if (action === "approve") openConfirmModal("approve", id);
      if (action === "reject")  openConfirmModal("reject",  id);
      if (action === "convert") openConfirmModal("convert", id);
    });
  });
}

function formatDate(d) {
  if (!d) return "—";

  let date;

  if (typeof d === "string") {
    date = d.includes("T") ? new Date(d) : new Date(`${d}T00:00:00`);
  } else if (d._seconds) {
    date = new Date(d._seconds * 1000);
  } else {
    date = new Date(d);
  }

  if (isNaN(date)) return "—";

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

/* ══════════════════════════════════════════════════════
   PAGINATION
══════════════════════════════════════════════════════ */
function renderPagination() {
  const bar = document.getElementById("paginationBar");
  if (!bar) return;
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = Math.min((currentPage - 1) * PAGE_SIZE + 1, total);
  const end   = Math.min(currentPage * PAGE_SIZE, total);

  let h = `<span class="page-info">Showing ${total ? start : 0}–${end} of ${total}</span>`;
  h += `<button class="page-btn" id="pagePrev" ${currentPage===1?"disabled":""}><i class="bi bi-chevron-left"></i></button>`;
  for (let i = 1; i <= pages; i++) h += `<button class="page-btn ${i===currentPage?"active":""}" data-page="${i}">${i}</button>`;
  h += `<button class="page-btn" id="pageNext" ${currentPage===pages?"disabled":""}><i class="bi bi-chevron-right"></i></button>`;
  bar.innerHTML = h;

  bar.querySelector("#pagePrev")?.addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderTable(); renderPagination(); } });
  bar.querySelector("#pageNext")?.addEventListener("click", () => { if (currentPage < pages) { currentPage++; renderTable(); renderPagination(); } });
  bar.querySelectorAll("[data-page]").forEach(b => b.addEventListener("click", () => { currentPage = parseInt(b.dataset.page); renderTable(); renderPagination(); }));
}

/* ══════════════════════════════════════════════════════
   SOURCE SELECTOR
══════════════════════════════════════════════════════ */
function bindSourceSelector() {
  document.querySelectorAll(".source-opt").forEach(opt => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".source-opt").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      document.getElementById("fSource").value = opt.dataset.value;
      document.getElementById("errSource").textContent = "";
      renderDynamicSection(opt.dataset.value);
    });
  });
}

function setSource(value) {
  document.querySelectorAll(".source-opt").forEach(o => {
    o.classList.toggle("selected", o.dataset.value === value);
  });
  document.getElementById("fSource").value = value;
  renderDynamicSection(value);
}

/* ══════════════════════════════════════════════════════
   DYNAMIC SECTION (source-specific fields)
══════════════════════════════════════════════════════ */
function renderDynamicSection(source) {
  const section = document.getElementById("dynamicSection");
  if (!section) return;

  if (source === "Barangay Impound") {
    section.innerHTML = `
      <div class="form-section">
        <div class="form-section-title"><i class="bi bi-building"></i> Barangay Turnover Details</div>
        <div class="dynamic-card">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-lbl" for="fBarangayName">Barangay Name <span class="req">*</span></label>
              <select class="form-inp" id="fBarangayName"></select>
              <span class="form-err" id="errBarangayName"></span>
            </div>
            <div class="form-group">
              <label class="form-lbl" for="fOfficerName">Barangay Officer / Captain</label>
              <input type="text" class="form-inp" id="fOfficerName" placeholder="Full name" />
            </div>
            <div class="form-group">
              <label class="form-lbl" for="fOfficerContact">Officer Contact</label>
              <input type="text" class="form-inp" id="fOfficerContact" placeholder="Phone number" />
            </div>
            <div class="form-group">
              <label class="form-lbl" for="fTurnoverDate">Turnover Date</label>
              <input type="date" class="form-inp" id="fTurnoverDate" />
            </div>
            <div class="form-group form-full">
              <label class="form-lbl" for="fImpoundReason">Reason for Impound</label>
              <input type="text" class="form-inp" id="fImpoundReason" placeholder="e.g. Roaming / public disturbance" />
            </div>
          </div>
        </div>
      </div>`;
  } else if (source === "Approved Surrender") {
    section.innerHTML = `
      <div class="form-section">
        <div class="form-section-title"><i class="bi bi-file-earmark-check"></i> Surrender Reference</div>
        <div class="dynamic-card">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-lbl" for="fSurrenderRef">Surrender Request ID <span class="req">*</span></label>
              <input type="text" class="form-inp" id="fSurrenderRef" placeholder="e.g. SR-2025-009" />
              <span class="form-err" id="errSurrenderRef"></span>
            </div>
            <div class="form-group">
              <label class="form-lbl" for="fOwnerName">Owner Name</label>
              <input type="text" class="form-inp" id="fOwnerName" placeholder="Full name of owner" />
            </div>
            <div class="form-group">
              <label class="form-lbl" for="fOwnerContact">Owner Contact</label>
              <input type="text" class="form-inp" id="fOwnerContact" placeholder="Phone number" />
            </div>
            <div class="form-group">
              <label class="form-lbl" for="fSurrenderApprovedDate">Surrender Approved Date</label>
              <input type="date" class="form-inp" id="fSurrenderApprovedDate" />
            </div>
          </div>
        </div>
      </div>`;
  } else {
    // Rescue — no extra fields needed
    section.innerHTML = "";
  }
  const select = document.getElementById("fBarangayName");
if (select) {
  select.innerHTML = `
    <option value="">Select Barangay</option>
    ${BARANGAYS.map(b => `<option value="${b}">${b}</option>`).join("")}
  `;
}
}

/* ══════════════════════════════════════════════════════
   OPEN ADD / EDIT MODAL
══════════════════════════════════════════════════════ */
function openAddModal() {
  editingId = null;
  document.getElementById("intakeModalTitle").textContent    = "New Intake Record";
  document.getElementById("intakeModalSubtitle").textContent = "Fill in all required fields and submit for review.";
  document.getElementById("intakeForm").reset();
  document.getElementById("fIntakeId").value = "";
  document.getElementById("fIntakeDate").value = today();
  document.querySelectorAll(".source-opt").forEach(o => o.classList.remove("selected"));
  document.getElementById("fSource").value = "";
  document.getElementById("dynamicSection").innerHTML = "";
  clearFormErrors();
  openModal("intakeModalBackdrop");
}

function openApprovedSurrenderIntakeModal() {
  const saved = sessionStorage.getItem("approved_surrender_for_intake");

  if (!saved) return;

  const surrender = JSON.parse(saved);
  approvedSurrenderContext = surrender;

  editingId = null;

  document.getElementById("intakeModalTitle").textContent = "New Intake from Approved Surrender";
  document.getElementById("intakeModalSubtitle").textContent =
    "Review and complete the intake details before submitting.";

  document.getElementById("intakeForm").reset();
  document.getElementById("fIntakeId").value = "";
  document.getElementById("fIntakeDate").value = today();

  document.getElementById("fAnimalName").value = surrender.petName || "";
  document.getElementById("fSpecies").value = surrender.species || "";
  document.getElementById("fBreed").value = surrender.breed || "";
  document.getElementById("fSex").value = surrender.sex || "";
  document.getElementById("fAgeEstimate").value = surrender.age || "";
  document.getElementById("fColor").value = surrender.colorMarkings || "";
  document.getElementById("fCondition").value = "Fair";

  document.getElementById("fIntakeNotes").value =
    surrender.surrenderReason
      ? `From approved surrender request ${surrender.surrenderId}. Reason: ${surrender.surrenderReason}`
      : `From approved surrender request ${surrender.surrenderId}.`;

  // This creates the surrender reference fields
  setSource("Approved Surrender");

  // Fill the surrender reference fields after they exist
  setTimeout(() => {
    const surrenderRefInput = document.getElementById("fSurrenderRef");
    const ownerNameInput = document.getElementById("fOwnerName");
    const ownerContactInput = document.getElementById("fOwnerContact");
    const approvedDateInput = document.getElementById("fSurrenderApprovedDate");

    if (surrenderRefInput) {
      surrenderRefInput.value = surrender.surrenderId || "";
    }

    if (ownerNameInput) {
      ownerNameInput.value = surrender.ownerName || "";
    }

    if (ownerContactInput) {
      ownerContactInput.value = surrender.ownerContact || "";
    }

    if (approvedDateInput) {
      approvedDateInput.value = surrender.approvedDate || today();
    }

    console.log("Approved surrender prefill:", {
      surrenderId: surrender.surrenderId,
      ownerName: surrender.ownerName,
      ownerContact: surrender.ownerContact,
      approvedDate: surrender.approvedDate,
    });
  }, 150);

  clearFormErrors();
  openModal("intakeModalBackdrop");
}

function openEditModal(id) {
  const r = intakeRecords.find(x => x.id === id);
  if (!r) return;
  editingId = id;

  document.getElementById("intakeModalTitle").textContent    = `Edit Intake — ${r.id}`;
  document.getElementById("intakeModalSubtitle").textContent = "Update the intake details below.";
  document.getElementById("fIntakeId").value  = id;
  document.getElementById("fAnimalName").value = r.animalName || "";
  document.getElementById("fSpecies").value    = r.species;
  document.getElementById("fBreed").value      = r.breed     || "";
  document.getElementById("fSex").value        = r.sex;
  document.getElementById("fAgeEstimate").value = r.ageEstimate || "";
  document.getElementById("fColor").value      = r.color     || "";
  document.getElementById("fCondition").value  = r.condition;
  document.getElementById("fWeight").value     = r.weight    || "";
  document.getElementById("fConditionNotes").value = r.conditionNotes || "";
  document.getElementById("fIntakeDate").value = r.intakeDate || today();
  document.getElementById("fLocation").value   = r.location  || "";
  document.getElementById("fIntakeNotes").value = r.intakeNotes || "";

  // Radio buttons
  const injVal = r.injuries   || "Unknown";
  const vacVal = r.vaccinated || "Unknown";
  document.querySelectorAll("input[name='injuries']").forEach(rb => { rb.checked = rb.value === injVal; });
  document.querySelectorAll("input[name='vaccinated']").forEach(rb => { rb.checked = rb.value === vacVal; });

  setSource(r.source);

  // Populate barangay / surrender fields after dynamic section renders
  setTimeout(() => {
    if (r.source === "Barangay Impound" && r.barangayDetails) {
      const b = r.barangayDetails;
      document.getElementById("fBarangayName").value   = b.barangayName   || "";
      document.getElementById("fOfficerName").value    = b.officerName    || "";
      document.getElementById("fOfficerContact").value = b.officerContact || "";
      document.getElementById("fTurnoverDate").value   = b.turnoverDate   || "";
      document.getElementById("fImpoundReason").value  = b.impoundReason  || "";
    }
    if (r.source === "Approved Surrender" && r.surrenderRefId) {
      document.getElementById("fSurrenderRef").value            = r.surrenderRefId || "";
      document.getElementById("fOwnerName").value               = r.ownerName      || "";
      document.getElementById("fOwnerContact").value            = r.ownerContact   || "";
      document.getElementById("fSurrenderApprovedDate").value   = r.surrenderApprovedDate || "";
    }
  }, 50);

  clearFormErrors();
  openModal("intakeModalBackdrop");
}

/* ══════════════════════════════════════════════════════
   SAVE INTAKE
══════════════════════════════════════════════════════ */
function collectFormData(asDraft = false) {
  const source    = document.getElementById("fSource").value;
  const injuries  = document.querySelector("input[name='injuries']:checked")?.value   || "Unknown";
  const vaccinated= document.querySelector("input[name='vaccinated']:checked")?.value || "Unknown";

  const record = {
    animalName:     document.getElementById("fAnimalName").value.trim()       || "Unknown",
    species:        document.getElementById("fSpecies").value,
    breed:          document.getElementById("fBreed").value.trim(),
    sex:            document.getElementById("fSex").value,
    ageEstimate:    document.getElementById("fAgeEstimate").value.trim(),
    color:          document.getElementById("fColor").value.trim(),
    source,
    condition:      document.getElementById("fCondition").value,
    weight:         document.getElementById("fWeight").value,
    conditionNotes: document.getElementById("fConditionNotes").value.trim(),
    injuries, vaccinated,
    intakeDate:     document.getElementById("fIntakeDate").value,
    location:       document.getElementById("fLocation").value.trim(),
    intakeNotes:    document.getElementById("fIntakeNotes").value.trim(),
    encodedBy:      getUserName()?.split(" ")[0] || "Staff",
    status:         asDraft ? "Draft" : "Pending",
    barangayDetails: null,
    surrenderRefId:  null,
  };

  if (source === "Barangay Impound") {
    record.barangayDetails = {
      barangayName:   document.getElementById("fBarangayName")?.value.trim()   || "",
      officerName:    document.getElementById("fOfficerName")?.value.trim()    || "",
      officerContact: document.getElementById("fOfficerContact")?.value.trim() || "",
      turnoverDate:   document.getElementById("fTurnoverDate")?.value          || "",
      impoundReason:  document.getElementById("fImpoundReason")?.value.trim()  || "",
    };
  }

  if (source === "Approved Surrender") {
    record.surrenderRefId  = document.getElementById("fSurrenderRef")?.value.trim()           || null;
    record.ownerName       = document.getElementById("fOwnerName")?.value.trim()              || "";
    record.ownerContact    = document.getElementById("fOwnerContact")?.value.trim()           || "";
    record.surrenderApprovedDate = document.getElementById("fSurrenderApprovedDate")?.value   || "";
  }

  return record;
}

function validateForm() {
  clearFormErrors();
  let valid = true;

  const source    = document.getElementById("fSource").value;
  const species   = document.getElementById("fSpecies").value;
  const sex       = document.getElementById("fSex").value;
  const condition = document.getElementById("fCondition").value;
  const date      = document.getElementById("fIntakeDate").value;

  if (!source)    { setErr("errSource",    "Please select an intake source."); valid = false; }
  if (!species)   { setErr("errSpecies",   "Species is required.");            valid = false; }
  if (!sex)       { setErr("errSex",       "Sex is required.");                valid = false; }
  if (!condition) { setErr("errCondition", "Condition is required.");          valid = false; }
  if (!date)      { setErr("errIntakeDate","Intake date is required.");        valid = false; }

  if (source === "Barangay Impound") {
    const bn = document.getElementById("fBarangayName")?.value.trim();
    if (!bn) { setErr("errBarangayName", "Barangay name is required."); valid = false; }
  }

  if (source === "Approved Surrender") {
    const sr = document.getElementById("fSurrenderRef")?.value.trim();
    if (!sr) { setErr("errSurrenderRef", "Surrender reference ID is required."); valid = false; }
  }

  return valid;
}

async function updateSurrenderStatusFromIntake(surrenderId, payload) {
  const token = localStorage.getItem("animua_token");

  const response = await fetch(`http://localhost:5000/api/surrenders/${surrenderId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update surrender request status.");
  }

  return data.request;
}

async function saveIntake(asDraft = false) {
  if (!asDraft && !validateForm()) return;

  if (asDraft && !document.getElementById("fSource").value) {
    setErr("errSource", "Please select a source before saving.");
    return;
  }

  const payload = collectFormData(asDraft);

  try {
    let createdOrUpdatedData = null;

    if (editingId) {
      createdOrUpdatedData = await updateIntake(editingId, payload);
      showToast("success", "Intake record updated.");
    } else {
      createdOrUpdatedData = await createIntake(payload);
      showToast("success", asDraft ? "Draft saved." : "Intake submitted for review.");
    }

    const savedRecord =
      createdOrUpdatedData?.record ||
      createdOrUpdatedData?.intake ||
      createdOrUpdatedData?.data ||
      createdOrUpdatedData;

    const savedIntakeId =
      savedRecord?.id ||
      savedRecord?.intakeId ||
      payload.id ||
      payload.intakeId ||
      null;

    const isFromApprovedSurrender =
      !asDraft &&
      !editingId &&
      payload.source === "Approved Surrender" &&
      payload.surrenderRefId;

    if (isFromApprovedSurrender) {
      await updateSurrenderStatusFromIntake(payload.surrenderRefId, {
        status: "Converted",
        intakeId: savedIntakeId,
        dropoffDate: payload.intakeDate,
      });

      sessionStorage.removeItem("approved_surrender_for_intake");
      approvedSurrenderContext = null;

      showToast("success", "Intake created and surrender request marked as converted.");
    }

    closeModal("intakeModalBackdrop");
    await loadIntakeRecords();
  } catch (err) {
    console.error("[saveIntake]", err);
    showToast("error", err.message || "Failed to save intake record.");
  }
}

/* ══════════════════════════════════════════════════════
   VIEW MODAL
══════════════════════════════════════════════════════ */
function openViewModal(id) {
  const r = intakeRecords.find(x => x.id === id);
  if (!r) return;

  document.getElementById("viewModalTitle").textContent    = r.id;
  document.getElementById("viewModalSubtitle").textContent = `${r.species} · ${r.source} · ${formatDate(r.intakeDate)}`;

  const sc = sourceCfg[r.source] || sourceCfg["Rescue"];
  const cc = condCfg[r.condition] || condCfg["Fair"];

  let dynamicHtml = "";
  if (r.source === "Barangay Impound" && r.barangayDetails) {
    const b = r.barangayDetails;
    dynamicHtml = `
      <div class="view-section">
        <div class="view-section-title">Barangay Turnover Details</div>
        <div class="view-grid">
          <div class="view-field"><div class="view-field-lbl">Barangay</div><div class="view-field-val">${b.barangayName||"—"}</div></div>
          <div class="view-field"><div class="view-field-lbl">Officer</div><div class="view-field-val">${b.officerName||"—"}</div></div>
          <div class="view-field"><div class="view-field-lbl">Contact</div><div class="view-field-val">${b.officerContact||"—"}</div></div>
          <div class="view-field"><div class="view-field-lbl">Turnover Date</div><div class="view-field-val">${formatDate(b.turnoverDate)||"—"}</div></div>
          <div class="view-field view-full"><div class="view-field-lbl">Impound Reason</div><div class="view-field-val">${b.impoundReason||"—"}</div></div>
        </div>
      </div>`;
  } else if (r.source === "Approved Surrender") {
    dynamicHtml = `
      <div class="view-section">
        <div class="view-section-title">Surrender Reference</div>
        <div class="view-grid">
          <div class="view-field"><div class="view-field-lbl">Surrender ID</div><div class="view-field-val" style="font-family:var(--mono)">${r.surrenderRefId||"—"}</div></div>
          <div class="view-field"><div class="view-field-lbl">Owner</div><div class="view-field-val">${r.ownerName||"—"}</div></div>
          <div class="view-field"><div class="view-field-lbl">Owner Contact</div><div class="view-field-val">${r.ownerContact||"—"}</div></div>
          <div class="view-field"><div class="view-field-lbl">Surrender Approved</div><div class="view-field-val">${formatDate(r.surrenderApprovedDate)||"—"}</div></div>
        </div>
      </div>`;
  }

  let reviewHtml = "";
  if (r.approvedBy) {
    reviewHtml = `
      <div class="view-section">
        <div class="view-section-title">Review</div>
        <div class="view-grid">
          <div class="view-field"><div class="view-field-lbl">Approved By</div><div class="view-field-val">${r.approvedBy}</div></div>
          <div class="view-field"><div class="view-field-lbl">Approved On</div><div class="view-field-val">${formatDate(r.approvedAt)}</div></div>
        </div>
      </div>`;
  }
  if (r.rejectedReason) {
    reviewHtml = `
      <div class="view-section">
        <div class="view-section-title">Rejection Reason</div>
        <div class="view-field view-full"><div class="view-field-val" style="color:var(--clay)">${r.rejectedReason}</div></div>
      </div>`;
  }

  document.getElementById("viewModalBody").innerHTML = `
    <div class="intake-id-header">
      <span class="intake-id-badge">${r.id}</span>
      <div>
        <div class="intake-animal-name">${r.animalName || "Unknown"} &nbsp; ${speciesEmoji(r.species)}</div>
        <div class="intake-animal-meta">${r.species}${r.breed ? " · " + r.breed : ""} · ${r.sex}</div>
      </div>
      <div class="ms-auto d-flex gap-2 flex-wrap">
        ${sourceBadge(r.source)} ${statusBadge(r.status)}
      </div>
    </div>

    <div class="view-section">
      <div class="view-section-title">Animal Information</div>
      <div class="view-grid">
        <div class="view-field"><div class="view-field-lbl">Age</div><div class="view-field-val">${r.ageEstimate||"Unknown"}</div></div>
        <div class="view-field"><div class="view-field-lbl">Color</div><div class="view-field-val">${r.color||"Unknown"}</div></div>
        <div class="view-field"><div class="view-field-lbl">Condition</div><div class="view-field-val">${condBadge(r.condition)}</div></div>
        <div class="view-field"><div class="view-field-lbl">Weight</div><div class="view-field-val">${r.weight ? r.weight + " kg" : "Not recorded"}</div></div>
        <div class="view-field"><div class="view-field-lbl">Injuries</div><div class="view-field-val">${r.injuries||"Unknown"}</div></div>
        <div class="view-field"><div class="view-field-lbl">Vaccinated</div><div class="view-field-val">${r.vaccinated||"Unknown"}</div></div>
        ${r.conditionNotes ? `<div class="view-field view-full"><div class="view-field-lbl">Condition Notes</div><div class="view-field-val">${r.conditionNotes}</div></div>` : ""}
      </div>
    </div>

    <div class="view-section">
      <div class="view-section-title">Intake Details</div>
      <div class="view-grid">
        <div class="view-field"><div class="view-field-lbl">Intake Date</div><div class="view-field-val">${formatDate(r.intakeDate)}</div></div>
        <div class="view-field"><div class="view-field-lbl">Encoded By</div><div class="view-field-val">${r.encodedBy}</div></div>
        <div class="view-field view-full"><div class="view-field-lbl">Location</div><div class="view-field-val">${r.location||"—"}</div></div>
        ${r.intakeNotes ? `<div class="view-field view-full"><div class="view-field-lbl">Notes</div><div class="view-field-val">${r.intakeNotes}</div></div>` : ""}
      </div>
    </div>

    ${dynamicHtml}
    ${reviewHtml}`;

  // Footer buttons based on status
  const footer = document.getElementById("viewModalFooter");
  let footerBtns = `<button type="button" class="btn-ghost-clay" id="viewClose2">Close</button>`;

  if (r.status === "Pending") {
    footerBtns += `
      <button type="button" class="btn-reject"  id="vBtnReject">
        <i class="bi bi-x-lg"></i> Reject
      </button>
      <button type="button" class="btn-approve" id="vBtnApprove">
        <i class="bi bi-check-lg"></i> Approve
      </button>`;
  }
  if (r.status === "Approved") {
    footerBtns += `
      <button type="button" class="btn-convert" id="vBtnConvert">
        <i class="bi bi-arrow-right-circle"></i> Convert to Animal Profile
      </button>`;
  }

  footer.innerHTML = footerBtns;

  document.getElementById("viewClose2")?.addEventListener("click", () => closeModal("viewModalBackdrop"));
  document.getElementById("vBtnApprove")?.addEventListener("click", () => { closeModal("viewModalBackdrop"); openConfirmModal("approve", id); });
  document.getElementById("vBtnReject")?.addEventListener("click",  () => { closeModal("viewModalBackdrop"); openConfirmModal("reject",  id); });
  document.getElementById("vBtnConvert")?.addEventListener("click", () => { closeModal("viewModalBackdrop"); openConfirmModal("convert", id); });

  openModal("viewModalBackdrop");
}

/* ══════════════════════════════════════════════════════
   CONFIRM MODAL (approve / reject / convert)
══════════════════════════════════════════════════════ */
function openConfirmModal(action, id) {
  const r = intakeRecords.find(x => x.id === id);
  if (!r) return;

  confirmAction   = action;
  confirmTargetId = id;

  const cfg = {
    approve: {
      title:    "Approve Intake",
      msg:      `Approve intake record ${id} for ${r.animalName}? This will allow the record to be converted to an Animal Profile.`,
      iconCls:  "approve",
      iconIcon: "bi-check-circle-fill",
      btnCls:   "btn-approve",
      btnLabel: "Approve",
    },
    reject: {
      title:    "Reject Intake",
      msg:      `Reject intake record ${id} for ${r.animalName}? Please provide a reason below.`,
      iconCls:  "reject",
      iconIcon: "bi-x-circle-fill",
      btnCls:   "btn-reject",
      btnLabel: "Reject",
    },
    convert: {
      title:    "Convert to Animal Profile",
      msg:      `Convert ${r.animalName} (${id}) to a full Animal Profile? This will move the animal into the profiling stage.`,
      iconCls:  "convert",
      iconIcon: "bi-arrow-right-circle-fill",
      btnCls:   "btn-convert",
      btnLabel: "Convert",
    },
  };

  const c = cfg[action];
  document.getElementById("confirmTitle").textContent   = c.title;
  document.getElementById("confirmMsg").textContent     = c.msg;

  const iconWrap = document.getElementById("confirmIcon");
  iconWrap.className = `confirm-icon-wrap ${c.iconCls}`;
  iconWrap.querySelector("i").className = `bi ${c.iconIcon}`;

  const btn = document.getElementById("confirmAction");
  btn.className   = c.btnCls;
  btn.innerHTML   = c.btnLabel;

  // Show/hide rejection reason textarea
  const rrWrap = document.getElementById("rejectReasonWrap");
  rrWrap.style.display = action === "reject" ? "" : "none";
  if (document.getElementById("rejectReason")) {
    document.getElementById("rejectReason").value = "";
  }
  document.getElementById("errRejectReason").textContent = "";

  openModal("confirmModalBackdrop");
}

async function executeConfirmAction() {
  try {
    if (confirmAction === "approve") {
      await approveIntake(confirmTargetId);
      showToast("success", "Intake approved.");
    }

    if (confirmAction === "reject") {
      const reason = document.getElementById("rejectReason")?.value.trim();
      if (!reason) {
        document.getElementById("errRejectReason").textContent = "Please provide a rejection reason.";
        return;
      }
      await rejectIntake(confirmTargetId, reason);
      showToast("info", "Intake rejected.");
    }

    if (confirmAction === "convert") {
      await convertToProfile(confirmTargetId);
      showToast("success", "Converted to Animal Profile.");
    }

    closeModal("confirmModalBackdrop");
    await loadIntakeRecords();
  } catch (err) {
    console.error("[executeConfirmAction]", err);
    showToast("error", err.message || "Action failed.");
  }
}

async function loadIntakeRecords() {
  try {
    const data = await getAllIntake();
    intakeRecords = data.records || [];
    applyFilters();
    renderStats();
  } catch (err) {
    console.error("[loadIntakeRecords]", err);
    showToast("error", err.message || "Failed to load intake records.");
    intakeRecords = [];
    applyFilters();
    renderStats();
  }
}

/* ══════════════════════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════════════════════ */
function openModal(id)  { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }
function closeAll()     {
  ["intakeModalBackdrop","viewModalBackdrop","confirmModalBackdrop"].forEach(closeModal);
}

/* ══════════════════════════════════════════════════════
   FORM ERROR HELPERS
══════════════════════════════════════════════════════ */
function setErr(id, msg) { const el = document.getElementById(id); if (el) el.textContent = msg; }
function clearFormErrors() {
  document.querySelectorAll(".form-err").forEach(e => e.textContent = "");
  document.querySelectorAll(".form-inp.invalid").forEach(e => e.classList.remove("invalid"));
}

/* ══════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════ */
let toastT;
function showToast(type, msg) {
  const t = document.getElementById("umToast");
  const i = document.getElementById("toastIcon");
  const m = document.getElementById("toastMsg");
  if (!t) return;
  const icons = { success:"bi-check-circle-fill", error:"bi-x-circle-fill", info:"bi-info-circle-fill", warning:"bi-exclamation-triangle-fill" };
  t.className = `um-toast toast-${type}`;
  i.className = `bi ${icons[type] || "bi-info-circle-fill"}`;
  m.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 3500);
}


/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */
async function init() {
  try {
    await protectManagementPage();
    renderTopbarUser();
    loadSidebar();


    // Initial render
await loadIntakeRecords();

const params = new URLSearchParams(window.location.search);

if (params.get("source") === "surrender") {
  openApprovedSurrenderIntakeModal();
}

    // Tabs
    document.querySelectorAll(".intake-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".intake-tab").forEach(t => t.classList.remove("active"));
        btn.classList.add("active");
        activeTab = btn.dataset.tab;
        applyFilters();
      });
    });

    // Filters
    document.getElementById("searchIntake")?.addEventListener("input",  applyFilters);
    document.getElementById("filterSource")?.addEventListener("change", applyFilters);
    document.getElementById("filterSpecies")?.addEventListener("change",applyFilters);

    // Add new intake
    document.getElementById("btnNewIntake")?.addEventListener("click", openAddModal);

    // Source selector (inside modal — needs to re-bind on each open)
    // Done via event delegation instead
    document.getElementById("sourceSelector")?.addEventListener("click", e => {
      const opt = e.target.closest(".source-opt");
      if (!opt) return;
      document.querySelectorAll(".source-opt").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      document.getElementById("fSource").value = opt.dataset.value;
      document.getElementById("errSource").textContent = "";
      renderDynamicSection(opt.dataset.value);
    });

    // Modal buttons
    document.getElementById("intakeModalClose")?.addEventListener("click",  () => closeModal("intakeModalBackdrop"));
    document.getElementById("intakeModalCancel")?.addEventListener("click", () => closeModal("intakeModalBackdrop"));
    document.getElementById("btnSaveDraft")?.addEventListener("click",      () => saveIntake(true));
    document.getElementById("btnSubmitIntake")?.addEventListener("click",   () => saveIntake(false));

    document.getElementById("viewModalClose")?.addEventListener("click",    () => closeModal("viewModalBackdrop"));

    document.getElementById("confirmModalClose")?.addEventListener("click", () => closeModal("confirmModalBackdrop"));
    document.getElementById("confirmCancel")?.addEventListener("click",     () => closeModal("confirmModalBackdrop"));
    document.getElementById("confirmAction")?.addEventListener("click",     executeConfirmAction);

    // Click backdrop to close
    ["intakeModalBackdrop","viewModalBackdrop","confirmModalBackdrop"].forEach(id => {
      document.getElementById(id)?.addEventListener("click", e => {
        if (e.target.id === id) closeModal(id);
      });
    });

    document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });

    document.body.classList.remove("loading");
  } catch (err) {
    console.error("Intake init failed:", err);
    document.body.classList.remove("loading");
  }
}

window.addEventListener("DOMContentLoaded", init);