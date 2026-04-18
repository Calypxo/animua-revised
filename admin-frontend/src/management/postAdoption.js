import "../css/postAdoption.css";
import "../css/adminDashboard.css";
import "../css/sidebar.css";

import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";

const STORAGE_KEY = "animua_post_adoption_cases";

const state = {
  cases: [],
  filteredCases: [],
  selectedCaseId: null,
  activeTab: "all",
  search: "",
  species: "",
  condition: "",
  visitState: "",
  currentPage: 1,
  pageSize: 6,
  currentView: "table"
};

function seedCases() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return;

  const sampleCases = [
    {
      id: "PAC-2026-001",
      adoptionId: "ADP-2026-014",
      petId: "ANIM-2026-003",
      petName: "Luna",
      species: "Dog",
      breed: "Aspin",
      sex: "Female",
      age: "2 years old",
      adopterName: "Angela Cruz",
      adopterPhone: "0917-812-4421",
      adopterEmail: "angela.cruz@email.com",
      adopterAddress: "Blk 4 Lot 12, San Vicente, Angeles City, Pampanga",
      adoptionDate: "2026-03-12",
      status: "Upcoming",
      condition: "Good",
      nextVisitDate: "2026-04-18",
      lastVisitDate: "2026-03-28",
      assignedStaff: "Staff Maria Santos",
      purpose: "Routine Welfare Check",
      notes: "Adopter reported that Luna is adjusting well and eating properly.",
      reminders: "Observe weight gain and interaction with children in household.",
      visitHistory: [
        {
          id: "VH-001",
          date: "2026-03-28",
          status: "Visited",
          condition: "Good",
          cleanliness: "Clean and Safe",
          weight: "13.2 kg",
          behavior: "Friendly",
          findings: "Pet was active, hydrated, and responsive. Home environment was safe and clean.",
          recommendation: "Continue current feeding and exercise routine."
        }
      ]
    },
    {
      id: "PAC-2026-002",
      adoptionId: "ADP-2026-010",
      petId: "ANIM-2026-011",
      petName: "Mochi",
      species: "Cat",
      breed: "Puspin",
      sex: "Male",
      age: "1 year old",
      adopterName: "Janine Morales",
      adopterPhone: "0936-114-8080",
      adopterEmail: "janinem@example.com",
      adopterAddress: "Balibago, Angeles City, Pampanga",
      adoptionDate: "2026-02-19",
      status: "Needs Attention",
      condition: "Needs Attention",
      nextVisitDate: "2026-04-10",
      lastVisitDate: "2026-04-01",
      assignedStaff: "Staff Kevin Dela Cruz",
      purpose: "Condition Reassessment",
      notes: "Previous visit noted mild weight loss and insufficient litter hygiene.",
      reminders: "Check food intake, litter cleanliness, and possible vet referral.",
      visitHistory: [
        {
          id: "VH-002",
          date: "2026-03-10",
          status: "Visited",
          condition: "Fair",
          cleanliness: "Acceptable",
          weight: "3.1 kg",
          behavior: "Calm",
          findings: "Pet was shy but alert. Litter area needed more frequent cleaning.",
          recommendation: "Improve litter maintenance and observe food intake."
        },
        {
          id: "VH-003",
          date: "2026-04-01",
          status: "Needs Attention",
          condition: "Needs Attention",
          cleanliness: "Needs Improvement",
          weight: "2.8 kg",
          behavior: "Weak / Lethargic",
          findings: "Cat appeared underweight. Adopter was advised to seek veterinary checkup.",
          recommendation: "Urgent monitoring required and follow-up within 1 week."
        }
      ]
    },
    {
      id: "PAC-2026-003",
      adoptionId: "ADP-2026-006",
      petId: "ANIM-2025-122",
      petName: "Bantay",
      species: "Dog",
      breed: "Mixed Breed",
      sex: "Male",
      age: "4 years old",
      adopterName: "Christian Ramos",
      adopterPhone: "0919-513-2201",
      adopterEmail: "cramos@email.com",
      adopterAddress: "Mabalacat City, Pampanga",
      adoptionDate: "2026-01-27",
      status: "Visited",
      condition: "Excellent",
      nextVisitDate: "2026-04-22",
      lastVisitDate: "2026-04-05",
      assignedStaff: "Staff Andrea Villanueva",
      purpose: "Routine Welfare Check",
      notes: "Very positive adjustment based on previous visits.",
      reminders: "Final verification before possible case closure.",
      visitHistory: [
        {
          id: "VH-004",
          date: "2026-02-10",
          status: "Visited",
          condition: "Good",
          cleanliness: "Clean and Safe",
          weight: "18.1 kg",
          behavior: "Active",
          findings: "Pet adapted well and formed attachment with adopter family.",
          recommendation: "Continue exercise and annual vaccination reminders."
        },
        {
          id: "VH-005",
          date: "2026-04-05",
          status: "Visited",
          condition: "Excellent",
          cleanliness: "Clean and Safe",
          weight: "19.0 kg",
          behavior: "Active",
          findings: "Dog was energetic and in excellent condition. Living area was secure.",
          recommendation: "Eligible for closure after one more satisfactory check."
        }
      ]
    },
    {
      id: "PAC-2026-004",
      adoptionId: "ADP-2026-009",
      petId: "ANIM-2026-020",
      petName: "Coco",
      species: "Cat",
      breed: "Puspin",
      sex: "Female",
      age: "8 months old",
      adopterName: "Marjorie Lim",
      adopterPhone: "0928-992-4117",
      adopterEmail: "mlim@example.com",
      adopterAddress: "Dau, Mabalacat City, Pampanga",
      adoptionDate: "2026-03-01",
      status: "Upcoming",
      condition: "Good",
      nextVisitDate: "2026-04-13",
      lastVisitDate: "",
      assignedStaff: "Staff Maria Santos",
      purpose: "Surprise Home Visit",
      notes: "First monitoring visit is due soon.",
      reminders: "Confirm adjustment with other pets in the household.",
      visitHistory: []
    },
    {
      id: "PAC-2026-005",
      adoptionId: "ADP-2025-101",
      petId: "ANIM-2025-078",
      petName: "Tala",
      species: "Dog",
      breed: "Shih Tzu Mix",
      sex: "Female",
      age: "3 years old",
      adopterName: "Ruben Santiago",
      adopterPhone: "0918-777-4400",
      adopterEmail: "ruben.santiago@email.com",
      adopterAddress: "Sindalan, San Fernando, Pampanga",
      adoptionDate: "2025-12-14",
      status: "Closed",
      condition: "Excellent",
      nextVisitDate: "",
      lastVisitDate: "2026-03-15",
      assignedStaff: "Staff Kevin Dela Cruz",
      purpose: "Final Follow-Up Visit",
      notes: "Case already cleared after multiple successful visits.",
      reminders: "",
      visitHistory: [
        {
          id: "VH-006",
          date: "2026-01-10",
          status: "Visited",
          condition: "Good",
          cleanliness: "Clean and Safe",
          weight: "7.1 kg",
          behavior: "Friendly",
          findings: "Pet was adjusting well in the home.",
          recommendation: "Continue present care."
        },
        {
          id: "VH-007",
          date: "2026-02-12",
          status: "Visited",
          condition: "Excellent",
          cleanliness: "Clean and Safe",
          weight: "7.4 kg",
          behavior: "Friendly",
          findings: "Pet remained healthy and comfortable.",
          recommendation: "Proceed to final monitoring."
        },
        {
          id: "VH-008",
          date: "2026-03-15",
          status: "Closed",
          condition: "Excellent",
          cleanliness: "Clean and Safe",
          weight: "7.5 kg",
          behavior: "Active",
          findings: "Case met closure standards. Pet consistently healthy and well cared for.",
          recommendation: "Case closed."
        }
      ]
    },
    {
      id: "PAC-2026-006",
      adoptionId: "ADP-2026-017",
      petId: "ANIM-2026-041",
      petName: "Panda",
      species: "Dog",
      breed: "Aspin",
      sex: "Male",
      age: "1 year old",
      adopterName: "Liza Vergara",
      adopterPhone: "0915-104-2112",
      adopterEmail: "lizavergara@email.com",
      adopterAddress: "Mexico, Pampanga",
      adoptionDate: "2026-03-20",
      status: "Upcoming",
      condition: "Fair",
      nextVisitDate: "2026-04-08",
      lastVisitDate: "",
      assignedStaff: "Staff Andrea Villanueva",
      purpose: "Routine Welfare Check",
      notes: "Adopter requested help regarding feeding schedule concerns.",
      reminders: "Check appetite and skin condition.",
      visitHistory: []
    }
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleCases));
}

function getCases() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    console.error("Failed to parse post-adoption cases:", error);
    return [];
  }
}

function saveCases(cases) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function diffDaysFromToday(dateStr) {
  if (!dateStr) return null;
  const today = new Date(todayISO());
  const target = new Date(dateStr);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function getVisitState(caseItem) {
  if (!caseItem.nextVisitDate) return "No Visit Scheduled";

  const diff = diffDaysFromToday(caseItem.nextVisitDate);

  if (diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  return "Upcoming";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(str) {
  return String(str || "").toLowerCase().trim();
}

function showToast(message, type = "success") {
  const toast = document.getElementById("umToast");
  const toastMsg = document.getElementById("toastMsg");
  const toastIcon = document.getElementById("toastIcon");

  if (!toast || !toastMsg || !toastIcon) return;

  toast.className = `um-toast toast-${type} show`;
  toastMsg.textContent = message;

  const iconMap = {
    success: "bi-check-circle-fill",
    error: "bi-x-circle-fill",
    info: "bi-info-circle-fill",
    warning: "bi-exclamation-triangle-fill"
  };

  toastIcon.className = `bi ${iconMap[type] || "bi-info-circle-fill"}`;

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function clearErrors(formIds) {
  formIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

function setModalOpen(backdropId, isOpen) {
  const backdrop = document.getElementById(backdropId);
  if (!backdrop) return;

  backdrop.classList.toggle("open", isOpen);
  document.body.classList.toggle("modal-open", isOpen);
}

function getStatusBadgeClass(status) {
  if (status === "Upcoming") return "status-upcoming";
  if (status === "Visited") return "status-visited";
  if (status === "Needs Attention") return "status-attention";
  if (status === "Closed") return "status-closed";
  return "status-closed";
}

function getConditionBadgeClass(condition) {
  if (condition === "Excellent") return "condition-excellent";
  if (condition === "Good") return "condition-good";
  if (condition === "Fair") return "condition-fair";
  if (condition === "Needs Attention") return "condition-needs-attention";
  return "condition-fair";
}

function getVisitBadgeClass(visitState) {
  if (visitState === "Overdue") return "visit-overdue";
  if (visitState === "Today") return "visit-today";
  if (visitState === "Upcoming") return "visit-upcoming";
  return "visit-none";
}

function loadData() {
  state.cases = getCases();
  applyFilters();
}

function applyFilters() {
  const search = normalize(state.search);

  let result = [...state.cases];

  if (state.activeTab !== "all") {
    result = result.filter((item) => item.status === state.activeTab);
  }

  if (search) {
    result = result.filter((item) => {
      const haystack = normalize(
        [
          item.id,
          item.adoptionId,
          item.petId,
          item.petName,
          item.species,
          item.breed,
          item.adopterName,
          item.adopterPhone,
          item.adopterAddress,
          item.assignedStaff
        ].join(" ")
      );
      return haystack.includes(search);
    });
  }

  if (state.species) {
    result = result.filter((item) => item.species === state.species);
  }

  if (state.condition) {
    result = result.filter((item) => item.condition === state.condition);
  }

  if (state.visitState) {
    result = result.filter((item) => getVisitState(item) === state.visitState);
  }

  state.filteredCases = result.sort((a, b) => {
    const aDate = a.nextVisitDate || "9999-12-31";
    const bDate = b.nextVisitDate || "9999-12-31";
    return aDate.localeCompare(bDate);
  });

  const totalPages = Math.max(1, Math.ceil(state.filteredCases.length / state.pageSize));
  if (state.currentPage > totalPages) state.currentPage = totalPages;

  renderAll();
}

function renderAll() {
  renderStats();
  renderAlerts();
  renderTable();
  renderCards();
  renderPagination();
  renderDrawer();
  updateMiniBanner();
}

function renderStats() {
  const totalCases = state.cases.length;
  const upcomingVisits = state.cases.filter((item) => {
    const visitState = getVisitState(item);
    return visitState === "Upcoming" || visitState === "Today";
  }).length;

  const needsAttention = state.cases.filter(
    (item) => item.status === "Needs Attention" || item.condition === "Needs Attention"
  ).length;

  const healthyCases = state.cases.filter(
    (item) =>
      (item.condition === "Excellent" || item.condition === "Good") &&
      item.status !== "Needs Attention"
  ).length;

  document.getElementById("statTotalCases").textContent = totalCases;
  document.getElementById("statUpcomingVisits").textContent = upcomingVisits;
  document.getElementById("statNeedsAttention").textContent = needsAttention;
  document.getElementById("statHealthyCases").textContent = healthyCases;
}

function updateMiniBanner() {
  const overdue = state.cases.filter((item) => getVisitState(item) === "Overdue").length;
  const upcoming = state.cases.filter((item) => {
    const s = getVisitState(item);
    return s === "Upcoming" || s === "Today";
  }).length;
  const attention = state.cases.filter(
    (item) => item.status === "Needs Attention" || item.condition === "Needs Attention"
  ).length;

  document.getElementById("miniOverdue").textContent = overdue;
  document.getElementById("miniUpcoming").textContent = upcoming;
  document.getElementById("miniAttention").textContent = attention;
}

function renderAlerts() {
  const alertsBar = document.getElementById("alertsBar");
  if (!alertsBar) return;

  const overdueCases = state.cases.filter((item) => getVisitState(item) === "Overdue");
  const attentionCases = state.cases.filter(
    (item) => item.status === "Needs Attention" || item.condition === "Needs Attention"
  );
  const todayVisits = state.cases.filter((item) => getVisitState(item) === "Today");

  let html = "";

  if (overdueCases.length) {
    html += `
      <div class="alert-row alert-critical">
        <i class="bi bi-exclamation-octagon-fill"></i>
        <div>
          <strong>${overdueCases.length} overdue visit ${overdueCases.length > 1 ? "cases" : "case"}</strong><br />
          Immediate monitoring follow-up is recommended for overdue post-adoption checks.
        </div>
        <span class="alert-action" data-alert-action="overdue">View all →</span>
      </div>
    `;
  }

  if (attentionCases.length) {
    html += `
      <div class="alert-row alert-low">
        <i class="bi bi-heart-pulse-fill"></i>
        <div>
          <strong>${attentionCases.length} ${attentionCases.length > 1 ? "cases need" : "case needs"} attention</strong><br />
          Welfare reassessment is needed for pets with concerning visit findings or weak condition.
        </div>
        <span class="alert-action" data-alert-action="attention">Review →</span>
      </div>
    `;
  }

  if (todayVisits.length) {
    html += `
      <div class="alert-row alert-info">
        <i class="bi bi-calendar2-check-fill"></i>
        <div>
          <strong>${todayVisits.length} visit ${todayVisits.length > 1 ? "cases" : "case"} scheduled for today</strong><br />
          Assigned staff should complete visit logging before the end of the day.
        </div>
        <span class="alert-action" data-alert-action="today">Open →</span>
      </div>
    `;
  }

  if (!html) {
    html = `
      <div class="alert-row alert-info">
        <i class="bi bi-check2-circle"></i>
        <div>
          <strong>All post-adoption cases are currently manageable</strong><br />
          No overdue visits or urgent attention flags detected right now.
        </div>
      </div>
    `;
  }

  alertsBar.innerHTML = html;

  alertsBar.querySelectorAll("[data-alert-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.alertAction;

      if (type === "overdue") {
        document.getElementById("filterVisitState").value = "Overdue";
        state.visitState = "Overdue";
      } else if (type === "attention") {
        state.activeTab = "Needs Attention";
        activateTabButton("Needs Attention");
      } else if (type === "today") {
        document.getElementById("filterVisitState").value = "Today";
        state.visitState = "Today";
      }

      state.currentPage = 1;
      applyFilters();
    });
  });
}

function getPagedCases() {
  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + state.pageSize;
  return state.filteredCases.slice(start, end);
}

function renderTable() {
  const tbody = document.getElementById("casesTableBody");
  if (!tbody) return;

  const rows = getPagedCases();

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5 text-muted">
          No post-adoption cases found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map((item) => {
      const visitState = getVisitState(item);
      const rowClass =
        item.status === "Needs Attention" || item.condition === "Needs Attention"
          ? "row-attention"
          : visitState === "Overdue"
          ? "row-overdue"
          : "";

      const isActive = state.selectedCaseId === item.id ? "row-active" : "";

      return `
        <tr class="${rowClass} ${isActive}" data-row-id="${escapeHtml(item.id)}">
          <td>
            <div class="pet-name-cell">
              <div class="pet-name">${escapeHtml(item.petName)}</div>
              <div class="pet-meta">
                ${escapeHtml(item.petId)} · ${escapeHtml(item.species)} · ${escapeHtml(item.breed)}<br />
                ${escapeHtml(item.adoptionId)}
              </div>
            </div>
          </td>

          <td>
            <div class="adopter-cell">
              <div class="adopter-name">${escapeHtml(item.adopterName)}</div>
              <div class="adopter-meta">
                ${escapeHtml(item.adopterPhone)}<br />
                ${escapeHtml(item.adopterAddress)}
              </div>
            </div>
          </td>

          <td>
            <span class="status-badge ${getStatusBadgeClass(item.status)}">
              <i class="bi bi-circle-fill"></i>
              ${escapeHtml(item.status)}
            </span>
          </td>

          <td>
            <span class="condition-badge ${getConditionBadgeClass(item.condition)}">
              <i class="bi bi-heart-fill"></i>
              ${escapeHtml(item.condition)}
            </span>
          </td>

          <td>
            <span class="visit-date">${formatDate(item.nextVisitDate)}</span>
            <span class="visit-helper">
              <span class="visit-badge ${getVisitBadgeClass(visitState)}">${escapeHtml(visitState)}</span>
            </span>
          </td>

          <td>${escapeHtml(item.assignedStaff || "—")}</td>

          <td>
            <button class="tbl-action-btn" title="View" data-action="view" data-id="${escapeHtml(item.id)}">
              <i class="bi bi-eye-fill"></i>
            </button>
            <button class="tbl-action-btn" title="Schedule Visit" data-action="schedule" data-id="${escapeHtml(item.id)}">
              <i class="bi bi-calendar-plus"></i>
            </button>
            <button class="tbl-action-btn" title="Log Visit" data-action="log" data-id="${escapeHtml(item.id)}">
              <i class="bi bi-clipboard2-check-fill"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("tr[data-row-id]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      const id = row.dataset.rowId;
      state.selectedCaseId = id;
      renderDrawer();
      renderTable();
      renderCards();
    });
  });

  tbody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      state.selectedCaseId = id;
      renderDrawer();
      renderTable();
      renderCards();

      if (action === "view") openViewCaseModal(id);
      if (action === "schedule") openScheduleVisitModal(id);
      if (action === "log") openLogVisitModal(id);
    });
  });
}

function renderCards() {
  const grid = document.getElementById("casesCardGrid");
  if (!grid) return;

  const items = getPagedCases();

  if (!items.length) {
    grid.innerHTML = `
      <div class="text-center py-5 text-muted w-100">
        No post-adoption cases found.
      </div>
    `;
    return;
  }

  grid.innerHTML = items
    .map((item) => {
      const visitState = getVisitState(item);
      const isActive = state.selectedCaseId === item.id ? "card-active" : "";
      const extraClass =
        item.status === "Needs Attention" || item.condition === "Needs Attention"
          ? "card-attention"
          : visitState === "Overdue"
          ? "card-overdue"
          : "";

      return `
        <div class="pa-card ${isActive} ${extraClass}" data-card-id="${escapeHtml(item.id)}">
          <div class="pa-card-top">
            <div>
              <div class="pa-card-name">${escapeHtml(item.petName)}</div>
              <div class="pa-card-meta">
                ${escapeHtml(item.petId)} · ${escapeHtml(item.species)} · ${escapeHtml(item.breed)}<br />
                ${escapeHtml(item.adoptionId)}
              </div>
            </div>
            <span class="status-badge ${getStatusBadgeClass(item.status)}">${escapeHtml(item.status)}</span>
          </div>

          <div class="pa-card-adopter">
            <strong>${escapeHtml(item.adopterName)}</strong>
            <span>${escapeHtml(item.adopterPhone)}<br />${escapeHtml(item.adopterAddress)}</span>
          </div>

          <div class="pa-card-row">
            <span class="label">Condition</span>
            <span class="condition-badge ${getConditionBadgeClass(item.condition)}">${escapeHtml(item.condition)}</span>
          </div>

          <div class="pa-card-row">
            <span class="label">Next Visit</span>
            <span class="value">${formatDate(item.nextVisitDate)}</span>
          </div>

          <div class="pa-card-row">
            <span class="label">Visit State</span>
            <span class="visit-badge ${getVisitBadgeClass(visitState)}">${escapeHtml(visitState)}</span>
          </div>

          <div class="pa-card-row">
            <span class="label">Assigned Staff</span>
            <span class="value">${escapeHtml(item.assignedStaff || "—")}</span>
          </div>

          <div class="pa-card-footer">
            <button class="pa-card-btn" data-action="view" data-id="${escapeHtml(item.id)}">
              <i class="bi bi-eye-fill"></i> View
            </button>
            <button class="pa-card-btn schedule" data-action="schedule" data-id="${escapeHtml(item.id)}">
              <i class="bi bi-calendar-plus"></i> Schedule
            </button>
            <button class="pa-card-btn log" data-action="log" data-id="${escapeHtml(item.id)}">
              <i class="bi bi-clipboard2-check-fill"></i> Log
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  grid.querySelectorAll("[data-card-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      state.selectedCaseId = card.dataset.cardId;
      renderDrawer();
      renderTable();
      renderCards();
    });
  });

  grid.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      state.selectedCaseId = id;
      renderDrawer();
      renderTable();
      renderCards();

      if (action === "view") openViewCaseModal(id);
      if (action === "schedule") openScheduleVisitModal(id);
      if (action === "log") openLogVisitModal(id);
    });
  });
}

function renderPagination() {
  const bar = document.getElementById("paginationBar");
  if (!bar) return;

  const total = state.filteredCases.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));

  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) {
    pages.push(`
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
    ${pages.join("")}
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
      renderCards();
      renderPagination();
    });
  });
}

function getSelectedCase() {
  if (!state.selectedCaseId) return null;
  return state.cases.find((item) => item.id === state.selectedCaseId) || null;
}

function renderDrawer() {
  const drawer = document.getElementById("paDrawer");
  const drawerInner = document.getElementById("paDrawerInner");
  const layout = document.getElementById("paLayout");
  const selected = getSelectedCase();

  if (!drawer || !drawerInner || !layout) return;

  if (!selected) {
    layout.classList.remove("drawer-open");
    drawerInner.innerHTML = "";
    return;
  }

  layout.classList.add("drawer-open");

  const visitState = getVisitState(selected);
  const historyHtml = selected.visitHistory.length
    ? selected.visitHistory
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(
          (entry) => `
            <div class="history-item">
              <div class="history-icon"><i class="bi bi-clipboard2-heart"></i></div>
              <div class="history-body">
                <div class="history-title">${escapeHtml(entry.status)} · ${escapeHtml(entry.condition)}</div>
                <div class="history-meta">${formatDate(entry.date)} · ${escapeHtml(entry.behavior || "—")} · ${escapeHtml(entry.weight || "—")}</div>
                <div class="history-note">${escapeHtml(entry.findings || "No findings recorded.")}</div>
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="text-muted small">No visit logs yet for this case.</div>`;

  drawerInner.innerHTML = `
    <div class="drawer-header">
      <div>
        <h3>${escapeHtml(selected.petName)} — Post Adoption Case</h3>
        <p>${escapeHtml(selected.id)} · ${escapeHtml(selected.adoptionId)}</p>
      </div>
      <button class="drawer-close-btn" id="drawerCloseBtn">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>

    <div class="drawer-body">
      <div class="drawer-section">
        <div class="drawer-section-title">
          <i class="bi bi-heart-fill"></i> Current Monitoring Status
        </div>

        <div class="monitoring-card">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <span class="status-badge ${getStatusBadgeClass(selected.status)}">${escapeHtml(selected.status)}</span>
            <span class="condition-badge ${getConditionBadgeClass(selected.condition)}">${escapeHtml(selected.condition)}</span>
          </div>

          <div class="monitoring-grid">
            <div class="monitoring-metric">
              <div class="monitoring-metric-val">${formatDate(selected.nextVisitDate)}</div>
              <div class="monitoring-metric-lbl">Next Visit</div>
            </div>

            <div class="monitoring-metric">
              <div class="monitoring-metric-val">${escapeHtml(visitState)}</div>
              <div class="monitoring-metric-lbl">Visit State</div>
            </div>

            <div class="monitoring-metric">
              <div class="monitoring-metric-val">${formatDate(selected.lastVisitDate)}</div>
              <div class="monitoring-metric-lbl">Last Visit</div>
            </div>

            <div class="monitoring-metric">
              <div class="monitoring-metric-val">${escapeHtml(selected.assignedStaff || "—")}</div>
              <div class="monitoring-metric-lbl">Assigned Staff</div>
            </div>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">
          <i class="bi bi-paw-fill"></i> Pet and Adopter Details
        </div>

        <div class="drawer-info-grid">
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Pet</div>
            <div class="drawer-info-val">${escapeHtml(selected.petName)} (${escapeHtml(selected.petId)})</div>
          </div>
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Species / Breed</div>
            <div class="drawer-info-val">${escapeHtml(selected.species)} · ${escapeHtml(selected.breed)}</div>
          </div>
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Sex / Age</div>
            <div class="drawer-info-val">${escapeHtml(selected.sex)} · ${escapeHtml(selected.age)}</div>
          </div>
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Adoption Date</div>
            <div class="drawer-info-val">${formatDate(selected.adoptionDate)}</div>
          </div>
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Adopter</div>
            <div class="drawer-info-val">${escapeHtml(selected.adopterName)}</div>
          </div>
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Contact</div>
            <div class="drawer-info-val">${escapeHtml(selected.adopterPhone)}<br />${escapeHtml(selected.adopterEmail || "—")}</div>
          </div>
          <div class="drawer-info-item drawer-info-full">
            <div class="drawer-info-lbl">Address</div>
            <div class="drawer-info-val">${escapeHtml(selected.adopterAddress)}</div>
          </div>
          <div class="drawer-info-item drawer-info-full">
            <div class="drawer-info-lbl">Monitoring Notes</div>
            <div class="drawer-info-val">${escapeHtml(selected.notes || "No notes recorded.")}</div>
          </div>
          <div class="drawer-info-item drawer-info-full">
            <div class="drawer-info-lbl">Reminders</div>
            <div class="drawer-info-val">${escapeHtml(selected.reminders || "No reminders set.")}</div>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">
          <i class="bi bi-clock-history"></i> Visit History
        </div>

        <div class="history-list">${historyHtml}</div>
      </div>
    </div>

    <div class="drawer-footer">
      <button class="btn-outline-add" id="drawerScheduleBtn">
        <i class="bi bi-calendar-plus"></i> Schedule Visit
      </button>
      <button class="btn-primary-clay" id="drawerLogBtn">
        <i class="bi bi-clipboard2-check-fill"></i> Log Visit
      </button>
    </div>
  `;

  document.getElementById("drawerCloseBtn")?.addEventListener("click", () => {
    state.selectedCaseId = null;
    renderDrawer();
    renderTable();
    renderCards();
  });

  document.getElementById("drawerScheduleBtn")?.addEventListener("click", () => {
    openScheduleVisitModal(selected.id);
  });

  document.getElementById("drawerLogBtn")?.addEventListener("click", () => {
    openLogVisitModal(selected.id);
  });
}

function buildViewCaseMarkup(item) {
  const visitState = getVisitState(item);

  const historyHtml = item.visitHistory.length
    ? item.visitHistory
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(
          (entry) => `
            <div class="history-item">
              <div class="history-icon"><i class="bi bi-journal-medical"></i></div>
              <div class="history-body">
                <div class="history-title">
                  ${escapeHtml(entry.status)} · ${escapeHtml(entry.condition)}
                </div>
                <div class="history-meta">
                  ${formatDate(entry.date)} · ${escapeHtml(entry.cleanliness || "—")} · ${escapeHtml(entry.behavior || "—")}
                </div>
                <div class="history-note">
                  <strong>Findings:</strong> ${escapeHtml(entry.findings || "No findings.")}<br />
                  <strong>Recommendation:</strong> ${escapeHtml(entry.recommendation || "No recommendation.")}
                </div>
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="text-muted small">No visit logs recorded yet.</div>`;

  return `
    <div class="drawer-header">
      <div>
        <h3>${escapeHtml(item.petName)} — Post Adoption Details</h3>
        <p>${escapeHtml(item.id)} · ${escapeHtml(item.adoptionId)} · ${escapeHtml(item.petId)}</p>
      </div>
      <button class="drawer-close-btn" id="viewCaseCloseBtn">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>

    <div class="drawer-body">
      <div class="drawer-section">
        <div class="drawer-section-title">
          <i class="bi bi-heart-pulse-fill"></i> Monitoring Overview
        </div>

        <div class="monitoring-card">
          <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
            <span class="status-badge ${getStatusBadgeClass(item.status)}">${escapeHtml(item.status)}</span>
            <span class="condition-badge ${getConditionBadgeClass(item.condition)}">${escapeHtml(item.condition)}</span>
            <span class="visit-badge ${getVisitBadgeClass(visitState)}">${escapeHtml(visitState)}</span>
          </div>

          <div class="monitoring-grid">
            <div class="monitoring-metric">
              <div class="monitoring-metric-val">${formatDate(item.adoptionDate)}</div>
              <div class="monitoring-metric-lbl">Adoption Date</div>
            </div>
            <div class="monitoring-metric">
              <div class="monitoring-metric-val">${formatDate(item.lastVisitDate)}</div>
              <div class="monitoring-metric-lbl">Last Visit</div>
            </div>
            <div class="monitoring-metric">
              <div class="monitoring-metric-val">${formatDate(item.nextVisitDate)}</div>
              <div class="monitoring-metric-lbl">Next Visit</div>
            </div>
            <div class="monitoring-metric">
              <div class="monitoring-metric-val">${escapeHtml(item.assignedStaff || "—")}</div>
              <div class="monitoring-metric-lbl">Assigned Staff</div>
            </div>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">
          <i class="bi bi-paw-fill"></i> Pet Profile
        </div>

        <div class="drawer-info-grid">
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Pet Name</div>
            <div class="drawer-info-val">${escapeHtml(item.petName)}</div>
          </div>
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Species / Breed</div>
            <div class="drawer-info-val">${escapeHtml(item.species)} · ${escapeHtml(item.breed)}</div>
          </div>
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Sex</div>
            <div class="drawer-info-val">${escapeHtml(item.sex)}</div>
          </div>
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Age</div>
            <div class="drawer-info-val">${escapeHtml(item.age)}</div>
          </div>
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Current Condition</div>
            <div class="drawer-info-val">${escapeHtml(item.condition)}</div>
          </div>
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Case Status</div>
            <div class="drawer-info-val">${escapeHtml(item.status)}</div>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">
          <i class="bi bi-person-heart"></i> Adopter Information
        </div>

        <div class="drawer-info-grid">
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Adopter Name</div>
            <div class="drawer-info-val">${escapeHtml(item.adopterName)}</div>
          </div>
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Phone</div>
            <div class="drawer-info-val">${escapeHtml(item.adopterPhone)}</div>
          </div>
          <div class="drawer-info-item drawer-info-full">
            <div class="drawer-info-lbl">Email</div>
            <div class="drawer-info-val">${escapeHtml(item.adopterEmail || "—")}</div>
          </div>
          <div class="drawer-info-item drawer-info-full">
            <div class="drawer-info-lbl">Address</div>
            <div class="drawer-info-val">${escapeHtml(item.adopterAddress)}</div>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">
          <i class="bi bi-journal-check"></i> Monitoring Notes
        </div>

        <div class="drawer-info-grid">
          <div class="drawer-info-item drawer-info-full">
            <div class="drawer-info-lbl">Case Notes</div>
            <div class="drawer-info-val">${escapeHtml(item.notes || "No notes recorded.")}</div>
          </div>
          <div class="drawer-info-item drawer-info-full">
            <div class="drawer-info-lbl">Reminders / What to Observe</div>
            <div class="drawer-info-val">${escapeHtml(item.reminders || "No reminders set.")}</div>
          </div>
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Visit Purpose</div>
            <div class="drawer-info-val">${escapeHtml(item.purpose || "—")}</div>
          </div>
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Visit Logs</div>
            <div class="drawer-info-val">${item.visitHistory.length}</div>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">
          <i class="bi bi-clock-history"></i> Visit History
        </div>
        <div class="history-list">${historyHtml}</div>
      </div>
    </div>

    <div class="drawer-footer">
      <button class="btn-outline-add" id="viewCaseScheduleBtn">
        <i class="bi bi-calendar-plus"></i> Schedule Visit
      </button>
      <button class="btn-primary-clay" id="viewCaseLogBtn">
        <i class="bi bi-clipboard2-check-fill"></i> Log Visit
      </button>
    </div>
  `;
}

function openViewCaseModal(caseId) {
  const item = state.cases.find((entry) => entry.id === caseId);
  if (!item) return;

  const inner = document.getElementById("viewCaseModalInner");
  inner.innerHTML = buildViewCaseMarkup(item);

  setModalOpen("viewCaseModalBackdrop", true);

  document.getElementById("viewCaseCloseBtn")?.addEventListener("click", closeViewCaseModal);
  document.getElementById("viewCaseScheduleBtn")?.addEventListener("click", () => {
    closeViewCaseModal();
    openScheduleVisitModal(caseId);
  });
  document.getElementById("viewCaseLogBtn")?.addEventListener("click", () => {
    closeViewCaseModal();
    openLogVisitModal(caseId);
  });
}

function closeViewCaseModal() {
  setModalOpen("viewCaseModalBackdrop", false);
}

function openScheduleVisitModal(caseId = "") {
  clearErrors(["errScheduleDate", "errScheduleStaff"]);

  const selected = state.cases.find((item) => item.id === caseId) || getSelectedCase();

  document.getElementById("fScheduleCaseId").value = selected?.id || "";
  document.getElementById("fScheduleCaseLabel").textContent = selected
    ? `${selected.petName} (${selected.petId}) — ${selected.adopterName}`
    : "No case selected";

  document.getElementById("fScheduleDate").value = selected?.nextVisitDate || todayISO();
  document.getElementById("fScheduleStaff").value = selected?.assignedStaff || "";
  document.getElementById("fSchedulePurpose").value = selected?.purpose || "";
  document.getElementById("fScheduleNotes").value = selected?.reminders || "";

  setModalOpen("scheduleVisitModalBackdrop", true);
}

function closeScheduleVisitModal() {
  setModalOpen("scheduleVisitModalBackdrop", false);
}

function validateScheduleForm() {
  let isValid = true;
  clearErrors(["errScheduleDate", "errScheduleStaff"]);

  const date = document.getElementById("fScheduleDate").value.trim();
  const staff = document.getElementById("fScheduleStaff").value.trim();

  if (!date) {
    document.getElementById("errScheduleDate").textContent = "Visit date is required.";
    isValid = false;
  }

  if (!staff) {
    document.getElementById("errScheduleStaff").textContent = "Assigned staff is required.";
    isValid = false;
  }

  return isValid;
}

function saveScheduleVisit() {
  if (!validateScheduleForm()) return;

  const caseId = document.getElementById("fScheduleCaseId").value.trim();
  if (!caseId) {
    showToast("Please select a case first.", "warning");
    return;
  }

  const cases = getCases();
  const index = cases.findIndex((item) => item.id === caseId);
  if (index === -1) {
    showToast("Selected case was not found.", "error");
    return;
  }

  cases[index].nextVisitDate = document.getElementById("fScheduleDate").value.trim();
  cases[index].assignedStaff = document.getElementById("fScheduleStaff").value.trim();
  cases[index].purpose = document.getElementById("fSchedulePurpose").value.trim();
  cases[index].reminders = document.getElementById("fScheduleNotes").value.trim();

  if (cases[index].status !== "Closed") {
    cases[index].status = "Upcoming";
  }

  saveCases(cases);
  state.cases = cases;
  applyFilters();
  closeScheduleVisitModal();
  showToast("Visit schedule saved successfully.", "success");
}

function openLogVisitModal(caseId = "") {
  clearErrors([
    "errVisitDate",
    "errVisitOutcomeStatus",
    "errVisitCondition",
    "errVisitFindings"
  ]);

  const selected = state.cases.find((item) => item.id === caseId) || getSelectedCase();

  document.getElementById("fVisitCaseId").value = selected?.id || "";
  document.getElementById("fVisitCaseLabel").textContent = selected
    ? `${selected.petName} (${selected.petId}) — ${selected.adopterName}`
    : "No case selected";

  document.getElementById("fVisitDate").value = todayISO();
  document.getElementById("fVisitOutcomeStatus").value = selected?.status || "";
  document.getElementById("fVisitCondition").value = selected?.condition || "";
  document.getElementById("fVisitCleanliness").value = "";
  document.getElementById("fVisitWeight").value = "";
  document.getElementById("fVisitBehavior").value = "";
  document.getElementById("fVisitNextDate").value = selected?.nextVisitDate || "";
  document.getElementById("fVisitFindings").value = "";
  document.getElementById("fVisitRecommendation").value = "";

  setModalOpen("logVisitModalBackdrop", true);
}

function closeLogVisitModal() {
  setModalOpen("logVisitModalBackdrop", false);
}

function validateLogVisitForm() {
  let isValid = true;
  clearErrors([
    "errVisitDate",
    "errVisitOutcomeStatus",
    "errVisitCondition",
    "errVisitFindings"
  ]);

  const visitDate = document.getElementById("fVisitDate").value.trim();
  const status = document.getElementById("fVisitOutcomeStatus").value.trim();
  const condition = document.getElementById("fVisitCondition").value.trim();
  const findings = document.getElementById("fVisitFindings").value.trim();

  if (!visitDate) {
    document.getElementById("errVisitDate").textContent = "Visit date is required.";
    isValid = false;
  }

  if (!status) {
    document.getElementById("errVisitOutcomeStatus").textContent = "Case status is required.";
    isValid = false;
  }

  if (!condition) {
    document.getElementById("errVisitCondition").textContent = "Pet condition is required.";
    isValid = false;
  }

  if (!findings) {
    document.getElementById("errVisitFindings").textContent = "Findings are required.";
    isValid = false;
  }

  return isValid;
}

function saveVisitLog() {
  if (!validateLogVisitForm()) return;

  const caseId = document.getElementById("fVisitCaseId").value.trim();
  if (!caseId) {
    showToast("Please select a case first.", "warning");
    return;
  }

  const cases = getCases();
  const index = cases.findIndex((item) => item.id === caseId);
  if (index === -1) {
    showToast("Selected case was not found.", "error");
    return;
  }

  const visitEntry = {
    id: `VH-${Date.now()}`,
    date: document.getElementById("fVisitDate").value.trim(),
    status: document.getElementById("fVisitOutcomeStatus").value.trim(),
    condition: document.getElementById("fVisitCondition").value.trim(),
    cleanliness: document.getElementById("fVisitCleanliness").value.trim(),
    weight: document.getElementById("fVisitWeight").value.trim(),
    behavior: document.getElementById("fVisitBehavior").value.trim(),
    findings: document.getElementById("fVisitFindings").value.trim(),
    recommendation: document.getElementById("fVisitRecommendation").value.trim()
  };

  cases[index].visitHistory = Array.isArray(cases[index].visitHistory)
    ? cases[index].visitHistory
    : [];

  cases[index].visitHistory.unshift(visitEntry);
  cases[index].lastVisitDate = visitEntry.date;
  cases[index].status = visitEntry.status;
  cases[index].condition = visitEntry.condition;
  cases[index].nextVisitDate = document.getElementById("fVisitNextDate").value.trim();
  cases[index].notes = visitEntry.findings;
  cases[index].reminders = visitEntry.recommendation;

  saveCases(cases);
  state.cases = cases;
  applyFilters();
  closeLogVisitModal();
  showToast("Visit log saved successfully.", "success");

  if (state.selectedCaseId === caseId) {
    renderDrawer();
  }
}

function exportSummary() {
  const rows = state.filteredCases.map((item) => {
    const visitState = getVisitState(item);
    return [
      item.id,
      item.adoptionId,
      item.petId,
      item.petName,
      item.species,
      item.breed,
      item.adopterName,
      item.status,
      item.condition,
      item.nextVisitDate || "",
      visitState,
      item.assignedStaff || "",
      item.lastVisitDate || ""
    ];
  });

  const header = [
    "Case ID",
    "Adoption ID",
    "Pet ID",
    "Pet Name",
    "Species",
    "Breed",
    "Adopter Name",
    "Status",
    "Condition",
    "Next Visit Date",
    "Visit State",
    "Assigned Staff",
    "Last Visit Date"
  ];

  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "post-adoption-summary.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);

  showToast("Post-adoption summary exported.", "info");
}

function activateTabButton(label) {
  document.querySelectorAll(".pa-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === label || (label === "all" && btn.dataset.tab === "all"));
  });
}

function bindFilters() {
  document.querySelectorAll(".pa-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeTab = btn.dataset.tab;
      state.currentPage = 1;
      activateTabButton(state.activeTab);
      applyFilters();
    });
  });

  document.getElementById("searchCases")?.addEventListener("input", (e) => {
    state.search = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  document.getElementById("filterSpecies")?.addEventListener("change", (e) => {
    state.species = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  document.getElementById("filterCondition")?.addEventListener("change", (e) => {
    state.condition = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  document.getElementById("filterVisitState")?.addEventListener("change", (e) => {
    state.visitState = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });
}

function bindViewToggle() {
  const btnTableView = document.getElementById("btnTableView");
  const btnCardView = document.getElementById("btnCardView");
  const tableView = document.getElementById("tableView");
  const cardView = document.getElementById("cardView");

  btnTableView?.addEventListener("click", () => {
    state.currentView = "table";
    btnTableView.classList.add("active");
    btnCardView.classList.remove("active");
    tableView.style.display = "";
    cardView.style.display = "none";
  });

  btnCardView?.addEventListener("click", () => {
    state.currentView = "card";
    btnCardView.classList.add("active");
    btnTableView.classList.remove("active");
    cardView.style.display = "";
    tableView.style.display = "none";
  });
}

function bindPageActions() {
  document.getElementById("btnScheduleVisit")?.addEventListener("click", () => {
    openScheduleVisitModal(state.selectedCaseId || "");
  });

  document.getElementById("btnLogVisit")?.addEventListener("click", () => {
    openLogVisitModal(state.selectedCaseId || "");
  });

  document.getElementById("btnExportSummary")?.addEventListener("click", exportSummary);
}

function bindModals() {
  document.getElementById("scheduleVisitClose")?.addEventListener("click", closeScheduleVisitModal);
  document.getElementById("scheduleVisitCancel")?.addEventListener("click", closeScheduleVisitModal);
  document.getElementById("scheduleVisitSave")?.addEventListener("click", saveScheduleVisit);

  document.getElementById("logVisitClose")?.addEventListener("click", closeLogVisitModal);
  document.getElementById("logVisitCancel")?.addEventListener("click", closeLogVisitModal);
  document.getElementById("logVisitSave")?.addEventListener("click", saveVisitLog);

  document.getElementById("viewCaseModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "viewCaseModalBackdrop") closeViewCaseModal();
  });

  document.getElementById("scheduleVisitModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "scheduleVisitModalBackdrop") closeScheduleVisitModal();
  });

  document.getElementById("logVisitModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "logVisitModalBackdrop") closeLogVisitModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeViewCaseModal();
    closeScheduleVisitModal();
    closeLogVisitModal();
  });
}


async function initPage() {
  try {
    await protectManagementPage();
    renderTopbarUser();
    loadSidebar();

    seedCases();
    bindFilters();
    bindViewToggle();
    bindPageActions();
    bindModals();

    loadData();

    document.body.classList.remove("loading");
  } catch (error) {
    console.error("Post Adoption page init failed:", error);
    document.body.classList.remove("loading");
    showToast("Failed to initialize Post Adoption page.", "error");
  }
}

initPage();