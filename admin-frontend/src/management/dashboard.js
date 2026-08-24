import "../components/global/welcome.js";
import "../css/adminDashboard.css";
import "../css/managementTables.css";
import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { renderPageHeader } from "../components/management/pageHeader.js";
import { PAGE_HEADER_CONFIGS } from "../components/management/pageHeaderConfigs.js";
import { apiFetch } from "../utils/api.js";
import { canAccessModule } from "../auth/permissions.js";
import { getUserName, getUserRole } from "../utils/storage.js";

let animals = [];
let activities = [];
let intakeChart;
let speciesChart;
let stayChart;
let dashboardData;

const MANAGEMENT_SEARCH_TARGETS = [
  { module: "animals", label: "Animal Profiles", detail: "Browse and manage animal records", href: "/pages/animalProfiling.html", icon: "bi-heart-pulse", keywords: "animals pets records profiles breed" },
  { module: "intake", label: "Animal Intake", detail: "Review intake records and conversions", href: "/pages/intakeList.html", icon: "bi-box-arrow-in-down", keywords: "intake records new animals" },
  { module: "adoption", label: "Adoption Applications", detail: "Review pending adoption requests", href: "/pages/adoptionApplications.html", icon: "bi-house-heart", keywords: "applications adoption applicants" },
  { module: "surrender", label: "Surrender Requests", detail: "Review owner surrender records", href: "/pages/surrenders.html", icon: "bi-file-earmark-text", keywords: "surrender requests records" },
  { module: "inventory", label: "Inventory", detail: "Check supplies and stock levels", href: "/pages/inventory.html", icon: "bi-box-seam", keywords: "inventory supplies stock" },
  { module: "users", label: "User Management", detail: "Manage staff and user accounts", href: "/pages/userManagement.html", icon: "bi-people", keywords: "staff users accounts team" },
  { module: "archive", label: "Archived Records", detail: "Open inactive and archived records", href: "/pages/archivedRecords.html", icon: "bi-archive", keywords: "archive archived records history" },
  { module: "audit", label: "Audit Trail", detail: "Review management activity history", href: "/pages/auditTrail.html", icon: "bi-journal-check", keywords: "audit activity log history records" },
  { module: "reports", label: "Reports", detail: "Open shelter reports and analytics", href: "/pages/reports.html", icon: "bi-bar-chart", keywords: "reports analytics statistics" },
  { module: "contact", label: "Contact Messages", detail: "Review and reply to public Contact Us inquiries", href: "/pages/contactMessages.html", icon: "bi-envelope-paper", keywords: "contact messages inbox inquiries email replies public" },
];

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
const speciesEmoji = (species) =>
  ({ Dog: "🐶", Cat: "🐱"})[species] || "🐾";
const statusClass = (status) => {
  const value = String(status || "").toLowerCase();
  if (value === "ready") return "ready";
  if (value === "profiling") return "intake";
  if (value === "archived") return "transfer";
  return value;
};
const statusBadge = (status) =>
  '<span class="status-badge badge-' +
  statusClass(status) + '">' + escapeHtml(status || "Unknown") + "</span>";
const dateText = (value) =>
  value
    ? new Date(value).toLocaleString("en-PH", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "Not recorded";

function setCounter(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = Number(value || 0);
}

function populateCounts(data) {
  [
    ["totalPetsCount", data.totalPets],
    ["headerTotalPetsCount", data.totalPets],
    ["intakeCount", data.intake],
    ["headerIntakeCount", data.intake],
    ["heroIntakeCount", data.intake],
    ["profilingCount", data.profiling],
    ["headerProfilingCount", data.profiling],
    ["quarantineCount", data.quarantine],
    ["headerQuarantineCount", data.quarantine],
    ["readyCount", data.readyForAdoption],
    ["headerReadyCount", data.readyForAdoption],
    ["adoptedCount", data.adopted],
    ["headerAdoptedCount", data.adopted],
    ["archivedCount", data.archived],
    ["headerArchivedCount", data.archived],
  ].forEach(([id, value]) => setCounter(id, value));
  const trends = {
    totalTrend: "Live records",
    intakeTrend: data.intake + " awaiting conversion",
    profilingTrend: data.profiling + " being profiled",
    quarantineTrend: data.quarantine + " under veterinary care",
    readyTrend: data.readyForAdoption + " publicly available",
    adoptedTrend: data.adopted + " finalized",
    archivedTrend: data.archived + " retained records",
  };
  Object.entries(trends).forEach(([id, text]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  });
}

function chart(canvasId, previous, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return previous;
  previous?.destroy();
  return new Chart(canvas, config);
}

function renderIntakeChart(data, range = "ytd") {
  const currentMonth = new Date().getMonth();
  const start = range === "6m" ? Math.max(0, currentMonth - 5) : 0;
  const end = range === "full" ? 12 : currentMonth + 1;
  intakeChart = chart("intakeAdoptionChart", intakeChart, {
    type: "bar",
    data: {
      labels: data.monthlyData.labels.slice(start, end),
      datasets: [
        { label: "Intake", data: data.monthlyData.intake.slice(start, end), backgroundColor: "rgba(120, 1, 22,.14)", borderColor: "#780116", borderWidth: 2, borderRadius: 7, borderSkipped: false },
        { label: "Adoptions", data: data.monthlyData.adoptions.slice(start, end), backgroundColor: "rgba(24,101,52,.14)", borderColor: "#186534", borderWidth: 2, borderRadius: 7, borderSkipped: false },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: "#2D2322", padding: 11, usePointStyle: true } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#81746D", font: { family: "Poppins", size: 10 } } },
        y: { beginAtZero: true, ticks: { precision: 0, color: "#81746D", font: { family: "Poppins", size: 10 } }, grid: { color: "rgba(120,1,22,.06)" } },
      },
    },
  });
}

function renderCharts(data) {
  renderIntakeChart(data);
  const species = data.species || [];
  const speciesTotal = species.reduce((sum, item) => sum + item.count, 0);
  const centerLabel = {
    id: "populationCenterLabel",
    afterDraw(instance) {
      const { ctx, chartArea } = instance;
      if (!chartArea) return;
      const x = (chartArea.left + chartArea.right) / 2;
      const y = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "#2D2322";
      ctx.font = "800 22px Poppins";
      ctx.fillText(String(speciesTotal), x, y - 2);
      ctx.fillStyle = "#81746D";
      ctx.font = "600 10px Poppins";
      ctx.fillText("animals", x, y + 15);
      ctx.restore();
    },
  };
  speciesChart = chart("speciesChart", speciesChart, {
    type: "doughnut",
    data: { labels: species.map((item) => item.label), datasets: [{ data: species.map((item) => item.count), backgroundColor: species.map((item) => item.color), borderColor: "#FFFFFF", borderWidth: 3 }] },
    plugins: [centerLabel],
    options: { responsive: true, maintainAspectRatio: false, cutout: "70%", plugins: { legend: { display: false }, tooltip: { backgroundColor: "#2D2322", padding: 11 } } },
  });
  document.getElementById("speciesLegend").innerHTML = species.length
    ? species.map((item) => '<div class="sp-legend-item"><div class="sp-legend-dot" style="background:' + item.color + '"></div><span><span class="sp-legend-name">' + escapeHtml(item.label) + "</span> " + item.count + " (" + Math.round((item.count / speciesTotal) * 100) + "%)</span></div>").join("")
    : '<p class="text-muted">No current animal records.</p>';
  stayChart = chart("stayChart", stayChart, {
    type: "bar",
    data: { labels: data.stayDistribution.labels, datasets: [{ label: "Animals", data: data.stayDistribution.data, backgroundColor: ["#186534","#2558a8","#ffb91e","#780116","#780116"], borderRadius: 8 }] },
    options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#2D2322", padding: 11, displayColors: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0, color: "#81746D", font: { family: "Poppins", size: 10 } }, grid: { color: "rgba(120,1,22,.06)" } }, y: { grid: { display: false }, ticks: { color: "#594D48", font: { family: "Poppins", size: 10, weight: "600" } } } } },
  });
  const analytics = data.analytics || {};
  const flow = Number(analytics.yearlyIntakes || 0) - Number(analytics.yearlyAdoptions || 0);
  setCounter("chartYearIntakes", analytics.yearlyIntakes);
  setCounter("chartYearAdoptions", analytics.yearlyAdoptions);
  document.getElementById("chartNetFlow").textContent = `${flow > 0 ? "+" : ""}${flow}`;
  document.getElementById("chartNetFlow").classList.toggle("is-pressure", flow > 0);
  document.getElementById("chartPlacementRate").textContent = `${Number(analytics.placementRate || 0)}%`;
  document.getElementById("staySummary").innerHTML = analytics.longStayCount
    ? `<i class="bi bi-exclamation-circle-fill"></i><strong>${analytics.longStayCount}</strong> animal${analytics.longStayCount === 1 ? "" : "s"} (${analytics.longStayRate}%) have stayed over 60 days.`
    : '<i class="bi bi-check-circle-fill"></i>No animals are currently beyond the 60-day stay threshold.';
}

function renderActivities(filter = "all") {
  const rows = filter === "all"
    ? activities
    : activities.filter((item) => item.action.toLowerCase().includes(filter));
  document.getElementById("activityTableBody").innerHTML = rows.length
    ? rows.map((item) => "<tr class=\"management-card-row\"><td class=\"management-card-primary\" data-label=\"Animal\"><strong>" + escapeHtml(item.name) + '</strong><div class="animal-id-text">' + escapeHtml(item.id) + "</div></td><td data-label=\"Type\">" + escapeHtml(item.module) + "</td><td data-label=\"Event\">" + escapeHtml(item.action.replaceAll(".", " ")) + "</td><td data-label=\"Staff\">" + escapeHtml(item.staff) + '</td><td data-label="Date" class="table-date-cell">' + dateText(item.date) + "</td><td data-label=\"Status\">" + statusBadge(item.status) + "</td></tr>").join("")
    : '<tr><td colspan="6" class="text-center py-4 text-muted">No recorded activity.</td></tr>';
}

function renderAnimals(query = "") {
  const search = query.toLowerCase().trim();
  const rows = animals.filter((item) =>
    [item.id, item.label, item.species, item.breed, item.status]
      .some((value) => String(value || "").toLowerCase().includes(search))
  );
  document.getElementById("recentAnimalsBody").innerHTML = rows.length
    ? rows.map((item) => `
      <tr class="management-card-row">
        <td class="table-id-cell" data-label="Animal ID">${escapeHtml(item.id)}</td>
        <td class="management-card-primary" data-label="Shelter description">
          <div class="animal-name-cell">
            <div class="animal-thumb">${speciesEmoji(item.species)}</div>
            <div class="animal-name-text">${escapeHtml(item.label)}</div>
          </div>
        </td>
        <td data-label="Species">${escapeHtml(item.species)}</td>
        <td data-label="Breed">${escapeHtml(item.breed)}</td>
        <td data-label="Age">${escapeHtml(item.age)}</td>
        <td data-label="Status">${statusBadge(item.status)}</td>
        <td data-label="Days in shelter"><span class="days-badge">${item.days}d</span></td>
        <td data-label="Behavioral assessment">${item.assessmentComplete ? "✓ Complete" : "Pending"}</td>
        <td class="management-card-actions" data-label="Actions">
          <a class="tbl-action-btn management-card-open" title="View animal" aria-label="View animal profile" href="/pages/animalProfile.html?id=${encodeURIComponent(item.id)}">
            <i class="bi bi-eye" aria-hidden="true"></i><span class="management-action-text">View animal</span>
          </a>
        </td>
      </tr>`).join("")
    : '<tr><td colspan="9" class="text-center py-4 text-muted">No animals found.</td></tr>';
}

function renderGlobalSearch(query = "") {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;
  const search = query.toLowerCase().trim();
  if (!search) {
    dropdown.classList.add("d-none");
    dropdown.replaceChildren();
    return;
  }

  const role = getUserRole();
  const animalResults = animals
    .filter((item) => [item.id, item.label, item.species, item.breed, item.status]
      .some((value) => String(value || "").toLowerCase().includes(search)))
    .slice(0, 4)
    .map((item) => ({
      label: item.label || item.id || "Animal record",
      detail: [item.id, item.species, item.breed].filter(Boolean).join(" · "),
      href: `/pages/animalProfile.html?id=${encodeURIComponent(item.id)}`,
      icon: "bi-heart-pulse",
    }));

  const pageResults = MANAGEMENT_SEARCH_TARGETS
    .filter((item) => canAccessModule(role, item.module))
    .filter((item) => `${item.label} ${item.detail} ${item.keywords}`.toLowerCase().includes(search))
    .slice(0, 5);
  const results = [...animalResults, ...pageResults].slice(0, 8);

  dropdown.innerHTML = results.length
    ? results.map((item) => `
      <a class="search-result-item" href="${escapeHtml(item.href)}">
        <span class="sri-icon"><i class="bi ${escapeHtml(item.icon)}" aria-hidden="true"></i></span>
        <span class="sri-copy"><strong class="sri-name">${escapeHtml(item.label)}</strong><small class="sri-meta">${escapeHtml(item.detail)}</small></span>
        <i class="bi bi-arrow-up-right sri-arrow" aria-hidden="true"></i>
      </a>`).join("")
    : '<div class="search-empty"><i class="bi bi-search" aria-hidden="true"></i><span>No matching animals or pages</span></div>';
  dropdown.classList.remove("d-none");
}

function bindGlobalSearch() {
  const input = document.getElementById("globalSearch");
  const dropdown = document.getElementById("searchDropdown");
  const search = input?.closest(".search-pill");
  if (!input || !dropdown || !search) return;

  input.addEventListener("input", (event) => renderGlobalSearch(event.target.value));
  input.addEventListener("focus", () => renderGlobalSearch(input.value));
  search.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    dropdown.classList.add("d-none");
    input.focus();
  });
  document.addEventListener("click", (event) => {
    if (!search.contains(event.target)) dropdown.classList.add("d-none");
  });
}

function renderAlerts(items) {
  document.getElementById("alertCount").textContent = items.length;
  document.getElementById("alertStack").innerHTML = items.length
    ? items.map((item) => '<div class="alert-row alert-' + item.type + '"><div class="alert-ico"><i class="bi ' + item.icon + '"></i></div><div><strong>' + escapeHtml(item.title) + "</strong><p>" + escapeHtml(item.desc) + "</p></div></div>").join("")
    : '<div class="alert-row alert-green"><div class="alert-ico"><i class="bi bi-check-circle-fill"></i></div><div><strong>No immediate alerts</strong><p>Live records currently show no pending operational alerts.</p></div></div>';
}

function renderQueues(data) {
  document.getElementById("compatList").innerHTML = data.pendingApplications.length
    ? data.pendingApplications.map((item) => '<div class="compat-item"><div class="compat-avatar"><i class="bi bi-heart"></i></div><div class="compat-info"><strong>' + escapeHtml(item.animal) + "</strong><span>" + escapeHtml(item.applicant) + " · " + escapeHtml(item.id) + "</span></div><div class=\"compat-score\">" + (item.matchPercent == null ? "Browse" : item.matchPercent + "%") + "</div></div>").join("")
    : '<p class="text-muted mb-0">No pending adoption applications.</p>';
  document.getElementById("schedStack").innerHTML = data.lowStockItems.length
    ? data.lowStockItems.slice(0, 6).map((item) => '<div class="sched-item"><span class="sched-time">' + escapeHtml(item.currentStock) + "</span><div><strong>" + escapeHtml(item.name) + "</strong><p>" + escapeHtml(item.currentStock + " " + item.unit + " remaining") + '</p></div><span class="sched-tag">' + escapeHtml(item.level) + "</span></div>").join("")
    : '<p class="text-muted mb-0">No low-stock inventory items.</p>';
}

async function init() {
  try {
    await protectManagementPage();
    renderTopbarUser();
    loadSidebar();
    renderPageHeader(PAGE_HEADER_CONFIGS.dashboard);
    const data = await apiFetch("/dashboard/stats");
    dashboardData = data;
    document.getElementById("live-date").textContent = new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const name = getUserName() || "Admin";
    document.getElementById("welcomeName").textContent = name.split(" ")[0];
    populateCounts(data);
    renderCharts(data);
    activities = data.recentActivity || [];
    animals = data.recentAnimals || [];
    renderActivities();
    renderAnimals();
    renderAlerts(data.alerts || []);
    renderQueues(data);
    bindGlobalSearch();
    document.getElementById("chartRange")?.addEventListener("change", (event) => renderIntakeChart(dashboardData, event.target.value));
    document.getElementById("activityFilter")?.addEventListener("change", (event) => renderActivities(event.target.value));
    document.getElementById("animalSearch")?.addEventListener("input", (event) => renderAnimals(event.target.value));
  } catch (error) {
    console.error("Dashboard init failed:", error);
    document.getElementById("alertStack").innerHTML = '<div class="alert-row alert-red"><div><strong>Dashboard unavailable</strong><p>' + escapeHtml(error.message) + "</p></div></div>";
  } finally {
    document.body.classList.remove("loading");
  }
}
window.addEventListener("DOMContentLoaded", init);
