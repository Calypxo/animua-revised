// admin-frontend/src/management/animalProfiling.js
import "../css/animalProfiling.css";
import "../css/managementTables.css";
import "../css/recordsPanelReference.css";
import "../css/managementModal.css";
import { renderPageHeader } from "../components/management/pageHeader.js";
import { PAGE_HEADER_CONFIGS } from "../components/management/pageHeaderConfigs.js";

import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser }      from "../components/management/topbarUser.js";
import { loadSidebar, navigateManagementPage } from "../components/management/sidebarLoader.js";
import { getAllAnimals }         from "../services/animal.service.js";
import {
  installManagementImageFallbacks,
  optimizedManagementImageUrl,
} from "../utils/image.js";

renderPageHeader(PAGE_HEADER_CONFIGS.animalProfiling);


let animals = [];
/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
let filtered = [];
let currentPage = 1;
const PAGE_SIZE = 4;
let activeTab   = "all";

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
const speciesInitial = species => String(species || "Animal").charAt(0).toUpperCase();

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

function formatRecordDate(value) {
  const date = parseDateValue(value);
  if (!date || isNaN(date)) return "Not recorded";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function lifecycleMessage(status) {
  const messages = {
    Profiling: "Profile details are being completed before quarantine placement.",
    Quarantine: "Under quarantine and medical monitoring.",
    Ready: "Cleared for adoption and ready for applicant review.",
    Adopted: "Placement completed; record retained for post-adoption history.",
    Fostered: "Currently placed in an approved foster home.",
    Archived: "This animal record is archived and no longer active.",
  };
  return messages[status] || "Open the profile to review the current care stage.";
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
  const profilingCount = animals.filter(a=>a.status==="Profiling").length;
  set("statTotal",      animals.length);
  set("statProfiling",  profilingCount);
  set("heroProfilingCount", profilingCount);
  set("statQuarantine", animals.filter(a=>a.status==="Quarantine").length);
  set("statReady",      animals.filter(a=>a.status==="Ready").length);
  set("statAdopted",    animals.filter(a=>a.status==="Adopted").length);
  set("statArchived",   animals.filter(a=>a.status==="Archived").length);
}

function animalDisplayLabel(record = {}) {
  const legacyName = String(record.name || "").trim();
  const meaningfulLegacyName =
    legacyName &&
    !["unknown", "unnamed", "unnamed pet"].includes(
      legacyName.toLowerCase()
    );

  return (
    record.adoptedName ||
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
    const name = animalDisplayLabel(a).toLowerCase();
    const breed = (a.breed || "").toLowerCase();
    const speciesName = (a.species || "").toLowerCase();

    if (q && !id.includes(q) && !name.includes(q) && !breed.includes(q) && !speciesName.includes(q)) {
      return false;
    }

    return true;
  });

  const resultLabel = document.getElementById("animalResultLabel");
  if (resultLabel) resultLabel.textContent = `${filtered.length} record${filtered.length === 1 ? "" : "s"}`;

  console.log("FILTERED:", filtered);

  currentPage = 1;
  renderTable();
  renderPagination();
}

function clearAnimalFilters() {
  ["searchAnimals", "filterSpecies", "filterSex"].forEach(id => {
    const control = document.getElementById(id);
    if (control) control.value = "";
  });

  activeTab = "all";
  document.querySelectorAll(".ap-tab").forEach(tab => {
    const selected = tab.dataset.tab === "all";
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  document.querySelector('.ap-tab[data-tab="all"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  applyFilters();
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
    tbody.innerHTML = `<div class="ap-empty-state"><span><i class="bi bi-search"></i></span><strong>No matching animal profiles</strong><p>Adjust your search or lifecycle filters to view more records.</p><button type="button" id="emptyClearAnimalFilters">Clear all filters</button></div>`;
    document.getElementById("emptyClearAnimalFilters")?.addEventListener("click", clearAnimalFilters);
    return;
  }

  tbody.innerHTML = page.map(a => {
    const days = daysSince(a.intakeDate);
    const displayLabel = animalDisplayLabel(a);
    const originalPhoto = String(a.photoURL || "").trim();
    const cardPhoto = optimizedManagementImageUrl(originalPhoto, 480);
    const housingLabel = a.cageNumber
      ? `Cage ${a.cageNumber}`
      : a.housingType || "Unassigned";
    return `
    <article class="animal-record-card" data-id="${a.id || ""}" role="listitem" tabindex="0" aria-label="Open profile for ${displayLabel}">
      <div class="animal-record-media">
        ${originalPhoto
          ? `<img src="${cardPhoto}" data-original-src="${originalPhoto}" alt="${displayLabel}" class="animal-record-photo" loading="lazy" decoding="async" fetchpriority="low"><div class="animal-record-fallback" data-image-fallback hidden><span>${speciesInitial(a.species)}</span><small>${a.species || "Animal"}</small></div>`
          : `<div class="animal-record-fallback"><span>${speciesInitial(a.species)}</span><small>${a.species || "Animal"}</small></div>`}
        <span class="animal-record-id"><i class="bi bi-upc-scan"></i>${a.id || "No ID"}</span>
      </div>
      <div class="animal-record-content">
        <div class="animal-record-badges">
          <span class="animal-type-badge"><i class="bi bi-tag"></i>${a.species || "Unknown"} / ${a.breed || "Unknown breed"}</span>
          ${statusBadge(a.status)}
        </div>

        <div class="animal-record-heading">
          <div>
            <h3>${displayLabel}</h3>
            <p><i class="bi bi-gender-ambiguous"></i>${a.sex || "Unknown sex"}<span>·</span>${a.ageEstimate || "Age unknown"}</p>
          </div>
          <div class="animal-care-time" aria-label="${days} days in care"><strong>${days}</strong><span>days in care</span></div>
        </div>

        <div class="animal-record-facts">
          <div class="animal-record-source"><i class="bi bi-box-arrow-in-down"></i><span><small>Intake source</small><strong>${a.source || "Unknown"}</strong></span></div>
          <div><i class="bi bi-calendar3"></i><span><small>Intake date</small><strong>${formatRecordDate(a.intakeDate)}</strong></span></div>
          <div><i class="bi bi-door-open"></i><span><small>Current housing</small><strong>${housingLabel}</strong></span></div>
        </div>

        <div class="animal-record-footer">
          <div class="animal-record-note"><i class="bi bi-info-circle"></i><span>${lifecycleMessage(a.status)}</span></div>
          <button class="animal-record-open management-view-action management-view-action--labeled" type="button" aria-label="View profile for ${displayLabel}" data-id="${a.id || ""}"><i class="bi bi-eye" aria-hidden="true"></i><span>View complete profile</span></button>
        </div>
      </div>
    </article>`;
  }).join("");

  installManagementImageFallbacks(tbody);

  tbody.querySelectorAll(".animal-record-card[data-id]").forEach(card => {
    const openProfile = () => {
      if (!card.dataset.id) return;
      navigateManagementPage(`/pages/animalProfile.html?id=${card.dataset.id}`);
    };
    card.addEventListener("click", openProfile);
    card.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openProfile();
    });
  });

  tbody.querySelectorAll(".animal-record-open[data-id]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      if (!btn.dataset.id) return;
      navigateManagementPage(`/pages/animalProfile.html?id=${btn.dataset.id}`);
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
    const session = await protectManagementPage();
    renderTopbarUser();
    await loadSidebar();
    await loadAnimals();

    document.querySelectorAll(".ap-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".ap-tab").forEach(t => {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        activeTab = btn.dataset.tab;
        applyFilters();
        btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      });
    });

    document.getElementById("searchAnimals")?.addEventListener("input", applyFilters);
    document.getElementById("filterSpecies")?.addEventListener("change", applyFilters);
    document.getElementById("filterSex")?.addEventListener("change", applyFilters);
    document.getElementById("clearAnimalFilters")?.addEventListener("click", clearAnimalFilters);

    document.body.classList.remove("loading");
  } catch (err) {
    console.error("Animal Profiling init failed:", err);
    document.body.classList.remove("loading");
  }
}

window.addEventListener("DOMContentLoaded", init);
