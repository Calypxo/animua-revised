import "../css/archivedRecords.css";
import "../css/recordsWorkspace.css";
import "../css/managementTables.css";
import "../css/recordsPanelReference.css";
import Swal from "sweetalert2";
import { protectPageByModule } from "../auth/authGuard.js";
import { hasPermission } from "../auth/permissions.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { renderPageHeader } from "../components/management/pageHeader.js";
import { PAGE_HEADER_CONFIGS } from "../components/management/pageHeaderConfigs.js";

import {
  getArchivedRecords,
  restoreArchivedAnimal,
} from "../services/archive.service.js";

const state = {
  records: [],
  filteredRecords: [],
  activeTab: "all",
  search: "",
  type: "",
  reason: "",
  currentPage: 1,
  pageSize: 8,
  selectedRecordId: null
};

let currentRole = "";
let restoreInProgress = false;

const managementSwalClasses = {
  popup: "animua-management-swal",
  confirmButton: "animua-management-swal-confirm",
  cancelButton: "animua-management-swal-cancel",
};

function getEl(id) {
  return document.getElementById(id);
}

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, type = "success") {
  const toast = getEl("umToast");
  const toastMsg = getEl("toastMsg");
  const toastIcon = getEl("toastIcon");

  if (!toast || !toastMsg || !toastIcon) return;

  toast.className = `um-toast toast-${type} show`;
  toastMsg.textContent = message;

  const iconMap = {
    success: "bi-check-circle-fill",
    info: "bi-info-circle-fill",
    warning: "bi-exclamation-triangle-fill"
  };

  toastIcon.className = `bi ${iconMap[type] || "bi-info-circle-fill"}`;

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function getModuleClass(module) {
  if (module === "Animal Management") return "module-animal";
  if (module === "Adoption Management") return "module-adoption";
  if (module === "Post Adoption") return "module-post";
  if (module === "Inventory") return "module-inventory";
  if (module === "User Management") return "module-user";
  return "module-animal";
}

function getModuleIcon(module = "") {
  if (module === "Animal Management") return "bi-heart-pulse";
  if (module === "Adoption Management") return "bi-house-heart";
  if (module === "Post Adoption") return "bi-clipboard2-heart";
  if (module === "Inventory") return "bi-box-seam";
  if (module === "User Management") return "bi-people";
  return "bi-archive";
}

function getReasonClass(reason) {
  if (reason === "Duplicate") return "reason-duplicate";
  if (reason === "Completed") return "reason-completed";
  if (reason === "Inactive") return "reason-inactive";
  if (reason === "Transferred") return "reason-transferred";
  if (reason === "Replaced") return "reason-replaced";
  return "reason-other";
}

function can(action) {
  return hasPermission(currentRole, "archive", action);
}

function renderAlertBar() {
  const bar = getEl("archiveAlertBar");
  if (!bar) return;

  const restorable = state.filteredRecords.filter((item) => item.sourceType === "animal").length;
  bar.innerHTML = `
    <div class="archive-signal-card">
      <span class="signal-icon"><i class="bi bi-shield-lock"></i></span>
      <div class="signal-copy">
        <span class="signal-kicker">Protected records vault</span>
        <strong>${state.filteredRecords.length} retained record${state.filteredRecords.length === 1 ? "" : "s"} in this view</strong>
        <small>Archived data remains available for review. ${restorable ? `${restorable} eligible animal profile${restorable === 1 ? " may" : "s may"} be restored.` : "Other retained records remain read-only for governance."}</small>
      </div>
      <span class="vault-count"><strong>${restorable}</strong><small>restorable</small></span>
    </div>
  `;
}

function applyFilters() {
  let records = [...state.records];

  if (state.activeTab !== "all") {
    records = records.filter((item) => item.module === state.activeTab);
  }

  if (state.search) {
    const search = normalize(state.search);
    records = records.filter((item) =>
      normalize(
        `${item.id} ${item.module} ${item.type} ${item.title} ${item.recordId} ${item.archivedBy} ${item.reason} ${item.description}`
      ).includes(search)
    );
  }

  if (state.type) {
    records = records.filter((item) => item.type === state.type);
  }

  if (state.reason) {
    records = records.filter((item) => item.reason === state.reason);
  }

  state.filteredRecords = records;

  const moduleCount = (name) => state.records.filter((item) => item.module === name).length;
  const headerValues = {
    archiveTotal: state.records.length,
    archiveAnimals: moduleCount("Animal Management"),
    archiveAdoptions: moduleCount("Adoption Management"),
    archiveInventory: moduleCount("Inventory"),
    archiveUsers: moduleCount("User Management"),
    heroArchiveCount: state.filteredRecords.length,
  };
  Object.entries(headerValues).forEach(([id, value]) => {
    const element = getEl(id);
    if (element) element.textContent = value;
  });
  const resultLabel = getEl("archiveResultLabel");
  if (resultLabel) resultLabel.textContent = `${state.filteredRecords.length} record${state.filteredRecords.length === 1 ? "" : "s"}`;

  const totalPages = Math.max(1, Math.ceil(state.filteredRecords.length / state.pageSize));
  if (state.currentPage > totalPages) state.currentPage = totalPages;

  renderAlertBar();
  renderTable();
  renderPagination();
}

function getPagedRecords() {
  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + state.pageSize;
  return state.filteredRecords.slice(start, end);
}

function renderTable() {
  const tbody = getEl("archiveTableBody");
  if (!tbody) return;

  const rows = getPagedRecords();

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="records-empty-state">
            <span><i class="bi bi-archive"></i></span>
            <strong>No archived records match</strong>
            <small>Change the module, record type, reason, or search term to broaden this view.</small>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((item) => `
    <tr class="archive-row management-card-row">
      <td class="management-card-primary">
        <span class="management-mobile-label" aria-hidden="true">Archived record</span>
        <div class="archive-record-cell">
          <span class="record-icon ${getModuleClass(item.module)}"><i class="bi ${getModuleIcon(item.module)}"></i></span>
          <span><strong class="record-title">${escapeHtml(item.title)}</strong><small class="record-sub">${escapeHtml(item.recordId)} · ${escapeHtml(item.id)}</small></span>
        </div>
      </td>

      <td class="archive-module-field">
        <span class="management-mobile-label" aria-hidden="true">Module</span>
        <span class="module-badge ${getModuleClass(item.module)}">
          ${escapeHtml(item.module)}
        </span>
      </td>

      <td class="archive-type-field">
        <span class="management-mobile-label" aria-hidden="true">Type</span>
        <span class="type-badge">${escapeHtml(item.type)}</span>
      </td>

      <td class="archive-reason-field">
        <span class="management-mobile-label" aria-hidden="true">Reason</span>
        <span class="reason-badge ${getReasonClass(item.reason)}">
          ${escapeHtml(item.reason)}
        </span>
      </td>

      <td class="archive-date-field">
        <span class="management-mobile-label" aria-hidden="true">Date archived</span>
        <div class="date-cell">
          ${escapeHtml(item.archivedDate)}<br />
          ${escapeHtml(item.archivedTime)}
        </div>
      </td>

      <td class="archive-staff-field"><span class="management-mobile-label" aria-hidden="true">Archived by</span><span class="archiver-cell"><i class="bi bi-person-check"></i>${escapeHtml(item.archivedBy)}</span></td>

      <td class="management-card-actions">
        <span class="management-mobile-label" aria-hidden="true">Actions</span>
        <div class="action-group table-actions">
          <button class="tbl-action-btn management-card-open management-view-action management-view-action--compact" data-view-id="${escapeHtml(item.id)}" title="View details" aria-label="View archived record details"><i class="bi bi-eye" aria-hidden="true"></i><span class="archive-action-text">View details</span></button>
          ${
              can("restore") && item.sourceType === "animal"
          ? `
            <button
              class="tbl-action-btn restore"
              data-restore-id="${escapeHtml(item.id)}"
              title="Restore record"
              aria-label="Restore archived record"
            >
              <i class="bi bi-arrow-clockwise"></i>
              <span class="archive-action-text">Restore</span>
            </button>
          `
          : ""
            }
        </div>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-view-id]").forEach((btn) => {
    btn.addEventListener("click", () => openViewModal(btn.dataset.viewId));
  });

  tbody.querySelectorAll("[data-restore-id]").forEach((btn) => {
    btn.addEventListener("click", () => restoreRecord(btn.dataset.restoreId));
  });
}

function renderPagination() {
  const bar = getEl("paginationBar");
  if (!bar) return;

  const total = state.filteredRecords.length;
  if (!total) {
    bar.innerHTML = "";
    return;
  }
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  const start = (state.currentPage - 1) * state.pageSize + 1;
  const end = Math.min(state.currentPage * state.pageSize, total);

  const pageButtons = [];
  for (let i = 1; i <= totalPages; i += 1) {
    pageButtons.push(`
      <button class="page-btn ${state.currentPage === i ? "active" : ""}" data-page="${i}">
        ${i}
      </button>
    `);
  }

  bar.innerHTML = `
    <span class="page-info">Showing ${start}&ndash;${end} of ${total}</span>
    <button class="page-btn" data-page="prev" ${state.currentPage === 1 ? "disabled" : ""}>
      <i class="bi bi-chevron-left"></i>
    </button>
    ${pageButtons.join("")}
    <button class="page-btn" data-page="next" ${state.currentPage === totalPages ? "disabled" : ""}>
      <i class="bi bi-chevron-right"></i>
    </button>
  `;

  bar.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      if (page === "prev" && state.currentPage > 1) state.currentPage -= 1;
      else if (page === "next" && state.currentPage < totalPages) state.currentPage += 1;
      else if (!Number.isNaN(Number(page))) state.currentPage = Number(page);

      renderTable();
      renderPagination();
    });
  });
}

function openViewModal(id) {
  const item = state.records.find((record) => record.id === id);
  if (!item) return;

  const content = getEl("viewArchiveContent");
const backdrop = getEl(
  "viewArchiveModalBackdrop"
);

if (!content || !backdrop) {
  console.error(
    "Archive modal elements are missing."
  );
  return;
}

state.selectedRecordId = id;

content.innerHTML = `
    <div class="archive-detail-hero">
      <span class="detail-hero-icon ${getModuleClass(item.module)}"><i class="bi ${getModuleIcon(item.module)}"></i></span>
      <div><span>Archived management record</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.recordId)} · archived by ${escapeHtml(item.archivedBy)}</p></div>
      <span class="reason-badge ${getReasonClass(item.reason)}">${escapeHtml(item.reason)}</span>
    </div>
    <div class="archive-detail-grid">
      <div class="archive-detail-item">
        <div class="archive-detail-label">Archive ID</div>
        <div class="archive-detail-value">${escapeHtml(item.id)}</div>
      </div>

      <div class="archive-detail-item">
        <div class="archive-detail-label">Module</div>
        <div class="archive-detail-value">${escapeHtml(item.module)}</div>
      </div>

      <div class="archive-detail-item">
        <div class="archive-detail-label">Type</div>
        <div class="archive-detail-value">${escapeHtml(item.type)}</div>
      </div>

      <div class="archive-detail-item">
        <div class="archive-detail-label">Reason</div>
        <div class="archive-detail-value">${escapeHtml(item.reason)}</div>
      </div>

      <div class="archive-detail-item">
        <div class="archive-detail-label">Title</div>
        <div class="archive-detail-value">${escapeHtml(item.title)}</div>
      </div>

      <div class="archive-detail-item">
        <div class="archive-detail-label">Record ID</div>
        <div class="archive-detail-value">${escapeHtml(item.recordId)}</div>
      </div>

      <div class="archive-detail-item">
        <div class="archive-detail-label">Date Archived</div>
        <div class="archive-detail-value">${escapeHtml(item.archivedDate)} · ${escapeHtml(item.archivedTime)}</div>
      </div>

      <div class="archive-detail-item">
        <div class="archive-detail-label">Archived By</div>
        <div class="archive-detail-value">${escapeHtml(item.archivedBy)}</div>
      </div>

      <div class="archive-detail-item full">
        <div class="archive-detail-label">Description</div>
        <div class="archive-detail-value">${escapeHtml(item.description)}</div>
      </div>

      <div class="archive-detail-item full">
        <div class="archive-detail-label">Related Information</div>
        <div class="archive-detail-value">${escapeHtml(item.relatedInfo)}</div>
      </div>
    </div>
  `;

  const restoreButton = getEl("modalRestoreBtn");

  if (restoreButton) {
  restoreButton.style.display =
    can("restore") &&
    item.sourceType === "animal"
      ? ""
      : "none";
}

  backdrop.classList.add("open");
}

function closeViewModal() {
  const backdrop = getEl(
    "viewArchiveModalBackdrop"
  );

  backdrop?.classList.remove("open");
  state.selectedRecordId = null;
}

async function restoreRecord(id) {
  if (!can("restore")) {
    showToast(
      "You do not have permission to restore archived records.",
      "warning"
    );

    return;
  }

  const item = state.records.find(
    (record) => record.id === id
  );

  if (!item) {
    showToast(
      "Archived record was not found.",
      "warning"
    );

    return;
  }

  if (
    item.sourceType !== "animal"
  ) {
    showToast(
      "This record type cannot be restored yet.",
      "warning"
    );

    return;
  }

  if (restoreInProgress) {
    return;
  }

  const confirmed = await Swal.fire({
    title: "Restore archived record?",
    html: `Bring <strong>${escapeHtml(item.title)}</strong> back to active animal records.<br><small>${escapeHtml(item.recordId)} will leave the archive after confirmation.</small>`,
    icon: "question",
    iconColor: "#0D7377",
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: true,
    confirmButtonText: '<i class="bi bi-arrow-clockwise"></i> Restore Record',
    cancelButtonText: "Cancel",
    customClass: managementSwalClasses,
    buttonsStyling: false,
  });

  if (!confirmed.isConfirmed) {
    return;
  }

  restoreInProgress = true;

  try {
    const result =
      await restoreArchivedAnimal(
        item.sourceId
      );

    closeViewModal();

    await loadArchivedRecords();

    showToast(
      `${item.title} restored to ${
        result?.status ||
        "active records"
      }.`,
      "success"
    );
  } catch (error) {
    console.error(
      "[restoreRecord]",
      error
    );

    showToast(
      error.message ||
        "Failed to restore archived record.",
      "warning"
    );
  } finally {
    restoreInProgress = false;
  }
}

function exportArchive() {
  const headers = [
    "Archive ID",
    "Module",
    "Type",
    "Title",
    "Record ID",
    "Reason",
    "Archived Date",
    "Archived Time",
    "Archived By",
    "Description",
    "Related Information"
  ];

  const rows = state.filteredRecords.map((item) => [
    item.id,
    item.module,
    item.type,
    item.title,
    item.recordId,
    item.reason,
    item.archivedDate,
    item.archivedTime,
    item.archivedBy,
    item.description,
    item.relatedInfo
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "archived-records.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  showToast("Archived records exported.", "info");
}

function resetFilters() {
  state.activeTab = "all";
  state.search = "";
  state.type = "";
  state.reason = "";
  state.currentPage = 1;

const searchInput =
  getEl("searchArchive");

const typeFilter =
  getEl("filterType");

const reasonFilter =
  getEl("filterReason");

if (searchInput) {
  searchInput.value = "";
}

if (typeFilter) {
  typeFilter.value = "";
}

if (reasonFilter) {
  reasonFilter.value = "";
}

  document.querySelectorAll(".archive-tab").forEach((btn) => {
    const isSelected = btn.dataset.tab === "all";
    btn.classList.toggle("active", isSelected);
    btn.setAttribute("aria-selected", String(isSelected));
  });
  document.querySelector('.archive-tab[data-tab="all"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });

  applyFilters();
  showToast("Filters reset.", "info");
}

function bindTabs() {
  document.querySelectorAll(".archive-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeTab = btn.dataset.tab;
      state.currentPage = 1;

      document.querySelectorAll(".archive-tab").forEach((tab) => {
        const isSelected = tab === btn;
        tab.classList.toggle("active", isSelected);
        tab.setAttribute("aria-selected", String(isSelected));
      });
      btn.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" });

      applyFilters();
    });
  });
}

function populateSelect(
  id,
  values,
  defaultLabel
) {
  const select = getEl(id);

  if (!select) {
    return;
  }

  const selectedValue =
    select.value;

  const uniqueValues = [
    ...new Set(
      values
        .filter(Boolean)
        .map((value) =>
          String(value).trim()
        )
    ),
  ].sort((a, b) =>
    a.localeCompare(b)
  );

  select.innerHTML = `
    <option value="">
      ${escapeHtml(defaultLabel)}
    </option>

    ${uniqueValues
      .map(
        (value) => `
          <option value="${escapeHtml(value)}">
            ${escapeHtml(value)}
          </option>
        `
      )
      .join("")}
  `;

  if (
    uniqueValues.includes(
      selectedValue
    )
  ) {
    select.value = selectedValue;
  }
}

function populateArchiveFilters() {
  const types = state.records.map(
    (record) => record.type
  );

  const reasons = state.records.map(
    (record) => record.reason
  );

  if (
    state.type &&
    !types.includes(state.type)
  ) {
    state.type = "";
  }

  if (
    state.reason &&
    !reasons.includes(state.reason)
  ) {
    state.reason = "";
  }

  populateSelect(
    "filterType",
    types,
    "All Record Types"
  );

  populateSelect(
    "filterReason",
    reasons,
    "All Reasons"
  );

  const typeFilter =
    getEl("filterType");

  const reasonFilter =
    getEl("filterReason");

  if (typeFilter) {
    typeFilter.value = state.type;
  }

  if (reasonFilter) {
    reasonFilter.value =
      state.reason;
  }
}

function syncArchiveTabs() {
  const availableModules =
    new Set(
      state.records.map(
        (record) => record.module
      )
    );

  document
    .querySelectorAll(".archive-tab")
    .forEach((button) => {
      const tab =
        button.dataset.tab;

      const isAvailable =
        tab === "all" ||
        availableModules.has(tab);

      button.hidden = !isAvailable;
    });

  if (
    state.activeTab !== "all" &&
    !availableModules.has(
      state.activeTab
    )
  ) {
    state.activeTab = "all";
  }

  document
    .querySelectorAll(".archive-tab")
    .forEach((button) => {
      const isSelected = button.dataset.tab === state.activeTab;
      button.classList.toggle("active", isSelected);
      button.setAttribute("aria-selected", String(isSelected));
    });

  [...document.querySelectorAll(".archive-tab")]
    .find((button) => button.dataset.tab === state.activeTab)
    ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

async function loadArchivedRecords() {
  const records =
    await getArchivedRecords();

  state.records =
    Array.isArray(records)
      ? records
      : [];

  state.filteredRecords = [
    ...state.records,
  ];

  populateArchiveFilters();
  syncArchiveTabs();
  applyFilters();
}

function bindFilters() {
  getEl("searchArchive")?.addEventListener("input", (e) => {
    state.search = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  getEl("filterType")?.addEventListener("change", (e) => {
    state.type = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  getEl("filterReason")?.addEventListener("change", (e) => {
    state.reason = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });
}

function bindButtons() {
  getEl("btnExportArchive")?.addEventListener("click", exportArchive);
  getEl("btnResetFilters")?.addEventListener("click", resetFilters);

  getEl("viewArchiveClose")?.addEventListener("click", closeViewModal);
  getEl("viewArchiveCloseFooter")?.addEventListener("click", closeViewModal);

  getEl("modalRestoreBtn")?.addEventListener("click", () => {
    if (state.selectedRecordId) restoreRecord(state.selectedRecordId);
  });

  getEl("viewArchiveModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "viewArchiveModalBackdrop") closeViewModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeViewModal();
  });
}


async function initArchivedRecordsPage() {
  try {
    const session =
      await protectPageByModule(
        "archive"
      );

    currentRole = session.role;

    renderTopbarUser();
    loadSidebar();
    renderPageHeader(PAGE_HEADER_CONFIGS.archivedRecords);

    bindTabs();
    bindFilters();
    bindButtons();

    await loadArchivedRecords();
  } catch (error) {
    console.error(
      "Archived Records page init failed:",
      error
    );

    state.records = [];
    state.filteredRecords = [];

    applyFilters();

    showToast(
      error.message ||
        "Unable to load archived records.",
      "warning"
    );
  } finally {
    document.body.classList.remove(
      "loading"
    );
  }
}

initArchivedRecordsPage();
