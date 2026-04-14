import "../css/archivedRecords.css";
import "../css/adminDashboard.css";
import "../css/sidebar.css";

import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";

const STORAGE_KEY = "animua_archived_records_mock";

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

function seedRecords() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return;

  const sampleRecords = [
    {
      id: "ARC-001",
      module: "Animal Management",
      type: "Animal Record",
      title: "Loki",
      recordId: "ANIM-2025-091",
      reason: "Duplicate",
      archivedDate: "2026-04-11",
      archivedTime: "03:40 PM",
      archivedBy: "Animua Admin",
      description: "Duplicate animal intake record archived to keep the master record clean.",
      relatedInfo: "Species: Dog · Breed: Mixed Breed · Sex: Male"
    },
    {
      id: "ARC-002",
      module: "Adoption Management",
      type: "Adoption Record",
      title: "Completed Adoption Case",
      recordId: "ADP-2025-101",
      reason: "Completed",
      archivedDate: "2026-04-08",
      archivedTime: "01:15 PM",
      archivedBy: "Staff Andrea Villanueva",
      description: "Old adoption case archived after full completion and documentation.",
      relatedInfo: "Adopter: Ruben Santiago · Pet: Tala"
    },
    {
      id: "ARC-003",
      module: "Post Adoption",
      type: "Post-Adoption Case",
      title: "Finalized Monitoring Case",
      recordId: "PAC-2025-013",
      reason: "Completed",
      archivedDate: "2026-04-09",
      archivedTime: "10:05 AM",
      archivedBy: "Staff Maria Santos",
      description: "Post-adoption monitoring case archived after successful closure.",
      relatedInfo: "Pet: Tala · Final Status: Closed"
    },
    {
      id: "ARC-004",
      module: "Inventory",
      type: "Inventory Item",
      title: "Old Syringe Box Listing",
      recordId: "INV-2025-044",
      reason: "Replaced",
      archivedDate: "2026-04-10",
      archivedTime: "09:55 AM",
      archivedBy: "Staff Kevin Dela Cruz",
      description: "Old inventory listing archived and replaced by a new standardized item entry.",
      relatedInfo: "Category: Consumable · Unit: box"
    },
    {
      id: "ARC-005",
      module: "User Management",
      type: "User Account",
      title: "Former Volunteer Account",
      recordId: "USR-2025-019",
      reason: "Inactive",
      archivedDate: "2026-04-07",
      archivedTime: "04:22 PM",
      archivedBy: "Animua Admin",
      description: "User account archived due to long-term inactivity.",
      relatedInfo: "Role: Volunteer · Access: Removed"
    },
    {
      id: "ARC-006",
      module: "Animal Management",
      type: "Animal Record",
      title: "Transferred Cat Record",
      recordId: "ANIM-2025-133",
      reason: "Transferred",
      archivedDate: "2026-04-05",
      archivedTime: "02:30 PM",
      archivedBy: "Staff Andrea Villanueva",
      description: "Animal record archived after transfer to partner rescue group.",
      relatedInfo: "Species: Cat · Transfer: Partner Shelter"
    },
    {
      id: "ARC-007",
      module: "Inventory",
      type: "Inventory Item",
      title: "Expired Medicine Entry",
      recordId: "INV-2025-052",
      reason: "Inactive",
      archivedDate: "2026-04-06",
      archivedTime: "11:42 AM",
      archivedBy: "Staff Kevin Dela Cruz",
      description: "Inventory item archived after being marked expired and no longer active.",
      relatedInfo: "Category: Antibiotic"
    },
    {
      id: "ARC-008",
      module: "Adoption Management",
      type: "Adoption Record",
      title: "Duplicate Adoption Application",
      recordId: "ADP-2026-004",
      reason: "Duplicate",
      archivedDate: "2026-04-04",
      archivedTime: "08:50 AM",
      archivedBy: "Animua Admin",
      description: "Duplicate application archived to avoid conflicting approval records.",
      relatedInfo: "Applicant matched an existing record"
    },
    {
      id: "ARC-009",
      module: "Post Adoption",
      type: "Post-Adoption Case",
      title: "Replaced Monitoring File",
      recordId: "PAC-2026-002-OLD",
      reason: "Replaced",
      archivedDate: "2026-04-03",
      archivedTime: "05:10 PM",
      archivedBy: "Staff Maria Santos",
      description: "Old case entry archived after record restructuring.",
      relatedInfo: "Replaced by PAC-2026-002"
    },
    {
      id: "ARC-010",
      module: "User Management",
      type: "User Account",
      title: "Old Staff Account",
      recordId: "USR-2024-008",
      reason: "Inactive",
      archivedDate: "2026-04-02",
      archivedTime: "01:08 PM",
      archivedBy: "Animua Admin",
      description: "Former staff account archived after deactivation.",
      relatedInfo: "Role: Shelter Staff"
    }
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleRecords));
}

function getRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    console.error("Failed to parse archived records:", error);
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

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

function getReasonClass(reason) {
  if (reason === "Duplicate") return "reason-duplicate";
  if (reason === "Completed") return "reason-completed";
  if (reason === "Inactive") return "reason-inactive";
  if (reason === "Transferred") return "reason-transferred";
  if (reason === "Replaced") return "reason-replaced";
  return "reason-inactive";
}

function renderAlertBar() {
  const bar = getEl("archiveAlertBar");
  if (!bar) return;

  bar.innerHTML = `
    <div class="alert-row alert-info">
      <i class="bi bi-archive-fill"></i>
      <div>
        <strong>${state.filteredRecords.length} archived record${state.filteredRecords.length !== 1 ? "s" : ""} found</strong><br />
        Review archived items from different modules and restore them when needed.
      </div>
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
        <td colspan="7" class="text-center py-5 text-muted">
          No archived records found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((item) => `
    <tr>
      <td>
        <span class="record-title">${escapeHtml(item.title)}</span>
        <span class="record-sub">${escapeHtml(item.recordId)} · ${escapeHtml(item.id)}</span>
      </td>

      <td>
        <span class="module-badge ${getModuleClass(item.module)}">
          ${escapeHtml(item.module)}
        </span>
      </td>

      <td>
        <span class="type-badge">${escapeHtml(item.type)}</span>
      </td>

      <td>
        <span class="reason-badge ${getReasonClass(item.reason)}">
          ${escapeHtml(item.reason)}
        </span>
      </td>

      <td>
        <div class="date-cell">
          ${escapeHtml(item.archivedDate)}<br />
          ${escapeHtml(item.archivedTime)}
        </div>
      </td>

      <td>${escapeHtml(item.archivedBy)}</td>

      <td>
        <div class="action-group">
          <button class="detail-btn" data-view-id="${escapeHtml(item.id)}">View</button>
          <button class="restore-btn" data-restore-id="${escapeHtml(item.id)}">Restore</button>
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
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));

  const pageButtons = [];
  for (let i = 1; i <= totalPages; i += 1) {
    pageButtons.push(`
      <button class="page-btn ${state.currentPage === i ? "active" : ""}" data-page="${i}">
        ${i}
      </button>
    `);
  }

  bar.innerHTML = `
    <span class="page-info">${total} result${total !== 1 ? "s" : ""}</span>
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

  state.selectedRecordId = id;

  const content = getEl("viewArchiveContent");
  content.innerHTML = `
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

  getEl("viewArchiveModalBackdrop").classList.add("open");
}

function closeViewModal() {
  getEl("viewArchiveModalBackdrop").classList.remove("open");
  state.selectedRecordId = null;
}

function restoreRecord(id) {
  const updated = state.records.filter((item) => item.id !== id);
  state.records = updated;
  saveRecords(updated);
  applyFilters();
  closeViewModal();
  showToast("Archived record restored.", "success");
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

  getEl("searchArchive").value = "";
  getEl("filterType").value = "";
  getEl("filterReason").value = "";

  document.querySelectorAll(".archive-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === "all");
  });

  applyFilters();
  showToast("Filters reset.", "info");
}

function bindTabs() {
  document.querySelectorAll(".archive-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeTab = btn.dataset.tab;
      state.currentPage = 1;

      document.querySelectorAll(".archive-tab").forEach((tab) => {
        tab.classList.remove("active");
      });
      btn.classList.add("active");

      applyFilters();
    });
  });
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

function bindSidebarToggle() {
  const toggleBtn = getEl("sidebarToggle");
  if (!toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    const mobileToggle = document.getElementById("mobile-nav-toggle");
    const sidebar = document.getElementById("sidebar");

    if (sidebar) sidebar.classList.toggle("open");
    if (mobileToggle) mobileToggle.classList.toggle("active");
  });
}

async function initArchivedRecordsPage() {
  try {
    await protectManagementPage();
    loadSidebar();
    renderTopbarUser();
    bindSidebarToggle();

    seedRecords();
    state.records = getRecords();
    state.filteredRecords = [...state.records];

    bindTabs();
    bindFilters();
    bindButtons();
    applyFilters();

    document.body.classList.remove("loading");
  } catch (error) {
    console.error("Archived Records page init failed:", error);
    document.body.classList.remove("loading");
  }
}

initArchivedRecordsPage();