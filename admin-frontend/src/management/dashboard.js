import "../css/adminDashboard.css";
import "../css/sidebar.css";

import "../components/global/welcome.js";
import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { API_BASE_URL } from "../utils/api.js";

import Swal from "sweetalert2";
window.Swal = Swal;

/* ── Mock data (used when API not available) ── */
const MOCK = {
  stats: {
    totalPets: 142,
    intake: 18,
    quarantine: 9,
    readyForAdoption: 47,
    adopted: 23,
    trends: {
      total: "+6 this week",
      intake: "5 pending review",
      quarantine: "2 cleared today",
      ready: "+8 since last week",
      adopted: "+4 vs last month"
    }
  },

  monthlyData: {
    labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    intake:    [22, 18, 29, 25, 33, 28, 31, 26, 24, 30, 21, 19],
    adoptions: [14, 12, 20, 18, 26, 22, 25, 20, 19, 24, 16, 13]
  },

  species: [
    { label: "Dogs",    count: 68,  color: "#b86a00" },
    { label: "Cats",    count: 44,  color: "#2558a8" },
    { label: "Rabbits", count: 18,  color: "#0d6e6e" },
    { label: "Birds",   count: 7,   color: "#186534" },
    { label: "Others",  count: 5,   color: "#8c8481" }
  ],

  stayDistribution: {
    labels: ["0–7d","8–14d","15–30d","31–60d","60+d"],
    data:   [24, 31, 42, 28, 17]
  },

  activities: [
    { id:"A-2041", name:"Buddy",   species:"Dog",    breed:"Labrador Mix",    event:"intake",   desc:"Owner surrender",        staff:"M. Santos",    date:"Today, 09:14",  status:"intake"     },
    { id:"A-2040", name:"Mochi",   species:"Cat",    breed:"Domestic Shorthair", event:"medical", desc:"Vaccination completed", staff:"Dr. Reyes",   date:"Today, 08:30",  status:"quarantine" },
    { id:"A-2039", name:"Rex",     species:"Dog",    breed:"German Shepherd", event:"adoption",  desc:"Adoption finalized",     staff:"L. Cruz",      date:"Yesterday",     status:"adopted"    },
    { id:"A-2038", name:"Luna",    species:"Cat",    breed:"Persian",         event:"intake",    desc:"Stray intake",           staff:"R. Bautista",  date:"Yesterday",     status:"intake"     },
    { id:"A-2037", name:"Peanut",  species:"Rabbit", breed:"Holland Lop",     event:"transfer",  desc:"Inter-shelter transfer", staff:"K. Valdez",    date:"2 days ago",    status:"foster"     },
    { id:"A-2036", name:"Shadow",  species:"Dog",    breed:"Border Collie",   event:"medical",   desc:"Post-op follow-up",      staff:"Dr. Reyes",    date:"2 days ago",    status:"quarantine" },
    { id:"A-2035", name:"Whisper", species:"Bird",   breed:"Cockatiel",       event:"intake",    desc:"Found stray",            staff:"M. Santos",    date:"3 days ago",    status:"ready"      },
    { id:"A-2034", name:"Coco",    species:"Dog",    breed:"Chihuahua Mix",   event:"adoption",  desc:"Adoption finalized",     staff:"L. Cruz",      date:"3 days ago",    status:"adopted"    }
  ],

  recentAnimals: [
    { id:"A-2041", name:"Buddy",   species:"Dog",    breed:"Labrador Mix",         age:"2y",   status:"intake",     days:1,  compat:null },
    { id:"A-2040", name:"Mochi",   species:"Cat",    breed:"Domestic Shorthair",   age:"3y",   status:"quarantine", days:4,  compat:null },
    { id:"A-2039", name:"Luna",    species:"Cat",    breed:"Persian",               age:"1y",   status:"intake",     days:2,  compat:null },
    { id:"A-2038", name:"Rex",     species:"Dog",    breed:"German Shepherd",       age:"4y",   status:"ready",      days:18, compat:88  },
    { id:"A-2037", name:"Peanut",  species:"Rabbit", breed:"Holland Lop",           age:"1y",   status:"foster",     days:11, compat:72  },
    { id:"A-2036", name:"Shadow",  species:"Dog",    breed:"Border Collie",         age:"3y",   status:"quarantine", days:7,  compat:null },
    { id:"A-2035", name:"Whisper", species:"Bird",   breed:"Cockatiel",             age:"6mo",  status:"ready",      days:3,  compat:65  },
    { id:"A-2034", name:"Coco",    species:"Dog",    breed:"Chihuahua Mix",         age:"5y",   status:"ready",      days:22, compat:91  },
    { id:"A-2033", name:"Nala",    species:"Cat",    breed:"Siamese",               age:"2y",   status:"ready",      days:31, compat:84  },
    { id:"A-2032", name:"Thor",    species:"Dog",    breed:"Rottweiler Mix",        age:"1y",   status:"medical",    days:9,  compat:null },
  ],

  alerts: [
    { type:"amber", icon:"bi-exclamation-triangle-fill", title:"7 pending applications", desc:"Review newly submitted adoption requests." },
    { type:"red",   icon:"bi-clock-fill",                title:"3 animals over 60 days",   desc:"Long-stay animals need priority attention." },
    { type:"blue",  icon:"bi-clipboard2-pulse",          title:"Medical check due",         desc:"4 animals have overdue health checkups." },
    { type:"green", icon:"bi-check-circle-fill",         title:"2 cleared from quarantine", desc:"Shadow and Tiger are ready to move forward." }
  ],

  searchIndex: [
    { id:"A-2041", name:"Buddy",   type:"Dog",    status:"intake"     },
    { id:"A-2040", name:"Mochi",   type:"Cat",    status:"quarantine" },
    { id:"A-2039", name:"Luna",    type:"Cat",    status:"intake"     },
    { id:"A-2038", name:"Rex",     type:"Dog",    status:"ready"      },
    { id:"A-2037", name:"Peanut",  type:"Rabbit", status:"foster"     },
    { id:"A-2036", name:"Shadow",  type:"Dog",    status:"quarantine" },
    { id:"A-2035", name:"Whisper", type:"Bird",   status:"ready"      }
  ]
};

/* ── Helpers ───────────────────────────────────────── */
const speciesEmoji = s => ({ Dog:"🐶", Cat:"🐱", Rabbit:"🐰", Bird:"🐦" }[s] || "🐾");
const speciesThumb = s => ({ Dog:"thumb-dog", Cat:"thumb-cat", Bird:"thumb-bird" }[s] || "thumb-other");

const statusBadgeMap = {
  intake:     { cls:"badge-intake",     label:"Intake"     },
  quarantine: { cls:"badge-quarantine", label:"Quarantine" },
  ready:      { cls:"badge-ready",      label:"Ready"      },
  adopted:    { cls:"badge-adopted",    label:"Adopted"    },
  medical:    { cls:"badge-medical",    label:"Medical"    },
  foster:     { cls:"badge-foster",     label:"Foster"     },
  transfer:   { cls:"badge-transfer",   label:"Transfer"   }
};

const eventBadgeMap = {
  intake:   { cls:"event-intake",   icon:"bi-box-arrow-in-down", label:"Intake"   },
  adoption: { cls:"event-adoption", icon:"bi-balloon-heart",     label:"Adoption" },
  medical:  { cls:"event-medical",  icon:"bi-clipboard2-pulse",  label:"Medical"  },
  transfer: { cls:"event-transfer", icon:"bi-arrow-left-right",  label:"Transfer" }
};

function statusBadge(status) {
  const m = statusBadgeMap[status] || { cls:"badge-transfer", label:status };
  return `<span class="status-badge ${m.cls}">${m.label}</span>`;
}

function eventBadge(event) {
  const m = eventBadgeMap[event] || { cls:"event-transfer", icon:"bi-arrow-left-right", label:event };
  return `<span class="event-badge ${m.cls}"><i class="bi ${m.icon}"></i>${m.label}</span>`;
}

function daysBadge(days) {
  const cls = days >= 60 ? "days-urgent" : days >= 30 ? "days-warn" : "days-ok";
  return `<span class="days-badge ${cls}">${days}d</span>`;
}

function compatBar(score) {
  if (score === null || score === undefined)
    return `<span class="compat-score-label score-text-none">—</span>`;
  const cls  = score >= 80 ? "score-fill-high"  : score >= 60 ? "score-fill-mid"  : "score-fill-low";
  const tcls = score >= 80 ? "score-text-high"  : score >= 60 ? "score-text-mid"  : "score-text-low";
  return `
    <div class="compat-bar-wrap">
      <div class="compat-bar"><div class="compat-bar-fill ${cls}" style="width:${score}%"></div></div>
      <span class="compat-score-label ${tcls}">${score}%</span>
    </div>`;
}

/* ── Counter animation ─────────────────────────────── */
function animateCounter(el, target, duration = 900) {
  const start = performance.now();
  const from  = parseInt(el.textContent) || 0;
  const step  = ts => {
    const p = Math.min((ts - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (target - from) * ease);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ── Charts ────────────────────────────────────────── */
let intakeChart, speciesChart, stayChart;

function buildIntakeChart(data) {
  const ctx = document.getElementById("intakeAdoptionChart");
  if (!ctx) return;
  if (intakeChart) intakeChart.destroy();

  intakeChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Intake",
          data: data.intake,
          backgroundColor: "rgba(111,25,28,0.15)",
          borderColor: "#97262b",
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: "Adoptions",
          data: data.adoptions,
          backgroundColor: "rgba(24,101,52,0.15)",
          borderColor: "#186534",
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#fff",
          titleColor: "#181517",
          bodyColor: "#8c8481",
          borderColor: "rgba(28,20,20,0.12)",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          titleFont: { family: "'Outfit', sans-serif", weight: "700", size: 13 },
          bodyFont:  { family: "'Outfit', sans-serif", size: 12 }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: "'DM Mono', monospace", size: 11 }, color: "#b5b0ac" }
        },
        y: {
          grid: { color: "rgba(28,20,20,0.05)" },
          ticks: { font: { family: "'DM Mono', monospace", size: 11 }, color: "#b5b0ac", stepSize: 10 },
          beginAtZero: true
        }
      }
    }
  });
}

function buildSpeciesChart(species) {
  const ctx = document.getElementById("speciesChart");
  if (!ctx) return;
  if (speciesChart) speciesChart.destroy();

  speciesChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: species.map(s => s.label),
      datasets: [{
        data: species.map(s => s.count),
        backgroundColor: species.map(s => s.color),
        borderColor: "#fff",
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#fff",
          titleColor: "#181517",
          bodyColor: "#8c8481",
          borderColor: "rgba(28,20,20,0.12)",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: ctx => ` ${ctx.parsed} animals (${Math.round(ctx.parsed / species.reduce((a,s)=>a+s.count,0)*100)}%)`
          }
        }
      }
    }
  });

  // Build legend
  const legend = document.getElementById("speciesLegend");
  if (legend) {
    const total = species.reduce((a,s) => a + s.count, 0);
    legend.innerHTML = species.map(s => `
      <div class="sp-legend-item">
        <div class="sp-legend-dot" style="background:${s.color}"></div>
        <span><span class="sp-legend-name">${s.label}</span> ${s.count} <span style="color:var(--stone-2)">(${Math.round(s.count/total*100)}%)</span></span>
      </div>`).join("");
  }
}

function buildStayChart(data) {
  const ctx = document.getElementById("stayChart");
  if (!ctx) return;
  if (stayChart) stayChart.destroy();

  stayChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [{
        label: "Animals",
        data: data.data,
        backgroundColor: [
          "rgba(24,101,52,0.7)",
          "rgba(37,88,168,0.7)",
          "rgba(184,106,0,0.7)",
          "rgba(111,25,28,0.7)",
          "rgba(111,25,28,1)"
        ],
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#fff",
          titleColor: "#181517",
          bodyColor: "#8c8481",
          borderColor: "rgba(28,20,20,0.12)",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          callbacks: { label: ctx => ` ${ctx.parsed.x} animals` }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(28,20,20,0.05)" },
          ticks: { font: { family:"'DM Mono',monospace", size:11 }, color:"#b5b0ac" }
        },
        y: {
          grid: { display: false },
          ticks: { font: { family:"'DM Mono',monospace", size:11 }, color:"#8c8481" }
        }
      }
    }
  });
}

/* ── Render activity table ─────────────────────────── */
let allActivities = [];

function renderActivityTable(filter = "all") {
  const tbody = document.getElementById("activityTableBody");
  if (!tbody) return;

  const rows = filter === "all" ? allActivities : allActivities.filter(a => a.event === filter);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No activity found</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(a => `
    <tr>
      <td>
        <div class="animal-name-cell">
          <div class="animal-thumb ${speciesThumb(a.species)}">${speciesEmoji(a.species)}</div>
          <div>
            <div class="animal-name-text">${a.name}</div>
            <div class="animal-id-text">${a.id}</div>
          </div>
        </div>
      </td>
      <td>${speciesEmoji(a.species)} ${a.species}</td>
      <td>
        ${eventBadge(a.event)}
        <div style="font-size:0.75rem;color:var(--stone);margin-top:3px">${a.desc}</div>
      </td>
      <td style="color:var(--stone)">${a.staff}</td>
      <td style="font-family:var(--mono);font-size:0.76rem;color:var(--stone)">${a.date}</td>
      <td>${statusBadge(a.status)}</td>
    </tr>`).join("");
}

/* ── Render recent animals ─────────────────────────── */
let allAnimals = [];

function renderAnimalsTable(search = "") {
  const tbody = document.getElementById("recentAnimalsBody");
  if (!tbody) return;

  const q = search.toLowerCase().trim();
  const rows = q
    ? allAnimals.filter(a => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.breed.toLowerCase().includes(q) || a.species.toLowerCase().includes(q))
    : allAnimals;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No animals found</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(a => `
    <tr>
      <td style="font-family:var(--mono);font-size:0.76rem;color:var(--stone)">${a.id}</td>
      <td>
        <div class="animal-name-cell">
          <div class="animal-thumb ${speciesThumb(a.species)}">${speciesEmoji(a.species)}</div>
          <div class="animal-name-text">${a.name}</div>
        </div>
      </td>
      <td>${a.species}</td>
      <td style="color:var(--stone);font-size:0.83rem">${a.breed}</td>
      <td style="font-size:0.83rem">${a.age}</td>
      <td>${statusBadge(a.status)}</td>
      <td>${daysBadge(a.days)}</td>
      <td style="min-width:130px">${compatBar(a.compat)}</td>
      <td>
        <button class="tbl-action-btn" title="View record" onclick="window.location='/pages/management/animalRecords.html?id=${a.id}'">
          <i class="bi bi-arrow-right-short"></i>
        </button>
      </td>
    </tr>`).join("");
}

/* ── Render alerts ─────────────────────────────────── */
function renderAlerts(alerts) {
  const stack = document.getElementById("alertStack");
  const badge = document.getElementById("alertCount");
  if (badge) badge.textContent = alerts.length;
  if (!stack) return;

  stack.innerHTML = alerts.map(a => `
    <div class="alert-row alert-${a.type}">
      <div class="alert-ico"><i class="bi ${a.icon}"></i></div>
      <div>
        <strong>${a.title}</strong>
        <p>${a.desc}</p>
      </div>
    </div>`).join("");
}

/* ── Live date ─────────────────────────────────────── */
function setLiveDate() {
  const el = document.getElementById("live-date");
  if (!el) return;
  el.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

/* ── Welcome name ──────────────────────────────────── */
function syncWelcomeName() {
  const el = document.getElementById("welcomeName");
  const name = localStorage.getItem("user_name") || "Admin";
  if (el) el.textContent = name.split(" ")[0] || name;
}

/* ── Sidebar toggle ────────────────────────────────── */
function bindSidebarToggle() {
  const btn = document.getElementById("sidebarToggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    const mobileToggle = document.getElementById("mobile-nav-toggle");
    if (window.innerWidth <= 768 && mobileToggle) { mobileToggle.click(); return; }
    if (sidebar) sidebar.classList.toggle("collapsed");
  });
}

/* ── Global search ─────────────────────────────────── */
function bindSearch() {
  const input    = document.getElementById("globalSearch");
  const dropdown = document.getElementById("searchDropdown");
  if (!input || !dropdown) return;

  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    if (!q) { dropdown.classList.add("d-none"); return; }

    const results = MOCK.searchIndex.filter(r =>
      r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.type.toLowerCase().includes(q)
    ).slice(0, 6);

    if (!results.length) { dropdown.classList.add("d-none"); return; }

    dropdown.innerHTML = results.map(r => `
      <div class="search-result-item" onclick="window.location='/pages/management/animalRecords.html?id=${r.id}'">
        <div class="sri-icon">${speciesEmoji(r.type)}</div>
        <div>
          <div class="sri-name">${r.name}</div>
          <div class="sri-meta">${r.id} · ${r.type} · ${r.status}</div>
        </div>
      </div>`).join("");

    dropdown.classList.remove("d-none");
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".search-pill")) dropdown.classList.add("d-none");
  });
}

/* ── Animal table search ───────────────────────────── */
function bindAnimalSearch() {
  const input = document.getElementById("animalSearch");
  if (!input) return;
  input.addEventListener("input", () => renderAnimalsTable(input.value));
}

/* ── Activity filter ───────────────────────────────── */
function bindActivityFilter() {
  const sel = document.getElementById("activityFilter");
  if (!sel) return;
  sel.addEventListener("change", () => renderActivityTable(sel.value));
}

/* ── Load stats from API ───────────────────────────── */
async function loadDashboardStats() {
  try {
    const token = localStorage.getItem("animua_token");
    const res   = await fetch(`${API_BASE_URL}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("API error");

    const stats = await res.json();
    return stats;
  } catch {
    // Fall back to mock data
    return null;
  }
}

/* ── Populate KPIs ─────────────────────────────────── */
function populateKPIs(stats) {
  const map = [
    ["totalPetsCount",  stats.totalPets,         stats.trends?.total],
    ["intakeCount",     stats.intake,             stats.trends?.intake],
    ["quarantineCount", stats.quarantine,         stats.trends?.quarantine],
    ["readyCount",      stats.readyForAdoption,   stats.trends?.ready],
    ["adoptedCount",    stats.adopted,            stats.trends?.adopted]
  ];

  map.forEach(([id, val, trend]) => {
    const el = document.getElementById(id);
    if (el) animateCounter(el, val ?? 0);
    const trendIds = {
      totalPetsCount:  "totalTrend",
      intakeCount:     "intakeTrend",
      quarantineCount: "quarantineTrend",
      readyCount:      "readyTrend",
      adoptedCount:    "adoptedTrend"
    };
    const tEl = document.getElementById(trendIds[id]);
    if (tEl && trend) tEl.textContent = trend;
  });
}

/* ── Main init ─────────────────────────────────────── */
async function initDashboard() {
  try {
    await protectManagementPage();
    loadSidebar();
    renderTopbarUser();
    bindSidebarToggle();
    setLiveDate();
    syncWelcomeName();
    bindSearch();
    bindAnimalSearch();
    bindActivityFilter();

    // Load stats (API or mock)
    const apiStats = await loadDashboardStats();
    const stats    = apiStats || MOCK.stats;
    populateKPIs(stats);

    // Charts
    buildIntakeChart(MOCK.monthlyData);
    buildSpeciesChart(MOCK.species);
    buildStayChart(MOCK.stayDistribution);

    // Tables
    allActivities = MOCK.activities;
    allAnimals    = MOCK.recentAnimals;
    renderActivityTable();
    renderAnimalsTable();
    renderAlerts(MOCK.alerts);

    document.body.classList.remove("loading");
  } catch (err) {
    console.error("Dashboard init failed:", err);
    document.body.classList.remove("loading");
  }
}

window.addEventListener("DOMContentLoaded", initDashboard);