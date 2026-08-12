// admin-frontend/src/management/intake.js
import "../css/intake.css";
import "../css/managementTables.css";
import "../css/recordsPanelReference.css";
import { renderPageHeader } from "../components/management/pageHeader.js";
import { PAGE_HEADER_CONFIGS } from "../components/management/pageHeaderConfigs.js";

import { protectPageByModule }         from "../auth/authGuard.js";
import { hasPermission }               from "../auth/permissions.js";
import { renderTopbarUser }            from "../components/management/topbarUser.js";
import { loadSidebar, navigateManagementPage } from "../components/management/sidebarLoader.js";
import { getUserName }                 from "../utils/storage.js";
import { BARANGAYS }                   from "../utils/barangays.js";


import {
  getAllIntake,
  getIntakeById,
  createIntake,
  updateIntake,
  rejectIntake,
  convertToProfile
} from "../services/intake.service.js";

renderPageHeader(PAGE_HEADER_CONFIGS.intake);

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
let currentRole = "";

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
const speciesInitial = s => String(s || "Animal").charAt(0).toUpperCase();
const speciesThumb = s => ({ Dog:"thumb-dog", Cat:"thumb-cat"}[s] || "thumb-other");

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

function setOptionalDetailsVisible(visible) {
  const form = document.getElementById("intakeForm");
  const toggle = document.getElementById("intakeOptionalToggle");
  if (!form || !toggle) return;

  form.classList.toggle("show-optional", visible);
  toggle.setAttribute("aria-expanded", String(visible));
  toggle.querySelector("i")?.classList.toggle("bi-plus-circle", !visible);
  toggle.querySelector("i")?.classList.toggle("bi-dash-circle", visible);
  const label = toggle.querySelector("span");
  if (label) label.textContent = visible ? "Hide optional details" : "Show optional details";
}

function hasOptionalIntakeDetails(record = {}) {
  return Boolean(
    record.previousName ||
    record.breed ||
    record.ageEstimate ||
    record.color ||
    record.weight ||
    record.conditionNotes ||
    record.visibleDefects ||
    record.intakeNotes ||
    (record.injuries && record.injuries !== "Unknown") ||
    (record.vaccinated && record.vaccinated !== "Unknown") ||
    (record.alteredStatus && record.alteredStatus !== "Unknown")
  );
}

function intakeLabel(record = {}) {
  const legacyName = String(record.animalName || "").trim();
  const meaningfulLegacyName =
    legacyName &&
    !["unknown", "unnamed", "unnamed pet"].includes(
      legacyName.toLowerCase()
    );

  return (
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

/* ══════════════════════════════════════════════════════
   STATS
══════════════════════════════════════════════════════ */
function renderStats() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const pendingCount = intakeRecords.filter(r => r.status === "Pending").length;
  set("statAll",       intakeRecords.length);
  set("statPending",   pendingCount);
  set("heroPendingCount", pendingCount);
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
  const dateFrom = document.getElementById("filterDateFrom")?.value || "";
  const dateTo   = document.getElementById("filterDateTo")?.value   || "";

  filtered = intakeRecords.filter(r => {
    if (activeTab !== "all" && r.status !== activeTab) return false;
    if (source && r.source !== source) return false;
    if (species && r.species !== species) return false;
    const intakeDate = String(r.intakeDate || "").slice(0, 10);
    if (dateFrom && (!intakeDate || intakeDate < dateFrom)) return false;
    if (dateTo && (!intakeDate || intakeDate > dateTo)) return false;

    const id = (r.id || "").toLowerCase();
    const description = intakeLabel(r).toLowerCase();
    const speciesName = (r.species || "").toLowerCase();
    const breed = (r.breed || "").toLowerCase();

    if (q && !id.includes(q) && !description.includes(q) && !speciesName.includes(q) && !breed.includes(q)) {
      return false;
    }

    return true;
  });

  currentPage = 1;
  const resultLabel = document.getElementById("intakeResultLabel");
  if (resultLabel) resultLabel.textContent = `${filtered.length} ${filtered.length === 1 ? "record" : "records"}`;
  renderTable();
  renderPagination();
}

function clearFilters() {
  ["searchIntake", "filterSource", "filterSpecies", "filterDateFrom", "filterDateTo"].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.value = "";
  });

  activeTab = "all";
  document.querySelectorAll(".intake-tab").forEach(tab => {
    const isAll = tab.dataset.tab === "all";
    tab.classList.toggle("active", isAll);
    tab.setAttribute("aria-selected", String(isAll));
  });
  applyFilters();
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
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="empty-state-icon"><i class="bi bi-inbox"></i></span><strong>No intake records found</strong><p>Try changing or clearing the active filters.</p><button type="button" id="emptyClearFilters">Clear filters</button></div></td></tr>`;
    document.getElementById("emptyClearFilters")?.addEventListener("click", clearFilters);
    return;
  }

  tbody.innerHTML = page.map(r => {
  const canReject =
    r.status === "Pending" &&
    can("reject");

  const canConvert =
    can("convert") &&
    (
      r.status === "Approved" ||
      (r.status === "Pending" && can("approve"))
    );

  const canEdit =
    (r.status === "Pending" || r.status === "Draft") &&
    can("edit");

    return `
    <tr data-id="${r.id}">
      <td data-label="Intake ID" class="intake-code">${r.id}</td>
      <td data-label="Animal">
        <div class="animal-cell">
          <div class="animal-thumb ${speciesThumb(r.species)}" aria-hidden="true">${speciesInitial(r.species)}</div>
          <div>
            <div class="animal-name">${intakeLabel(r)}</div>
            <div class="animal-sub">${r.species}${r.breed ? " · " + r.breed : ""}</div>
          </div>
        </div>
      </td>
      <td data-label="Source">${sourceBadge(r.source)}</td>
      <td data-label="Condition">${condBadge(r.condition)}</td>
      <td data-label="Encoded by" class="encoded-by">${r.encodedBy}</td>
      <td data-label="Date" class="intake-date">${formatDate(r.intakeDate)}</td>
      <td data-label="Status">${statusBadge(r.status)}</td>
      <td data-label="Actions" class="table-actions">
        <div class="intake-action-group">
          <button class="tbl-action-btn" title="View Details" aria-label="View ${r.id}" data-action="view" data-id="${r.id}">
            <i class="bi bi-eye"></i>
          </button>
          ${canEdit    ? `<button class="tbl-action-btn" title="Edit" aria-label="Edit ${r.id}" data-action="edit" data-id="${r.id}"><i class="bi bi-pencil"></i></button>` : ""}
          ${canReject  ? `<button class="tbl-action-btn reject" title="Reject" aria-label="Reject ${r.id}" data-action="reject" data-id="${r.id}"><i class="bi bi-x-lg"></i></button>` : ""}
          ${canConvert ? `<button class="tbl-action-btn convert" title="${r.status === "Pending" ? "Approve and start profiling" : "Start profiling"}" aria-label="${r.status === "Pending" ? "Approve and start profiling for" : "Start profiling for"} ${r.id}" data-action="convert" data-id="${r.id}"><i class="bi bi-arrow-right-circle"></i></button>` : ""}
        </div>
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
            <details class="source-optional-details form-full">
              <summary><i class="bi bi-plus-circle"></i> Add turnover contact details</summary>
              <div class="form-grid">
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
                <div class="form-group">
                  <label class="form-lbl" for="fImpoundReason">Reason for Impound</label>
                  <input type="text" class="form-inp" id="fImpoundReason" placeholder="e.g. Roaming" />
                </div>
              </div>
            </details>
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
            <details class="source-optional-details form-full">
              <summary><i class="bi bi-plus-circle"></i> Add surrender contact details</summary>
              <div class="form-grid">
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
            </details>
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
  if (!can("create")) {
  showToast(
    "error",
    "You do not have permission to create intake records."
  );
  return;
}

  editingId = null;
  document.getElementById("intakeModalTitle").textContent    = "New Intake Record";
  document.getElementById("intakeModalSubtitle").textContent = "Start with the essentials. Optional details can be added now or during profiling.";
  document.getElementById("intakeForm").reset();
  document.getElementById("fIntakeId").value = "";
  document.getElementById("fIntakeDate").value = today();
  document.getElementById("fSex").value = "Unknown";
  setOptionalDetailsVisible(false);
  document.querySelectorAll(".source-opt").forEach(o => o.classList.remove("selected"));
  document.getElementById("sourceSelector").classList.remove("is-locked");
  document.getElementById("fSource").value = "";
  document.getElementById("dynamicSection").innerHTML = "";
  document.getElementById("btnSaveDraft").hidden = false;
  document.getElementById("btnSubmitIntake").innerHTML =
    '<i class="bi bi-send-fill"></i> Submit for Review';
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
    "Review the arrival details once. Saving will create the profile immediately.";
  document.getElementById("btnSaveDraft").hidden = true;
  document.getElementById("btnSubmitIntake").innerHTML =
    '<i class="bi bi-person-vcard-fill"></i> Complete Intake & Start Profiling';

  document.getElementById("intakeForm").reset();
  document.getElementById("fIntakeId").value = "";
  document.getElementById("fIntakeDate").value = today();
  setOptionalDetailsVisible(true);
  document.getElementById("sourceSelector").classList.add("is-locked");

  document.getElementById("fIdentifyingDescription").value =
    surrender.colorMarkings ||
    [surrender.color, surrender.species].filter(Boolean).join(" ") ||
    "";
  document.getElementById("fPreviousName").value =
    surrender.petName || "";
  document.getElementById("fSpecies").value = surrender.species || "";
  document.getElementById("fBreed").value = surrender.breed || "";
  document.getElementById("fSex").value = surrender.sex || "Unknown";
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
    const sourceOptional = document.querySelector("#dynamicSection .source-optional-details");
    if (sourceOptional) sourceOptional.open = true;

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
  if (!can("edit")) {
  showToast(
    "error",
    "You do not have permission to edit intake records."
  );
  return;
}

  const r = intakeRecords.find(x => x.id === id);
  if (!r) return;
  editingId = id;
  document.getElementById("sourceSelector").classList.remove("is-locked");
  document.getElementById("btnSaveDraft").hidden = !["Pending", "Draft"].includes(r.status);
  document.getElementById("btnSubmitIntake").innerHTML =
    '<i class="bi bi-check-lg"></i> Save Changes';

  document.getElementById("intakeModalTitle").textContent    = `Edit Intake — ${r.id}`;
  document.getElementById("intakeModalSubtitle").textContent = "Update the essentials or open optional details when needed.";
  document.getElementById("fIntakeId").value  = id;
  document.getElementById("fIdentifyingDescription").value =
    r.identifyingDescription || intakeLabel(r);
  document.getElementById("fPreviousName").value =
    r.previousName || "";
  document.getElementById("fSpecies").value    = r.species;
  document.getElementById("fBreed").value      = r.breed     || "";
  document.getElementById("fSex").value        = r.sex || "Unknown";
  document.getElementById("fAgeEstimate").value = r.ageEstimate || "";
  document.getElementById("fColor").value      = r.color     || "";
  document.getElementById("fCondition").value  = r.condition;
  document.getElementById("fWeight").value     = r.weight    || "";
  document.getElementById("fConditionNotes").value = r.conditionNotes || "";
  document.getElementById("fAlteredStatus").value =
    r.alteredStatus || "Unknown";
  document.getElementById("fVisibleDefects").value =
    r.visibleDefects || "";
  document.getElementById("fIntakeDate").value = r.intakeDate || today();
  document.getElementById("fLocation").value   = r.location  || "";
  document.getElementById("fIntakeNotes").value = r.intakeNotes || "";
  setOptionalDetailsVisible(hasOptionalIntakeDetails(r));

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
      const sourceOptional = document.querySelector("#dynamicSection .source-optional-details");
      if (sourceOptional && (b.officerName || b.officerContact || b.turnoverDate || b.impoundReason)) sourceOptional.open = true;
    }
    if (r.source === "Approved Surrender" && r.surrenderRefId) {
      document.getElementById("fSurrenderRef").value            = r.surrenderRefId || "";
      document.getElementById("fOwnerName").value               = r.ownerName      || "";
      document.getElementById("fOwnerContact").value            = r.ownerContact   || "";
      document.getElementById("fSurrenderApprovedDate").value   = r.surrenderApprovedDate || "";
      const sourceOptional = document.querySelector("#dynamicSection .source-optional-details");
      if (sourceOptional && (r.ownerName || r.ownerContact || r.surrenderApprovedDate)) sourceOptional.open = true;
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
  const barangayName = document.getElementById("fBarangayName")?.value.trim() || "";
  const resolvedLocation =
    document.getElementById("fLocation").value.trim() ||
    (source === "Barangay Impound" ? barangayName : "");

  const currentRecord = editingId
    ? intakeRecords.find(record => record.id === editingId)
    : null;

  const record = {
    identifyingDescription:
      document.getElementById("fIdentifyingDescription").value.trim(),
    previousName:
      document.getElementById("fPreviousName").value.trim(),
    species:        document.getElementById("fSpecies").value,
    breed:          document.getElementById("fBreed").value.trim(),
    sex:            document.getElementById("fSex").value,
    ageEstimate:    document.getElementById("fAgeEstimate").value.trim(),
    color:          document.getElementById("fColor").value.trim(),
    source,
    condition:      document.getElementById("fCondition").value,
    weight:         document.getElementById("fWeight").value,
    conditionNotes: document.getElementById("fConditionNotes").value.trim(),
    injuries,
    vaccinated,
    alteredStatus:
      document.getElementById("fAlteredStatus").value || "Unknown",
    visibleDefects:
      document.getElementById("fVisibleDefects").value.trim(),
    intakeDate:     document.getElementById("fIntakeDate").value,
    location:       resolvedLocation,
    intakeNotes:    document.getElementById("fIntakeNotes").value.trim(),
    encodedBy:      getUserName()?.split(" ")[0] || "Staff",
    status:         editingId
      ? (asDraft ? "Draft" : currentRecord?.status || "Pending")
      : (asDraft ? "Draft" : "Pending"),
    barangayDetails: null,
    surrenderRefId:  null,
  };

  if (source === "Barangay Impound") {
    record.barangayDetails = {
      barangayName,
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
    record.advanceToProfiling = !asDraft;
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
  const description =
    document.getElementById("fIdentifyingDescription").value.trim();
  const barangayName =
    document.getElementById("fBarangayName")?.value.trim() || "";
  const location =
    document.getElementById("fLocation").value.trim() ||
    (source === "Barangay Impound" ? barangayName : "");

  if (!source)    { setErr("errSource",    "Please select an intake source."); valid = false; }
  if (!species)   { setErr("errSpecies",   "Species is required.");            valid = false; }
  if (!sex)       { setErr("errSex",       "Sex is required.");                valid = false; }
  if (!condition) { setErr("errCondition", "Condition is required.");          valid = false; }
  if (!date)      { setErr("errIntakeDate","Intake date is required.");        valid = false; }
  if (!description) {
    setErr(
      "errIdentifyingDescription",
      "Describe the animal's color, markings, or other identifying features."
    );
    valid = false;
  }
  if (!location) {
    setErr("errLocation", "Found or pickup location is required.");
    valid = false;
  }

  if (source === "Barangay Impound") {
    if (!barangayName) { setErr("errBarangayName", "Barangay name is required."); valid = false; }
  }

  if (source === "Approved Surrender") {
    const sr = document.getElementById("fSurrenderRef")?.value.trim();
    if (!sr) { setErr("errSurrenderRef", "Surrender reference ID is required."); valid = false; }
  }

  return valid;
}

async function saveIntake(asDraft = false) {
  if (!asDraft && !validateForm()) return;

  if (asDraft && !document.getElementById("fSource").value) {
    setErr("errSource", "Please select a source before saving.");
    return;
  }

  const payload = collectFormData(asDraft);
  const draftButton = document.getElementById("btnSaveDraft");
  const submitButton = document.getElementById("btnSubmitIntake");
  const activeButton = asDraft ? draftButton : submitButton;
  const activeLabel = activeButton?.innerHTML;

  try {
    [draftButton, submitButton].forEach(button => {
      if (button) button.disabled = true;
    });
    if (activeButton) activeButton.innerHTML = `<span class="button-spinner" aria-hidden="true"></span>${asDraft ? "Saving draft…" : "Submitting…"}`;

    let result = null;
    if (editingId) {
      await updateIntake(editingId, payload);
      showToast("success", "Intake record updated.");
    } else {
      result = await createIntake(payload);
      showToast(
        "success",
        result.animalProfileId
          ? "Intake completed. The animal is now in profiling."
          : asDraft
          ? "Draft saved."
          : "Intake submitted for review."
      );
    }

    const isFromApprovedSurrender =
      !editingId &&
      payload.source === "Approved Surrender" &&
      payload.surrenderRefId;

    if (isFromApprovedSurrender) {
      sessionStorage.removeItem("approved_surrender_for_intake");
      approvedSurrenderContext = null;

      if (!result?.animalProfileId) {
        showToast("success", "Intake created and surrender request converted.");
      }
    }

    closeModal("intakeModalBackdrop");
    if (result?.animalProfileId) {
      navigateManagementPage(
        `/pages/animalProfile.html?id=${encodeURIComponent(result.animalProfileId)}`
      );
      return;
    }
    await loadIntakeRecords();
  } catch (err) {
    console.error("[saveIntake]", err);
    showToast("error", err.message || "Failed to save intake record.");
  } finally {
    [draftButton, submitButton].forEach(button => {
      if (button) button.disabled = false;
    });
    if (activeButton && activeLabel) activeButton.innerHTML = activeLabel;
  }
}

/* ══════════════════════════════════════════════════════
   VIEW MODAL
══════════════════════════════════════════════════════ */
function openViewModal(id) {
  const r = intakeRecords.find(x => x.id === id);
  if (!r) return;

  document.getElementById("viewModalTitle").textContent = "Intake Record Details";
  document.getElementById("viewModalSubtitle").textContent =
    `${r.id} · ${r.species} · ${r.source} · ${formatDate(r.intakeDate)}`;

  let dynamicHtml = "";
  if (r.source === "Barangay Impound" && r.barangayDetails) {
    const b = r.barangayDetails;
    dynamicHtml = `
      <div class="view-section">
        <div class="view-section-title"><i class="bi bi-building"></i> Barangay Turnover Details</div>
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
        <div class="view-section-title"><i class="bi bi-file-earmark-check"></i> Surrender Reference</div>
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
        <div class="view-section-title"><i class="bi bi-clipboard2-check"></i> Review</div>
        <div class="view-grid">
          <div class="view-field"><div class="view-field-lbl">Approved By</div><div class="view-field-val">${r.approvedBy}</div></div>
          <div class="view-field"><div class="view-field-lbl">Approved On</div><div class="view-field-val">${formatDate(r.approvedAt)}</div></div>
        </div>
      </div>`;
  }
  if (r.rejectedReason) {
    reviewHtml = `
      <div class="view-section">
        <div class="view-section-title"><i class="bi bi-x-circle"></i> Rejection Reason</div>
        <div class="view-field view-full"><div class="view-field-val" style="color:var(--clay)">${r.rejectedReason}</div></div>
      </div>`;
  }

  document.getElementById("viewModalBody").innerHTML = `
    <div class="intake-record-hero">
      <span class="intake-record-hero-icon" aria-hidden="true">${speciesInitial(r.species)}</span>
      <div class="intake-record-hero-copy">
        <span>Intake record · ${r.id}</span>
        <h3>${intakeLabel(r)}</h3>
        <p>${r.species}${r.breed ? " · " + r.breed : ""} · ${r.sex || "Unknown sex"}</p>
      </div>
      <div class="intake-record-hero-badges">
        ${sourceBadge(r.source)}
        ${statusBadge(r.status)}
      </div>
    </div>

    <div class="view-section">
      <div class="view-section-title"><i class="bi bi-heart-pulse"></i> Animal Information</div>
      <div class="view-grid">
        <div class="view-field"><div class="view-field-lbl">Age</div><div class="view-field-val">${r.ageEstimate||"Unknown"}</div></div>
        <div class="view-field"><div class="view-field-lbl">Color</div><div class="view-field-val">${r.color||"Unknown"}</div></div>
        <div class="view-field"><div class="view-field-lbl">Condition</div><div class="view-field-val">${condBadge(r.condition)}</div></div>
        <div class="view-field"><div class="view-field-lbl">Weight</div><div class="view-field-val">${r.weight ? r.weight + " kg" : "Not recorded"}</div></div>
        <div class="view-field"><div class="view-field-lbl">Injuries</div><div class="view-field-val">${r.injuries||"Unknown"}</div></div>
        <div class="view-field"><div class="view-field-lbl">Vaccinated</div><div class="view-field-val">${r.vaccinated||"Unknown"}</div></div>
        <div class="view-field"><div class="view-field-lbl">Spay / Neuter Status</div><div class="view-field-val">${r.alteredStatus||"Unknown"}</div></div>
        ${r.previousName ? `<div class="view-field"><div class="view-field-lbl">Known Previous Name</div><div class="view-field-val">${r.previousName}</div></div>` : ""}
        ${r.visibleDefects ? `<div class="view-field view-full"><div class="view-field-lbl">Visible Defects / Features</div><div class="view-field-val">${r.visibleDefects}</div></div>` : ""}
        ${r.conditionNotes ? `<div class="view-field view-full"><div class="view-field-lbl">Condition Notes</div><div class="view-field-val">${r.conditionNotes}</div></div>` : ""}
      </div>
    </div>

    <div class="view-section">
      <div class="view-section-title"><i class="bi bi-box-arrow-in-right"></i> Intake Details</div>
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
  let actionBtns = "";
  if (can("edit")) {
    actionBtns += `
      <button type="button" class="btn-outline-save" id="vBtnEdit">
        <i class="bi bi-pencil"></i> Edit Record
      </button>`;
  }
  if (r.status === "Pending" && (can("approve") || can("reject"))) {
  actionBtns += `
    ${
      can("reject")
        ? `<button type="button" class="btn-reject" id="vBtnReject">
            <i class="bi bi-x-lg"></i> Reject
          </button>`
        : ""
    }
    ${
      can("approve") && can("convert")
        ? `<button type="button" class="btn-convert" id="vBtnConvert">
            <i class="bi bi-arrow-right-circle"></i> Approve &amp; Start Profiling
          </button>`
        : ""
    }`;
}
  if (r.status === "Approved" && can("convert")) {
    actionBtns += `
      <button type="button" class="btn-convert" id="vBtnConvert">
        <i class="bi bi-arrow-right-circle"></i> Convert to Animal Profile
      </button>`;
  }

  footer.innerHTML = `
    <div class="intake-view-footer-actions">
      <button type="button" class="btn-ghost-clay" id="viewClose2">Close</button>
      ${actionBtns}
    </div>`;

  document.getElementById("viewClose2")?.addEventListener("click", () => closeModal("viewModalBackdrop"));
  document.getElementById("vBtnEdit")?.addEventListener("click", () => {
    closeModal("viewModalBackdrop");
    openEditModal(id);
  });
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
    reject: {
      title:    "Reject Intake",
      msg:      `Reject intake record ${id} for ${intakeLabel(r)}? Please provide a reason below.`,
      iconCls:  "reject",
      iconIcon: "bi-x-circle-fill",
      btnCls:   "btn-reject",
      btnIcon:  "bi-x-lg",
      btnLabel: "Reject",
    },
    convert: {
      title:    r.status === "Pending" ? "Approve & Start Profiling" : "Start Profiling",
      msg:      r.status === "Pending"
        ? `Approve intake ${id} for ${intakeLabel(r)} and create its Animal Profile now?`
        : `Create the Animal Profile for ${intakeLabel(r)} (${id}) and start profiling now?`,
      iconCls:  "convert",
      iconIcon: "bi-arrow-right-circle-fill",
      btnCls:   "btn-convert",
      btnIcon:  "bi-arrow-right-circle",
      btnLabel: r.status === "Pending" ? "Approve & Start Profiling" : "Start Profiling",
    },
  };

  const c = cfg[action];
  document.getElementById("confirmTitle").textContent   = c.title;
  document.getElementById("confirmMsg").textContent =
    action === "reject"
      ? "Check the selected intake and document why it should not continue."
      : "Check the selected intake before creating its Animal Profile.";

  const panel = document.getElementById("confirmModalPanel");
  panel?.classList.toggle("is-reject", action === "reject");
  panel?.classList.toggle("is-convert", action === "convert");

  document.getElementById("confirmKicker").textContent =
    action === "reject" ? "Intake decision" : "Final intake action";
  document.getElementById("confirmRecordId").textContent = id;
  document.getElementById("confirmRecordName").textContent = intakeLabel(r);
  document.getElementById("confirmRecordMeta").textContent = [
    r.species,
    r.sex,
    r.source,
    r.condition,
  ].filter(Boolean).join(" / ") || "Animal intake record";

  const impact = document.getElementById("confirmImpact");
  impact.className =
    "intake-decision-impact " +
    (action === "reject" ? "is-reject" : "is-convert");
  document.getElementById("confirmImpactIcon").className =
    action === "reject"
      ? "bi bi-info-circle"
      : "bi bi-person-vcard";
  document.getElementById("confirmImpactTitle").textContent =
    action === "reject"
      ? "Closes this intake record"
      : r.status === "Pending"
        ? "Approves and creates the Animal Profile"
        : "Creates the Animal Profile";
  document.getElementById("confirmImpactText").textContent =
    action === "reject"
      ? "No profile is created. The reason remains available for staff review and audit."
      : "The intake moves to Converted and the new profile opens so staff can continue profiling.";

  const iconWrap = document.getElementById("confirmIcon");
  iconWrap.className = `confirm-icon-wrap ${c.iconCls}`;
  iconWrap.querySelector("i").className = `bi ${c.iconIcon}`;

  const btn = document.getElementById("confirmAction");
  btn.className   = c.btnCls;
  btn.innerHTML   = `<i class="bi ${c.btnIcon}"></i> ${c.btnLabel}`;

  // Show/hide rejection reason textarea
  const rrWrap = document.getElementById("rejectReasonWrap");
  rrWrap.style.display = action === "reject" ? "" : "none";
  if (document.getElementById("rejectReason")) {
    document.getElementById("rejectReason").value = "";
  }
  document.getElementById("errRejectReason").textContent = "";

  openModal("confirmModalBackdrop");
  if (action === "reject") {
    requestAnimationFrame(() => document.getElementById("rejectReason")?.focus());
  }
}

async function executeConfirmAction() {
  if (
  confirmAction &&
  !can(confirmAction)
) {
  showToast(
    "error",
    "You do not have permission to perform this action."
  );
  return;
}

  const actionButton = document.getElementById("confirmAction");
  const actionLabel = actionButton?.innerHTML;

  try {
    if (actionButton) {
      actionButton.disabled = true;
      actionButton.innerHTML = `<span class="button-spinner" aria-hidden="true"></span>Working…`;
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
      const result = await convertToProfile(confirmTargetId);
      showToast("success", "Animal Profile created. Profiling has started.");
      closeModal("confirmModalBackdrop");
      if (result?.animalProfileId) {
        navigateManagementPage(
          `/pages/animalProfile.html?id=${encodeURIComponent(result.animalProfileId)}`
        );
        return;
      }
    }

    closeModal("confirmModalBackdrop");
    await loadIntakeRecords();
  } catch (err) {
    console.error("[executeConfirmAction]", err);
    showToast("error", err.message || "Action failed.");
  } finally {
    if (actionButton) {
      actionButton.disabled = false;
      if (actionLabel) actionButton.innerHTML = actionLabel;
    }
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
let modalTrigger = null;
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modalTrigger = document.activeElement;
  modal.classList.add("open");
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => modal.querySelector("button, input, select, textarea")?.focus());
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("open");
  if (!document.querySelector(".um-modal-backdrop.open")) document.body.classList.remove("modal-open");
  if (modalTrigger instanceof HTMLElement) modalTrigger.focus();
}
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


function can(action) {
  return hasPermission(
    currentRole,
    "intake",
    action
  );
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
    const session = await protectPageByModule("intake");
    currentRole = session.role;
    renderTopbarUser();
    loadSidebar();


    // Initial render
await loadIntakeRecords();

const params = new URLSearchParams(window.location.search);

const requestedIntakeId = params.get("id");
if (requestedIntakeId && intakeRecords.some((record) => record.id === requestedIntakeId)) {
  openViewModal(requestedIntakeId);
}

if (params.get("source") === "surrender") {
  openApprovedSurrenderIntakeModal();
}

    // Tabs
    document.querySelectorAll(".intake-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".intake-tab").forEach(t => {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        activeTab = btn.dataset.tab;
        applyFilters();
      });
    });

    // Filters
    document.getElementById("searchIntake")?.addEventListener("input",  applyFilters);
    document.getElementById("filterSource")?.addEventListener("change", applyFilters);
    document.getElementById("filterSpecies")?.addEventListener("change",applyFilters);
    document.getElementById("filterDateFrom")?.addEventListener("change", applyFilters);
    document.getElementById("filterDateTo")?.addEventListener("change", applyFilters);
    document.getElementById("clearIntakeFilters")?.addEventListener("click", clearFilters);

    // Add new intake
    const newIntakeButton =
    document.getElementById("btnNewIntake");

  if (newIntakeButton) {
    newIntakeButton.style.display =
      can("create") ? "" : "none";

    if (can("create")) {
      newIntakeButton.addEventListener(
        "click",
        openAddModal
      );
    }
  }

    // Source selector (inside modal — needs to re-bind on each open)
    // Done via event delegation instead
    document.getElementById("sourceSelector")?.addEventListener("click", e => {
      if (e.currentTarget.classList.contains("is-locked")) return;
      const opt = e.target.closest(".source-opt");
      if (!opt) return;
      document.querySelectorAll(".source-opt").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      document.getElementById("fSource").value = opt.dataset.value;
      document.getElementById("errSource").textContent = "";
      renderDynamicSection(opt.dataset.value);
    });

    document.getElementById("intakeOptionalToggle")?.addEventListener("click", e => {
      setOptionalDetailsVisible(e.currentTarget.getAttribute("aria-expanded") !== "true");
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
