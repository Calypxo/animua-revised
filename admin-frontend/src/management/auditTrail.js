import "../css/auditTrail.css";
import "../css/adminDashboard.css";
import "../css/sidebar.css";

import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";

const STORAGE_KEY = "animua_audit_trail_mock";

const state = {
  logs: [],
  filteredLogs: [],
  search: "",
  module: "",
  action: "",
  status: "",
  currentPage: 1,
  pageSize: 8
};

function seedLogs() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return;

  const sampleLogs = [
    {
      id: "AUD-001",
      date: "2026-04-13",
      time: "09:12 AM",
      actor: "Animua Admin",
      role: "Administrator",
      module: "Animal Management",
      action: "Updated",
      record: "ANIM-2026-003",
      status: "Success",
      details: "Updated animal profile details for Luna.",
      ipAddress: "192.168.1.10"
    },
    {
      id: "AUD-002",
      date: "2026-04-13",
      time: "09:45 AM",
      actor: "Staff Maria Santos",
      role: "Shelter Staff",
      module: "Post Adoption",
      action: "Scheduled",
      record: "PAC-2026-001",
      status: "Success",
      details: "Scheduled follow-up visit for Luna on April 18, 2026.",
      ipAddress: "192.168.1.12"
    },
    {
      id: "AUD-003",
      date: "2026-04-13",
      time: "10:03 AM",
      actor: "Staff Kevin Dela Cruz",
      role: "Shelter Staff",
      module: "Inventory",
      action: "Updated",
      record: "INV-2026-011",
      status: "Success",
      details: "Recorded usage for deworming medicine.",
      ipAddress: "192.168.1.14"
    },
    {
      id: "AUD-004",
      date: "2026-04-13",
      time: "10:20 AM",
      actor: "Animua Admin",
      role: "Administrator",
      module: "User Management",
      action: "Created",
      record: "USR-2026-004",
      status: "Success",
      details: "Created a new staff account for inventory monitoring.",
      ipAddress: "192.168.1.10"
    },
    {
      id: "AUD-005",
      date: "2026-04-13",
      time: "11:02 AM",
      actor: "Staff Andrea Villanueva",
      role: "Shelter Staff",
      module: "Adoption Management",
      action: "Approved",
      record: "ADP-2026-017",
      status: "Success",
      details: "Approved an adoption application for Panda.",
      ipAddress: "192.168.1.16"
    },
    {
      id: "AUD-006",
      date: "2026-04-13",
      time: "11:25 AM",
      actor: "Unknown User",
      role: "Unverified",
      module: "Authentication",
      action: "Logged In",
      record: "LOGIN-2026-009",
      status: "Failed",
      details: "Failed login attempt detected due to invalid password.",
      ipAddress: "192.168.1.50"
    },
    {
      id: "AUD-007",
      date: "2026-04-12",
      time: "03:40 PM",
      actor: "Animua Admin",
      role: "Administrator",
      module: "Animal Management",
      action: "Deleted",
      record: "ANIM-2025-091",
      status: "Warning",
      details: "Archived duplicate animal intake record.",
      ipAddress: "192.168.1.10"
    },
    {
      id: "AUD-008",
      date: "2026-04-12",
      time: "04:10 PM",
      actor: "Staff Maria Santos",
      role: "Shelter Staff",
      module: "Post Adoption",
      action: "Updated",
      record: "PAC-2026-002",
      status: "Success",
      details: "Logged visit results for Mochi and marked case for reassessment.",
      ipAddress: "192.168.1.12"
    },
    {
      id: "AUD-009",
      date: "2026-04-12",
      time: "04:30 PM",
      actor: "Animua Admin",
      role: "Administrator",
      module: "Authentication",
      action: "Logged In",
      record: "LOGIN-2026-008",
      status: "Success",
      details: "Administrator successfully logged in.",
      ipAddress: "192.168.1.10"
    },
    {
      id: "AUD-010",
      date: "2026-04-11",
      time: "01:18 PM",
      actor: "Staff Kevin Dela Cruz",
      role: "Shelter Staff",
      module: "Inventory",
      action: "Created",
      record: "INV-2026-021",
      status: "Success",
      details: "Added a new medical supply item to the inventory list.",
      ipAddress: "192.168.1.14"
    }
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleLogs));
}

function getLogs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    console.error("Failed to parse audit logs:", error);
    return [];
  }
}

function getEl(id) {
  return document.getElementById(id);
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
    info: "bi-info-circle-fill"
  };

  toastIcon.className = `bi ${iconMap[type] || "bi-info-circle-fill"}`;

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
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

function getActionClass(action) {
  if (["Created", "Approved", "Scheduled"].includes(action)) return "action-created";
  if (["Updated", "Logged In"].includes(action)) return "action-updated";
  if (action === "Deleted") return "action-deleted";
  return "action-updated";
}

function getStatusClass(status) {
  if (status === "Success") return "status-success";
  if (status === "Warning") return "status-warning";
  if (status === "Failed") return "status-failed";
  return "status-success";
}

function applyFilters() {
  let logs = [...state.logs];

  if (state.search) {
    const search = normalize(state.search);
    logs = logs.filter((log) =>
      normalize(
        `${log.actor} ${log.role} ${log.module} ${log.action} ${log.record} ${log.status} ${log.details}`
      ).includes(search)
    );
  }

  if (state.module) {
    logs = logs.filter((log) => log.module === state.module);
  }

  if (state.action) {
    logs = logs.filter((log) => log.action === state.action);
  }

  if (state.status) {
    logs = logs.filter((log) => log.status === state.status);
  }

  state.filteredLogs = logs;
  const totalPages = Math.max(1, Math.ceil(state.filteredLogs.length / state.pageSize));
  if (state.currentPage > totalPages) state.currentPage = totalPages;

  renderAlert();
  renderTable();
  renderPagination();
}

function renderAlert() {
  const bar = getEl("auditAlertBar");
  if (!bar) return;

  bar.innerHTML = `
    <div class="alert-row alert-info">
      <i class="bi bi-clock-history"></i>
      <div>
        <strong>${state.filteredLogs.length} audit log${state.filteredLogs.length !== 1 ? "s" : ""} found</strong><br />
        Review user activities and system changes from the recent records below.
      </div>
    </div>
  `;
}

function getPagedLogs() {
  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + state.pageSize;
  return state.filteredLogs.slice(start, end);
}

function renderTable() {
  const tbody = getEl("auditTableBody");
  if (!tbody) return;

  const rows = getPagedLogs();

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5 text-muted">
          No audit logs found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((log) => `
    <tr>
      <td>
        <div class="time-cell">
          ${escapeHtml(log.date)}<br />
          ${escapeHtml(log.time)}
        </div>
      </td>
      <td>
        <span class="actor-name">${escapeHtml(log.actor)}</span>
        <span class="sub-text">${escapeHtml(log.role)}</span>
      </td>
      <td>${escapeHtml(log.module)}</td>
      <td>
        <span class="action-badge ${getActionClass(log.action)}">
          ${escapeHtml(log.action)}
        </span>
      </td>
      <td>
        <span class="record-name">${escapeHtml(log.record)}</span>
      </td>
      <td>
        <span class="status-badge ${getStatusClass(log.status)}">
          ${escapeHtml(log.status)}
        </span>
      </td>
      <td>
        <button class="detail-btn" data-view-id="${escapeHtml(log.id)}">View</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-view-id]").forEach((btn) => {
    btn.addEventListener("click", () => openViewModal(btn.dataset.viewId));
  });
}

function renderPagination() {
  const bar = getEl("paginationBar");
  if (!bar) return;

  const total = state.filteredLogs.length;
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
  const log = state.logs.find((item) => item.id === id);
  if (!log) return;

  const content = getEl("viewAuditContent");
  content.innerHTML = `
    <div class="audit-detail-grid">
      <div class="audit-detail-item">
        <div class="audit-detail-label">Audit ID</div>
        <div class="audit-detail-value">${escapeHtml(log.id)}</div>
      </div>

      <div class="audit-detail-item">
        <div class="audit-detail-label">Status</div>
        <div class="audit-detail-value">${escapeHtml(log.status)}</div>
      </div>

      <div class="audit-detail-item">
        <div class="audit-detail-label">Date</div>
        <div class="audit-detail-value">${escapeHtml(log.date)}</div>
      </div>

      <div class="audit-detail-item">
        <div class="audit-detail-label">Time</div>
        <div class="audit-detail-value">${escapeHtml(log.time)}</div>
      </div>

      <div class="audit-detail-item">
        <div class="audit-detail-label">Actor</div>
        <div class="audit-detail-value">${escapeHtml(log.actor)}</div>
      </div>

      <div class="audit-detail-item">
        <div class="audit-detail-label">Role</div>
        <div class="audit-detail-value">${escapeHtml(log.role)}</div>
      </div>

      <div class="audit-detail-item">
        <div class="audit-detail-label">Module</div>
        <div class="audit-detail-value">${escapeHtml(log.module)}</div>
      </div>

      <div class="audit-detail-item">
        <div class="audit-detail-label">Action</div>
        <div class="audit-detail-value">${escapeHtml(log.action)}</div>
      </div>

      <div class="audit-detail-item">
        <div class="audit-detail-label">Record</div>
        <div class="audit-detail-value">${escapeHtml(log.record)}</div>
      </div>

      <div class="audit-detail-item">
        <div class="audit-detail-label">IP Address</div>
        <div class="audit-detail-value">${escapeHtml(log.ipAddress)}</div>
      </div>

      <div class="audit-detail-item full">
        <div class="audit-detail-label">Details</div>
        <div class="audit-detail-value">${escapeHtml(log.details)}</div>
      </div>
    </div>
  `;

  getEl("viewAuditModalBackdrop").classList.add("open");
}

function closeViewModal() {
  getEl("viewAuditModalBackdrop").classList.remove("open");
}

function exportLogs() {
  const headers = ["Audit ID", "Date", "Time", "Actor", "Role", "Module", "Action", "Record", "Status", "Details", "IP Address"];
  const rows = state.filteredLogs.map((log) => [
    log.id,
    log.date,
    log.time,
    log.actor,
    log.role,
    log.module,
    log.action,
    log.record,
    log.status,
    log.details,
    log.ipAddress
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "audit-trail-logs.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  showToast("Audit logs exported.", "success");
}

function resetFilters() {
  state.search = "";
  state.module = "";
  state.action = "";
  state.status = "";
  state.currentPage = 1;

  getEl("searchAudit").value = "";
  getEl("filterModule").value = "";
  getEl("filterAction").value = "";
  getEl("filterStatus").value = "";

  applyFilters();
  showToast("Filters reset.", "info");
}

function bindFilters() {
  getEl("searchAudit")?.addEventListener("input", (e) => {
    state.search = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  getEl("filterModule")?.addEventListener("change", (e) => {
    state.module = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  getEl("filterAction")?.addEventListener("change", (e) => {
    state.action = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  getEl("filterStatus")?.addEventListener("change", (e) => {
    state.status = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });
}

function bindButtons() {
  getEl("btnExportAudit")?.addEventListener("click", exportLogs);
  getEl("btnResetFilters")?.addEventListener("click", resetFilters);

  getEl("viewAuditClose")?.addEventListener("click", closeViewModal);
  getEl("viewAuditCloseFooter")?.addEventListener("click", closeViewModal);

  getEl("viewAuditModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "viewAuditModalBackdrop") closeViewModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeViewModal();
  });
}


async function initAuditTrailPage() {
  try {
    await protectManagementPage();
    renderTopbarUser();
    loadSidebar();

    seedLogs();
    state.logs = getLogs();
    state.filteredLogs = [...state.logs];

    bindFilters();
    bindButtons();
    applyFilters();

    document.body.classList.remove("loading");
  } catch (error) {
    console.error("Audit Trail page init failed:", error);
    document.body.classList.remove("loading");
  }
}

initAuditTrailPage();