import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../components/global/welcome.js";
import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { apiFetch } from "../utils/api.js";

let animals = [];
let activities = [];
let intakeChart;
let speciesChart;
let stayChart;

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
const speciesEmoji = (species) =>
  ({ Dog: "🐶", Cat: "🐱", Rabbit: "🐰", Bird: "🐦" })[species] || "🐾";
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
    ["intakeCount", data.intake],
    ["profilingCount", data.profiling],
    ["quarantineCount", data.quarantine],
    ["readyCount", data.readyForAdoption],
    ["adoptedCount", data.adopted],
    ["archivedCount", data.archived],
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

function renderCharts(data) {
  intakeChart = chart("intakeAdoptionChart", intakeChart, {
    type: "bar",
    data: {
      labels: data.monthlyData.labels,
      datasets: [
        { label: "Intake", data: data.monthlyData.intake, backgroundColor: "rgba(111,25,28,.16)", borderColor: "#97262b", borderWidth: 2, borderRadius: 6 },
        { label: "Adoptions", data: data.monthlyData.adoptions, backgroundColor: "rgba(24,101,52,.16)", borderColor: "#186534", borderWidth: 2, borderRadius: 6 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  });
  const species = data.species || [];
  speciesChart = chart("speciesChart", speciesChart, {
    type: "doughnut",
    data: { labels: species.map((item) => item.label), datasets: [{ data: species.map((item) => item.count), backgroundColor: species.map((item) => item.color), borderColor: "#fff", borderWidth: 3 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "70%", plugins: { legend: { display: false } } },
  });
  const total = species.reduce((sum, item) => sum + item.count, 0);
  document.getElementById("speciesLegend").innerHTML = species.length
    ? species.map((item) => '<div class="sp-legend-item"><div class="sp-legend-dot" style="background:' + item.color + '"></div><span><span class="sp-legend-name">' + escapeHtml(item.label) + "</span> " + item.count + " (" + Math.round((item.count / total) * 100) + "%)</span></div>").join("")
    : '<p class="text-muted">No current animal records.</p>';
  stayChart = chart("stayChart", stayChart, {
    type: "bar",
    data: { labels: data.stayDistribution.labels, datasets: [{ label: "Animals", data: data.stayDistribution.data, backgroundColor: ["#186534","#2558a8","#b86a00","#97262b","#6f191c"], borderRadius: 8 }] },
    options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } },
  });
}

function renderActivities(filter = "all") {
  const rows = filter === "all"
    ? activities
    : activities.filter((item) => item.action.toLowerCase().includes(filter));
  document.getElementById("activityTableBody").innerHTML = rows.length
    ? rows.map((item) => "<tr><td><strong>" + escapeHtml(item.name) + '</strong><div class="animal-id-text">' + escapeHtml(item.id) + "</div></td><td>" + escapeHtml(item.module) + "</td><td>" + escapeHtml(item.action.replaceAll(".", " ")) + "</td><td>" + escapeHtml(item.staff) + '</td><td style="font-family:var(--mono);font-size:.76rem">' + dateText(item.date) + "</td><td>" + statusBadge(item.status) + "</td></tr>").join("")
    : '<tr><td colspan="6" class="text-center py-4 text-muted">No recorded activity.</td></tr>';
}

function renderAnimals(query = "") {
  const search = query.toLowerCase().trim();
  const rows = animals.filter((item) =>
    [item.id, item.label, item.species, item.breed, item.status]
      .some((value) => String(value || "").toLowerCase().includes(search))
  );
  document.getElementById("recentAnimalsBody").innerHTML = rows.length
    ? rows.map((item) => '<tr><td style="font-family:var(--mono)">' + escapeHtml(item.id) + '</td><td><div class="animal-name-cell"><div class="animal-thumb">' + speciesEmoji(item.species) + '</div><div class="animal-name-text">' + escapeHtml(item.label) + "</div></div></td><td>" + escapeHtml(item.species) + "</td><td>" + escapeHtml(item.breed) + "</td><td>" + escapeHtml(item.age) + "</td><td>" + statusBadge(item.status) + '</td><td><span class="days-badge">' + item.days + "d</span></td><td>" + (item.assessmentComplete ? "✓ Complete" : "Pending") + '</td><td><a class="tbl-action-btn" href="/pages/animalProfile.html?id=' + encodeURIComponent(item.id) + '"><i class="bi bi-arrow-right-short"></i></a></td></tr>').join("")
    : '<tr><td colspan="9" class="text-center py-4 text-muted">No animals found.</td></tr>';
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
    const data = await apiFetch("/dashboard/stats");
    document.getElementById("live-date").textContent = new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const name = localStorage.getItem("user_name") || "Admin";
    document.getElementById("welcomeName").textContent = name.split(" ")[0];
    populateCounts(data);
    renderCharts(data);
    activities = data.recentActivity || [];
    animals = data.recentAnimals || [];
    renderActivities();
    renderAnimals();
    renderAlerts(data.alerts || []);
    renderQueues(data);
    document.getElementById("activityFilter")?.addEventListener("change", (event) => renderActivities(event.target.value));
    document.getElementById("animalSearch")?.addEventListener("input", (event) => renderAnimals(event.target.value));
    document.getElementById("globalSearch")?.addEventListener("input", (event) => renderAnimals(event.target.value));
  } catch (error) {
    console.error("Dashboard init failed:", error);
    document.getElementById("alertStack").innerHTML = '<div class="alert-row alert-red"><div><strong>Dashboard unavailable</strong><p>' + escapeHtml(error.message) + "</p></div></div>";
  } finally {
    document.body.classList.remove("loading");
  }
}
window.addEventListener("DOMContentLoaded", init);
