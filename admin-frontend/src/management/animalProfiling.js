// admin-frontend/src/management/animalProfiling.js
import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../css/animalProfiling.css";

import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser }      from "../components/management/topbarUser.js";
import { loadSidebar }           from "../components/management/sidebarLoader.js";
import { getAllAnimals }         from "../services/animal.service.js";


let animals = [];
/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
let filtered = [];
let currentPage = 1;
const PAGE_SIZE = 8;
let activeTab   = "all";

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
const speciesEmoji = s => ({ Dog:"🐶", Cat:"🐱", Rabbit:"🐰", Bird:"🐦" }[s] || "🐾");
const speciesThumb = s => ({ Dog:"thumb-dog", Cat:"thumb-cat", Rabbit:"thumb-rabbit", Bird:"thumb-bird" }[s] || "thumb-other");

const statusCfg = {
  Profiling:  { cls:"badge-profiling",  icon:"bi-clipboard2-fill" },
  Quarantine: { cls:"badge-quarantine", icon:"bi-shield-plus" },
  Ready:      { cls:"badge-ready",      icon:"bi-house-heart-fill" },
  Adopted:    { cls:"badge-adopted",    icon:"bi-balloon-heart-fill" },
  Fostered:   { cls:"badge-fostered",   icon:"bi-house-door-fill" },
  Archived:   { cls:"badge-archived",   icon:"bi-archive-fill" },
};

function statusBadge(status) {
  const c = statusCfg[status] || statusCfg.Profiling;
  return `<span class="status-badge ${c.cls}"><i class="bi ${c.icon}"></i>${status}</span>`;
}

function parseDateValue(d) {
  if (!d) return null;
  if (typeof d === "string") return d.includes("T") ? new Date(d) : new Date(`${d}T00:00:00`);
  if (d._seconds) return new Date(d._seconds * 1000);
  return new Date(d);
}

function daysSince(dateValue) {
  const d = parseDateValue(dateValue);
  if (!d || isNaN(d)) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function daysBadge(days) {
  const cls = days >= 90 ? "days-urgent" : days >= 30 ? "days-warn" : "days-ok";
  return `<span class="days-badge ${cls}">${days}d</span>`;
}

function compatBar(assessment) {
  if (!assessment) return `<span class="compat-label label-none">—</span>`;

  const vals = Object.values(assessment);
  const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  const pct = (avg / 5) * 100;

  return `
    <div class="compat-bar-wrap">
      <div class="compat-bar">
        <div class="compat-bar-fill fill-mid" style="width:${pct}%"></div>
      </div>
      <span class="compat-label label-mid">${avg}/5</span>
    </div>`;
}

async function loadAnimals() {
  try {
    const data = await getAllAnimals();
    console.log("GET ALL ANIMALS RESPONSE:", data);
    animals = data.animals || [];
    console.log("ANIMALS ARRAY:", animals);

    renderStats();
    applyFilters();
  } catch (err) {
    console.error("[loadAnimals]", err);
    showToast("error", err.message || "Failed to load animals.");
    animals = [];
    renderStats();
    applyFilters();
  }
}

/* ══════════════════════════════════════════════════════
   STATS
══════════════════════════════════════════════════════ */
function renderStats() {
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set("statTotal",      animals.length);
  set("statProfiling",  animals.filter(a=>a.status==="Profiling").length);
  set("statQuarantine", animals.filter(a=>a.status==="Quarantine").length);
  set("statReady",      animals.filter(a=>a.status==="Ready").length);
  set("statAdopted",    animals.filter(a=>a.status==="Adopted").length);
  set("statArchived",   animals.filter(a=>a.status==="Archived").length);
}

/* ══════════════════════════════════════════════════════
   FILTER
══════════════════════════════════════════════════════ */
function applyFilters() {
  const q = (document.getElementById("searchAnimals")?.value || "").toLowerCase().trim();
  const species = document.getElementById("filterSpecies")?.value || "";
  const sex = document.getElementById("filterSex")?.value || "";

  console.log("ACTIVE TAB:", activeTab);
  console.log(
    "ALL STATUSES:",
    animals.map(a => ({
      id: a.id,
      name: a.name,
      status: a.status
    }))
  );

  filtered = animals.filter(a => {
    if (activeTab !== "all") {
    if (activeTab === "Quarantine") {
      if (a.status !== "Quarantine" && a.status !== "Quarantine & Medical Monitoring") {
        return false;
      }
    } else if (a.status !== activeTab) {
      return false;
    }
  }
    if (species && a.species !== species) return false;
    if (sex && a.sex !== sex) return false;

    const id = (a.id || "").toLowerCase();
    const name = (a.name || "").toLowerCase();
    const breed = (a.breed || "").toLowerCase();
    const speciesName = (a.species || "").toLowerCase();

    if (q && !id.includes(q) && !name.includes(q) && !breed.includes(q) && !speciesName.includes(q)) {
      return false;
    }

    return true;
  });

  console.log("FILTERED:", filtered);

  currentPage = 1;
  renderTable();
  renderPagination();
}

/* ══════════════════════════════════════════════════════
   TABLE
══════════════════════════════════════════════════════ */
function renderTable() {
  const tbody = document.getElementById("animalTableBody");
  if (!tbody) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);

  if (!page.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">No animals found.</td></tr>`;
    return;
  }

  tbody.innerHTML = page.map(a => {
    const days = daysSince(a.intakeDate);
    return `
    <tr data-id="${a.id || ""}">
      <td>
        <div class="animal-cell">
          <div class="animal-thumb">
            ${
              a.photoURL
                ? `<img src="${a.photoURL}" alt="${a.name}" class="animal-thumb-img">`
                : `<div class="animal-thumb-fallback">${
                    a.species === "Dog" ? "🐶" :
                    a.species === "Cat" ? "🐱" :
                    "🐾"
                  }</div>`
            }
          </div>

          <div class="animal-meta">
            <div class="animal-name">${a.name || "Unnamed"}</div>
            <div class="animal-id">${a.id}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-weight:600;font-size:0.84rem">${a.species || "Unknown"}</div>
        <div style="font-size:0.76rem;color:var(--stone)">${a.breed || "Unknown"}</div>
      </td>
      <td>
        <div style="font-size:0.84rem;font-weight:600">${a.sex || "Unknown"}</div>
        <div style="font-size:0.76rem;color:var(--stone)">${a.ageEstimate || "—"}</div>
      </td>
      <td>
        <span class="source-badge ${
          a.source === "Rescue"
            ? "source-rescue"
            : a.source === "Barangay Impound"
            ? "source-barangay"
            : "source-surrender"
        }">
          ${a.source || "Unknown"}
        </span>
      </td>
      <td>${daysBadge(days)}</td>
      <td>${compatBar(a.behavioralAssessment)}</td>
      <td>${statusBadge(a.status)}</td>
      <td>
        <button class="tbl-action-btn" title="View Profile" data-id="${a.id || ""}">
          <i class="bi bi-arrow-right-short" style="font-size:1.1rem"></i>
        </button>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll("tr[data-id]").forEach(row => {
    row.addEventListener("click", () => {
      if (!row.dataset.id) return;
      window.location.href = `/pages/animalProfile.html?id=${row.dataset.id}`;
    });
  });

  tbody.querySelectorAll("[data-id]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      if (!btn.dataset.id) return;
      window.location.href = `/pages/animalProfile.html?id=${btn.dataset.id}`;
    });
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
  const start = Math.min((currentPage-1)*PAGE_SIZE+1, total);
  const end   = Math.min(currentPage*PAGE_SIZE, total);

  let h = `<span class="page-info">Showing ${total?start:0}–${end} of ${total}</span>`;
  h += `<button class="page-btn" id="pagePrev" ${currentPage===1?"disabled":""}><i class="bi bi-chevron-left"></i></button>`;
  for (let i=1;i<=pages;i++) h+=`<button class="page-btn ${i===currentPage?"active":""}" data-page="${i}">${i}</button>`;
  h += `<button class="page-btn" id="pageNext" ${currentPage===pages?"disabled":""}><i class="bi bi-chevron-right"></i></button>`;
  bar.innerHTML = h;

  bar.querySelector("#pagePrev")?.addEventListener("click",()=>{ if(currentPage>1){currentPage--;renderTable();renderPagination();} });
  bar.querySelector("#pageNext")?.addEventListener("click",()=>{ if(currentPage<pages){currentPage++;renderTable();renderPagination();} });
  bar.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>{ currentPage=parseInt(b.dataset.page); renderTable(); renderPagination(); }));
}

/* ══════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════ */
let toastT;
function showToast(type, msg) {
  const t = document.getElementById("umToast"),
        i = document.getElementById("toastIcon"),
        m = document.getElementById("toastMsg");
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


/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */
async function init() {
  try {
    await protectManagementPage();
    renderTopbarUser();
    loadSidebar();
    


    await loadAnimals();

    document.querySelectorAll(".ap-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".ap-tab").forEach(t => t.classList.remove("active"));
        btn.classList.add("active");
        activeTab = btn.dataset.tab;
        applyFilters();
      });
    });

    document.getElementById("searchAnimals")?.addEventListener("input", applyFilters);
    document.getElementById("filterSpecies")?.addEventListener("change", applyFilters);
    document.getElementById("filterSex")?.addEventListener("change", applyFilters);

    document.body.classList.remove("loading");
  } catch (err) {
    console.error("Animal Profiling init failed:", err);
    document.body.classList.remove("loading");
  }
}

window.addEventListener("DOMContentLoaded", init);