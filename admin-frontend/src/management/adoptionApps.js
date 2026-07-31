// admin-frontend/src/management/adoptionApps.js
import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../css/adoptionApps.css";
import { renderPageHeader } from "../components/management/pageHeader.js";
import { PAGE_HEADER_CONFIGS } from "../components/management/pageHeaderConfigs.js";

import { protectPageByModule } from "../auth/authGuard.js";
import { hasPermission } from "../auth/permissions.js";
import { renderTopbarUser }      from "../components/management/topbarUser.js";
import { loadSidebar }           from "../components/management/sidebarLoader.js";
import { getUserName }           from "../utils/storage.js";
import {
  getAllAdoptions,
  approveAdoption,
  rejectAdoption,
  finalizeAdoption
} from "../services/adoption.service.js";

renderPageHeader(PAGE_HEADER_CONFIGS.adoptions);



const QUIZ_DIMENSIONS = [
  { key:"energyLevel",          label:"Activity level"    },
  { key:"exerciseNeeds",        label:"Exercise ability"  },
  { key:"independenceLevel",    label:"Prefers independence"},
  { key:"attentionNeeds",       label:"Can give attention" },
  { key:"playfulness",          label:"Enjoys play"       },
  { key:"friendlinessToHumans", label:"Social household"  },
  { key:"goodWithKids",         label:"Kids at home"      },
  { key:"goodWithOtherPets",    label:"Other pets at home"},
  { key:"strangerTolerance",    label:"Visitor frequency" },
  { key:"noiseLevel",           label:"Noise tolerance"   },
  { key:"spaceNeeds",           label:"Living space"      },
  { key:"adaptability",         label:"Routine stability" },
];

const AVATAR_COLOR = "#ef1725";

function mapAdoptionFromBackend(a) {
  const compatibility = a.compatibility || null;
  const preferences = compatibility?.preferences || null;
  const filters = compatibility?.filters || null;
  const matchPercent = compatibility?.matchPercent ?? null;

  return {
    id: a.id,
    applicationId: a.applicationId || a.id,
    pet_id: a.pet_id,
    pet_name: a.pet_name,

    type: compatibility ? "Quiz Match" : "Direct Browse",
    status: a.status || "Pending",
    submitted: a.submittedAt?.seconds
      ? new Date(a.submittedAt.seconds * 1000).toISOString().split("T")[0]
      : "",

    animal: {
      id: a.animal?.id || a.pet_id,
      name: a.animal?.name || a.pet_name,
      species: a.animal?.species || "Unknown",
      breed: a.animal?.breed || "Unknown",
      status: a.animal?.status || "",
      vector: a.animal?.compatibilityVector || [],
    },

    adopter: {
      name: a.applicant?.full_name || "Unknown",
      email: a.applicant?.email || "N/A",
      contact: a.applicant?.contact_number || "",
      address: a.applicant?.address || "",
      idType: a.applicant?.idType || "N/A",
      occupation: a.applicant?.occupation || "",
      color: AVATAR_COLOR,
      initials: (a.applicant?.full_name || "U")
        .split(" ")
        .map(n => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    },

    reqDone: 0,
    compatScore: matchPercent ? Math.round(Number(matchPercent)) : null,
    adopterAnswers: preferences,
    quizFilters: filters,
    quizTopMatches: compatibility?.quizTopMatches || null,

    rejectedReason: a.rejectedReason || "",
    adoptionDate: a.adoptionDate || "",
    adoptedName: a.adoptedName || "",
    processedBy: a.processedBy || "",
  };
}

async function loadAdoptions() {
  try {
    const data = await getAllAdoptions();
    adoptionApps = (data.adoptions || []).map(mapAdoptionFromBackend);

    renderStats();
    applyFilters();
  } catch (err) {
    console.error("[loadAdoptions]", err);
    showToast("error", err.message || "Failed to load adoption requests.");
    adoptionApps = [];

    renderStats();
    applyFilters();
  }
}

// Cosine similarity helper
function cosineSim(a, b) {
  const dot  = a.reduce((s,v,i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s,v) => s + v*v, 0));
  const magB = Math.sqrt(b.reduce((s,v) => s + v*v, 0));
  if (!magA || !magB) return 0;
  return Math.round((dot / (magA * magB)) * 100);
}


// Generate quiz answers and compute compat score
function makeQuizApp(animalId, animalName, animalSpecies, animalBreed, animalVector) {
  const adopterAnswers = {
    energyLevel:          Math.ceil(Math.random()*5),
    exerciseNeeds:        Math.ceil(Math.random()*5),
    independenceLevel:    Math.ceil(Math.random()*5),
    attentionNeeds:       Math.ceil(Math.random()*5),
    playfulness:          Math.ceil(Math.random()*5),
    friendlinessToHumans: Math.ceil(Math.random()*5),
    goodWithKids:         Math.ceil(Math.random()*5),
    goodWithOtherPets:    Math.ceil(Math.random()*5),
    strangerTolerance:    Math.ceil(Math.random()*5),
    noiseLevel:           Math.ceil(Math.random()*5),
    spaceNeeds:           Math.ceil(Math.random()*5),
    adaptability:         Math.ceil(Math.random()*5),
  };
  const adopterVector  = Object.values(adopterAnswers);
  const petVector      = animalVector.slice(0, 12); // first 12 match quiz dims
  const compatScore    = cosineSim(adopterVector, petVector);

  return { adopterAnswers, adopterVector, compatScore };
}

/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
let adoptionApps = [];
let filtered = [];
let currentPage  = 1;
const PAGE_SIZE  = 8;
let activeTab    = "all";
let activeAppId  = null;
let confirmMode  = null; // "reject" | "finalize"
let currentRole = "";

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
const emoji = s => ({Dog:"🐶",Cat:"🐱",Rabbit:"🐰",Bird:"🐦"}[s]||"🐾");
const thumbCls = s => ({Dog:"thumb-dog",Cat:"thumb-cat"}[s]||"thumb-other");

function statusBadge(s) {
  const m = {Pending:{cls:"badge-pending"},Approved:{cls:"badge-approved"},Finalized:{cls:"badge-finalized"},Rejected:{cls:"badge-rejected"}}[s]||{cls:"badge-pending"};
  return `<span class="status-badge ${m.cls}">${s}</span>`;
}

function formatDate(d) {
  if (!d) return "—";
  const date = d.includes?.("T") ? new Date(d) : new Date(`${d}T00:00:00`);
  if (isNaN(date)) return "—";
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function compatColor(score) {
  if (!score) return { ring:"#a89c96", cls:"compat-none" };
  if (score >= 75) return { ring:"#23734c", cls:"compat-high" };
  if (score >= 55) return { ring:"#ffb51b", cls:"compat-mid" };
  return { ring:"#ef1725", cls:"compat-low" };
}

function compatPill(score, type) {
  if (type === "Direct Browse" || !score)
    return `<span class="compat-pill compat-none">No quiz score</span>`;
  const c = compatColor(score);
  return `<span class="compat-pill ${c.cls}"><i class="bi bi-cpu"></i>${score}%</span>`;
}

function can(action) {
  return hasPermission(
    currentRole,
    "adoption",
    action
  );
}


/* ══════════════════════════════════════════════════════
   STATS
══════════════════════════════════════════════════════ */
function renderStats() {
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  const pendingCount = adoptionApps.filter(a=>a.status==="Pending").length;
  set("statTotal",    adoptionApps.length);
  set("statPending",  pendingCount);
  set("heroPendingCount", pendingCount);
  set("statApproved", adoptionApps.filter(a=>a.status==="Approved").length);
  set("statFinalized",adoptionApps.filter(a=>a.status==="Finalized").length);
  set("statRejected", adoptionApps.filter(a=>a.status==="Rejected").length);
  set("statQuizMatch",adoptionApps.filter(a=>a.type==="Quiz Match").length);
}

/* ══════════════════════════════════════════════════════
   FILTER
══════════════════════════════════════════════════════ */
function applyFilters() {
  const q    = (document.getElementById("searchApps")?.value||"").toLowerCase().trim();
  const type = document.getElementById("filterType")?.value||"";

  // Check for ?animalId= URL param — pre-filter to that animal
  const urlAnimalId = new URLSearchParams(window.location.search).get("animalId");

  filtered = adoptionApps.filter(a => {
    if (activeTab !== "all" && a.status !== activeTab) return false;
    if (type && a.type !== type) return false;
    if (urlAnimalId && a.pet_id !== urlAnimalId) return false;
    if (q && !a.id.toLowerCase().includes(q) &&
        !a.adopter.name.toLowerCase().includes(q) &&
        !a.adopter.email.toLowerCase().includes(q) &&
        !a.animal.name.toLowerCase().includes(q)) return false;
    return true;
  });

  currentPage = 1;
  renderTable();
  renderPagination();
}

/* ══════════════════════════════════════════════════════
   TABLE
══════════════════════════════════════════════════════ */
function renderTable() {
  const tbody = document.getElementById("appsTableBody");
  if (!tbody) return;
  const start = (currentPage-1)*PAGE_SIZE;
  const page  = filtered.slice(start, start+PAGE_SIZE);

  if (!page.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">No applications found.</td></tr>`;
    return;
  }

  tbody.innerHTML = page.map(a => `
    <tr data-id="${a.id}" class="${a.id===activeAppId?"row-active":""}">
      <td class="app-id-cell">${a.applicationId}</td>
      <td>
        <div class="applicant-cell">
          <div class="applicant-avatar">${a.adopter.initials}</div>
          <div>
            <div class="applicant-name">${a.adopter.name}</div>
            <div class="applicant-email">${a.adopter.email}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="animal-mini">
          <div class="animal-mini-thumb ${thumbCls(a.animal.species)}">${emoji(a.animal.species)}</div>
          <div>
            <div class="animal-mini-name">${a.animal.name}</div>
            <div class="animal-mini-breed">${a.animal.breed}</div>
          </div>
        </div>
      </td>
      <td>
        <span class="app-type-badge ${a.type==="Quiz Match"?"type-quiz":"type-direct"}">
          <i class="bi ${a.type==="Quiz Match"?"bi-cpu":"bi-cursor"}"></i>${a.type}
        </span>
      </td>
      <td>${compatPill(a.compatScore, a.type)}</td>
      <td style="font-family:var(--mono);font-size:0.76rem;color:var(--stone)">${formatDate(a.submitted)}</td>
      <td>${statusBadge(a.status)}</td>
      <td>
        <button class="tbl-action-btn" data-action="view" data-id="${a.id}" title="View">
          <i class="bi bi-chevron-right"></i>
        </button>
      </td>
    </tr>`).join("");

  tbody.querySelectorAll("tr[data-id]").forEach(row => {
    row.addEventListener("click", e => {
      if (e.target.closest("[data-action]")) return;
      openDrawer(row.dataset.id);
    });
  });
  tbody.querySelectorAll("[data-action='view']").forEach(btn => {
    btn.addEventListener("click", e => { e.stopPropagation(); openDrawer(btn.dataset.id); });
  });
}

/* ══════════════════════════════════════════════════════
   PAGINATION
══════════════════════════════════════════════════════ */
function renderPagination() {
  const bar=document.getElementById("paginationBar"); if(!bar)return;
  const total=filtered.length, pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const start=Math.min((currentPage-1)*PAGE_SIZE+1,total), end=Math.min(currentPage*PAGE_SIZE,total);
  let h=`<span class="page-info">Showing ${total?start:0}–${end} of ${total}</span>`;
  h+=`<button class="page-btn" id="pagePrev" ${currentPage===1?"disabled":""}><i class="bi bi-chevron-left"></i></button>`;
  for(let i=1;i<=pages;i++) h+=`<button class="page-btn ${i===currentPage?"active":""}" data-page="${i}">${i}</button>`;
  h+=`<button class="page-btn" id="pageNext" ${currentPage===pages?"disabled":""}><i class="bi bi-chevron-right"></i></button>`;
  bar.innerHTML=h;
  bar.querySelector("#pagePrev")?.addEventListener("click",()=>{ if(currentPage>1){currentPage--;renderTable();renderPagination();} });
  bar.querySelector("#pageNext")?.addEventListener("click",()=>{ if(currentPage<pages){currentPage++;renderTable();renderPagination();} });
  bar.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>{currentPage=parseInt(b.dataset.page);renderTable();renderPagination();}));
}

/* ══════════════════════════════════════════════════════
   DRAWER
══════════════════════════════════════════════════════ */
function openDrawer(id) {
  const app = adoptionApps.find(a => a.id === id);
  if (!app) return;
  activeAppId = id;

  // Highlight active row
  document.querySelectorAll("tr[data-id]").forEach(r => r.classList.toggle("row-active", r.dataset.id === id));

  // Open drawer panel
  document.getElementById("aaLayout")?.classList.add("drawer-open");
  document.getElementById("aaDrawer")?.setAttribute("aria-hidden", "false");
  document.body.classList.add("management-drawer-open");

  renderDrawerContent(app);
}

function closeDrawer() {
  activeAppId = null;
  document.getElementById("aaLayout")?.classList.remove("drawer-open");
  document.getElementById("aaDrawer")?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("management-drawer-open");
  document.querySelectorAll("tr[data-id]").forEach(r => r.classList.remove("row-active"));
}

function renderDrawerContent(app) {
  const inner = document.getElementById("aaDrawerInner");
  if (!inner) return;

  const isQuiz = app.type === "Quiz Match";
  const cc     = compatColor(app.compatScore);

  // ── Compat section ───────────────────────────────────
  let compatSection = "";
  if (isQuiz && app.compatScore !== null) {
    const circumference = 2 * Math.PI * 30; // radius 30
    const offset = circumference - (app.compatScore / 100) * circumference;
    compatSection = `
      <div class="drawer-section">
        <div class="drawer-section-title"><i class="bi bi-cpu"></i> AI Compatibility Score</div>
        <div class="compat-ring-wrap">
          <div class="compat-ring">
            <svg viewBox="0 0 72 72">
              <circle class="compat-ring-track" cx="36" cy="36" r="30"/>
              <circle class="compat-ring-fill"
                cx="36" cy="36" r="30"
                stroke="${cc.ring}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${offset}"/>
            </svg>
            <div class="compat-ring-label">
              <span class="compat-ring-pct">${app.compatScore}%</span>
              <span class="compat-ring-sub">match</span>
            </div>
          </div>
          <div class="compat-ring-info">
            <h4>${app.compatScore >= 75 ? "Strong Match" : app.compatScore >= 55 ? "Good Match" : "Partial Match"}</h4>
            <p>Based on adopter quiz answers vs. ${app.animal.name}'s behavioral profile.</p>
          </div>
        </div>

        <div class="drawer-section-title mt-3"><i class="bi bi-sliders"></i> Trait Comparison</div>
        <div class="drawer-trait-bars">
          ${QUIZ_DIMENSIONS.map(d => {
            const petVal     = (app.animal.vector[QUIZ_DIMENSIONS.indexOf(d)]||0) * 20;
            const adopterVal = (app.adopterAnswers?.[d.key]||0) * 20;
            const diff       = Math.abs(petVal - adopterVal);
            const barColor   = diff <= 20 ? "#23734c" : diff <= 40 ? "#ffb51b" : "#ef1725";
            return `
              <div class="drawer-trait-row">
                <span class="drawer-trait-name">${d.label}</span>
                <div style="display:flex;flex-direction:column;gap:2px;flex:1">
                  <div class="drawer-trait-track" title="${app.animal.name}: ${Math.round(petVal)}%">
                    <div class="drawer-trait-fill" style="width:${petVal}%;background:#ef1725"></div>
                  </div>
                  <div class="drawer-trait-track" title="Adopter: ${Math.round(adopterVal)}%">
                    <div class="drawer-trait-fill" style="width:${adopterVal}%;background:${barColor}"></div>
                  </div>
                </div>
                <span class="drawer-trait-score" style="color:${barColor}">${diff <= 20?"≈":"≠"}</span>
              </div>`;
          }).join("")}
        </div>
        <div class="mt-2" style="font-size:0.72rem;color:var(--stone);display:flex;gap:12px">
          <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:4px;background:#ef1725;border-radius:2px"></span>Pet trait</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:4px;background:#23734c;border-radius:2px"></span>Adopter answer</span>
        </div>

        ${app.quizTopMatches ? `
        <div class="drawer-section-title mt-3"><i class="bi bi-list-ol"></i> Quiz Top Matches Shown</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${app.quizTopMatches.map((m,i) => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--cream);border-radius:9px;border:1px solid ${m.id===app.animal.id?"rgba(111,25,28,0.2)":"var(--border)"}">
              <span style="font-size:0.72rem;font-weight:700;color:var(--stone);min-width:16px">#${i+1}</span>
              <span>${emoji(m.species)}</span>
              <span style="font-size:0.84rem;font-weight:${m.id===app.animal.id?"800":"600"};color:${m.id===app.animal.id?"var(--clay)":"var(--ink)"}">
                ${m.name} ${m.id===app.animal.id?"← selected":""}
              </span>
              <span class="compat-pill ${compatColor(m.score).cls} ms-auto" style="font-size:0.72rem">${m.score}%</span>
            </div>`).join("")}
        </div>` : ""}
      </div>`;
  } else {
    compatSection = `
      <div class="drawer-section">
        <div class="drawer-section-title"><i class="bi bi-cursor"></i> Application Type</div>
        <div class="no-score-box">
          <i class="bi bi-search"></i>
          <p><strong>Direct Browse</strong> — The adopter manually selected ${app.animal.name} without taking the AI compatibility quiz. No compatibility score is available for this application.</p>
        </div>
      </div>`;
  }

  // ── Adopter info ─────────────────────────────────────
  const adopterSection = `
    <div class="drawer-section">
      <div class="drawer-section-title"><i class="bi bi-person-fill"></i> Adopter Information</div>
      <div class="drawer-info-grid">
        <div class="drawer-info-item drawer-info-full">
          <div class="drawer-info-lbl">Full Name</div>
          <div class="drawer-info-val">${app.adopter.name}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Email</div>
          <div class="drawer-info-val" style="font-size:0.78rem">${app.adopter.email}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Contact</div>
          <div class="drawer-info-val">${app.adopter.contact}</div>
        </div>
        <div class="drawer-info-item drawer-info-full">
          <div class="drawer-info-lbl">Address</div>
          <div class="drawer-info-val" style="font-size:0.82rem">${app.adopter.address}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">ID Type</div>
          <div class="drawer-info-val">${app.adopter.idType}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Occupation</div>
          <div class="drawer-info-val">${app.adopter.occupation}</div>
        </div>
      </div>
    </div>`;

  // ── Animal info ──────────────────────────────────────
  const animalSection = `
    <div class="drawer-section">
      <div class="drawer-section-title"><i class="bi bi-heart-pulse"></i> Animal Applied For</div>
      <div class="drawer-info-grid">
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Animal</div>
          <div class="drawer-info-val">${emoji(app.animal.species)} ${app.animal.name}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Species / Breed</div>
          <div class="drawer-info-val">${app.animal.species} · ${app.animal.breed}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Animal ID</div>
          <div class="drawer-info-val" style="font-family:var(--mono);font-size:0.78rem">${app.animal.id}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Submitted</div>
          <div class="drawer-info-val">${formatDate(app.submitted)}</div>
        </div>
      </div>
      <div class="mt-2">
        <a href="/pages/animalProfile.html?id=${app.animal.id}" target="_blank"
           style="font-size:0.82rem;color:var(--clay);font-weight:700;text-decoration:none">
          <i class="bi bi-arrow-up-right-square me-1"></i>View Animal Profile
        </a>
      </div>
    </div>`;



  // ── Rejection reason ─────────────────────────────────
  const rejectedSection = app.status === "Rejected" ? `
    <div class="drawer-section">
      <div class="drawer-section-title" style="color:var(--clay)"><i class="bi bi-x-circle-fill"></i> Rejection Reason</div>
      <div style="background:var(--clay-soft);border-radius:var(--radius-md);padding:14px 16px;font-size:0.84rem;color:var(--clay);line-height:1.55">
        ${app.rejectedReason || "No reason provided."}
      </div>
    </div>` : "";

  // ── Finalized info ────────────────────────────────────
  const finalizedSection = app.status === "Finalized" ? `
    <div class="drawer-section">
      <div class="drawer-section-title" style="color:var(--green)"><i class="bi bi-balloon-heart-fill"></i> Adoption Finalized</div>
      <div style="background:var(--green-soft);border-radius:var(--radius-md);padding:14px 16px">
        <div class="drawer-info-grid" style="background:transparent">
          <div class="drawer-info-item" style="background:rgba(255,255,255,0.6)"><div class="drawer-info-lbl">Adoption Date</div><div class="drawer-info-val">${formatDate(app.adoptionDate)}</div></div>
          <div class="drawer-info-item" style="background:rgba(255,255,255,0.6)"><div class="drawer-info-lbl">Adopter-Given Name</div><div class="drawer-info-val">${app.adoptedName||"—"}</div></div>
          <div class="drawer-info-item" style="background:rgba(255,255,255,0.6)"><div class="drawer-info-lbl">Processed By</div><div class="drawer-info-val">${app.processedBy||"—"}</div></div>
        </div>
      </div>
    </div>` : "";

  // ── Footer action buttons ─────────────────────────────
  let footerBtns = `<button class="btn-ghost-clay" id="drawerCloseBtn"><i class="bi bi-x"></i> Close</button>`;
  if (app.status === "Pending") {
  footerBtns += `
    ${
      can("reject")
        ? `<button class="btn-danger-outline" id="drawerRejectBtn">
            <i class="bi bi-x-lg"></i> Reject
          </button>`
        : ""
    }
    ${
      can("approve")
        ? `<button class="btn-approve-app" id="drawerApproveBtn">
            <i class="bi bi-check-lg"></i> Approve
          </button>`
        : ""
    }`;
}

if (app.status === "Approved") {
  footerBtns += `
    ${
      can("reject")
        ? `<button class="btn-danger-outline" id="drawerRejectBtn">
            <i class="bi bi-x-lg"></i> Reject
          </button>`
        : ""
    }
    ${
      can("finalize")
        ? `<button class="btn-finalize" id="drawerFinalizeBtn">
            <i class="bi bi-balloon-heart-fill"></i> Finalize Adoption
          </button>`
        : ""
    }`;
}

  // ── Assemble full drawer ──────────────────────────────
  inner.innerHTML = `
    <div class="drawer-header">
      <div class="drawer-header-left">
        <h3>Adoption Application Details</h3>
        <p>${app.applicationId} · Submitted ${formatDate(app.submitted)} · ${app.type}</p>
      </div>
      <button class="drawer-close-btn" id="drawerCloseX"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="drawer-body">
      <section class="application-journey" aria-label="Applicant and animal summary">
        <div class="journey-person">
          <span class="journey-avatar">${app.adopter.initials}</span>
          <span><small>Applicant</small><strong>${app.adopter.name}</strong></span>
        </div>
        <span class="journey-link"><i class="bi bi-arrow-right"></i><small>applied for</small></span>
        <div class="journey-animal">
          <span class="journey-avatar journey-pet">${emoji(app.animal.species)}</span>
          <span><small>Animal</small><strong>${app.animal.name}</strong></span>
        </div>
        <div class="journey-status">
          <small>Application Status</small>
          <strong>${statusBadge(app.status)}</strong>
        </div>
      </section>
      ${compatSection}
      ${adopterSection}
      ${animalSection}
      ${rejectedSection}
      ${finalizedSection}
    </div>
    <div class="drawer-footer">${footerBtns}</div>`;

  // Bind drawer buttons
  document.getElementById("drawerCloseX")?.addEventListener("click", closeDrawer);
  document.getElementById("drawerCloseBtn")?.addEventListener("click", closeDrawer);
  document.getElementById("drawerApproveBtn")?.addEventListener("click", () => approveApp(app.id));
  document.getElementById("drawerRejectBtn")?.addEventListener("click",  () => openRejectModal(app.id));
  document.getElementById("drawerFinalizeBtn")?.addEventListener("click",() => openFinalizeModal(app.id));
}

/* ══════════════════════════════════════════════════════
   ACTIONS
══════════════════════════════════════════════════════ */
async function approveApp(id) {
  if (!can("approve")) {
    showToast(
      "error",
      "You do not have permission to approve adoption applications."
    );
    return;
  }

  try {
    await approveAdoption(id);
    await loadAdoptions();

    const app = adoptionApps.find(a => a.id === id);
    if (app) renderDrawerContent(app);

    showToast("success", `Application ${id} approved.`);
  } catch (err) {
    console.error("[approveApp]", err);
    showToast("error", err.message || "Failed to approve application.");
  }
}

function openRejectModal(id) {
  if (!can("reject")) {
  showToast(
    "error",
    "You do not have permission to reject adoption applications."
  );
  return;
}
  const app = adoptionApps.find(a => a.id === id);
  if (!app) return;
  confirmMode = { type:"reject", id };
  document.getElementById("rejectConfirmMsg").textContent =
    `Reject application ${id} for ${app.adopter.name}?`;
  document.getElementById("rejectReason").value = "";
  document.getElementById("errRejectReason").textContent = "";
  openModal("rejectModalBackdrop");
}

async function executeReject() {
  if (!can("reject")) {
  showToast(
    "error",
    "You do not have permission to reject adoption applications."
  );
  return;
}
  const reason = document.getElementById("rejectReason")?.value.trim();
  if (!reason) {
    document.getElementById("errRejectReason").textContent = "A reason is required.";
    return;
  }

  try {
    await rejectAdoption(confirmMode.id, reason);
    closeModal("rejectModalBackdrop");
    await loadAdoptions();

    const app = adoptionApps.find(a => a.id === confirmMode.id);
    if (app) renderDrawerContent(app);

    showToast("info", `Application ${confirmMode.id} rejected.`);
  } catch (err) {
    console.error("[executeReject]", err);
    showToast("error", err.message || "Failed to reject application.");
  }
}

function openFinalizeModal(id) {
  const app = adoptionApps.find(a => a.id === id);
  if (!app) return;
  confirmMode = { type:"finalize", id };
  document.getElementById("finalizeMsg").textContent =
    `Confirm adoption of ${app.animal.name} by ${app.adopter.name}? This will mark the animal as Adopted.`;
  document.getElementById("fAdoptionDate").value  = new Date().toISOString().split("T")[0];
  document.getElementById("fAdoptionStaff").value = getUserName() || "";
  document.getElementById("fAdoptedName").value = "";
  document.getElementById("errAdoptedName").textContent = "";
  openModal("finalizeModalBackdrop");
}

async function executeFinalize() {
  if (!can("finalize")) {
  showToast(
    "error",
    "You do not have permission to finalize adoptions."
  );
  return;
}
  const adoptedName =
    document.getElementById("fAdoptedName").value.trim();
  if (adoptedName.length < 2) {
    document.getElementById("errAdoptedName").textContent =
      "Enter the name chosen by the adopter.";
    return;
  }

  try {
    await finalizeAdoption(confirmMode.id, {
      adoptionDate: document.getElementById("fAdoptionDate").value,
      processedBy: document.getElementById("fAdoptionStaff").value.trim() || getUserName() || "Staff",
      adoptedName,
    });

    closeModal("finalizeModalBackdrop");
    await loadAdoptions();

    const app = adoptionApps.find(a => a.id === confirmMode.id);
    if (app) renderDrawerContent(app);

    showToast("success", "🎉 Adoption finalized.");
  } catch (err) {
    console.error("[executeFinalize]", err);
    showToast("error", err.message || "Failed to finalize adoption.");
  }
}

/* ══════════════════════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════════════════════ */
function openModal(id)  { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }

/* ══════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════ */
let toastT;
function showToast(type, msg) {
  const t=document.getElementById("umToast"),i=document.getElementById("toastIcon"),m=document.getElementById("toastMsg"); if(!t)return;
  const icons={success:"bi-check-circle-fill",error:"bi-x-circle-fill",info:"bi-info-circle-fill",warning:"bi-exclamation-triangle-fill"};
  t.className=`um-toast toast-${type}`; i.className=`bi ${icons[type]||"bi-info-circle-fill"}`; m.textContent=msg;
  t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),3500);
}


/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */
async function init() {
  try {
    const session = await protectPageByModule("adoption");
    currentRole = session.role;
    renderTopbarUser(); // ← topbar first so #sidebarToggle exists
    loadSidebar();
    await loadAdoptions();

    // URL param: open drawer to specific animal's apps
    const urlAnimalId = new URLSearchParams(window.location.search).get("animalId");
    if (urlAnimalId) {
      const first = adoptionApps.find(a => a.pet_id === urlAnimalId);
      if (first) setTimeout(() => openDrawer(first.id), 200);
    }

    // Tabs
    document.querySelectorAll(".aa-tab").forEach(btn => {
      btn.addEventListener("click",()=>{
        document.querySelectorAll(".aa-tab").forEach(t=>t.classList.remove("active"));
        btn.classList.add("active"); activeTab=btn.dataset.tab; applyFilters();
      });
    });

    document.getElementById("searchApps")?.addEventListener("input",  applyFilters);
    document.getElementById("filterType")?.addEventListener("change", applyFilters);
    document.getElementById("aaDrawerBackdrop")?.addEventListener("click", closeDrawer);

    // Reject modal
    document.getElementById("rejectModalClose")?.addEventListener("click",  ()=>closeModal("rejectModalBackdrop"));
    document.getElementById("rejectModalCancel")?.addEventListener("click", ()=>closeModal("rejectModalBackdrop"));
    document.getElementById("rejectConfirmBtn")?.addEventListener("click",  executeReject);

    // Finalize modal
    document.getElementById("finalizeModalClose")?.addEventListener("click",  ()=>closeModal("finalizeModalBackdrop"));
    document.getElementById("finalizeModalCancel")?.addEventListener("click", ()=>closeModal("finalizeModalBackdrop"));
    document.getElementById("finalizeConfirmBtn")?.addEventListener("click",  executeFinalize);

    // Backdrop click to close modals
    ["rejectModalBackdrop","finalizeModalBackdrop"].forEach(id=>{
      document.getElementById(id)?.addEventListener("click",e=>{if(e.target.id===id)closeModal(id);});
    });

    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      const hasOpenModal = document.querySelector(".um-modal-backdrop.open");
      if (hasOpenModal) {
        closeModal("rejectModalBackdrop");
        closeModal("finalizeModalBackdrop");
      } else {
        closeDrawer();
      }
    });

    document.body.classList.remove("loading");
  } catch(err) {
    console.error("Adoption Apps init failed:", err);
    document.body.classList.remove("loading");
  }
}

window.addEventListener("DOMContentLoaded", init);
