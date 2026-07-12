// admin-frontend/src/management/surrenderRequests.js
import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../css/surrenderRequests.css";

import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser }      from "../components/management/topbarUser.js";
import { loadSidebar }           from "../components/management/sidebarLoader.js";
import { getUserName }           from "../utils/storage.js";

const SURRENDER_REQUESTS_API_URL =
  "http://localhost:5000/api/surrenders";


async function getPublicSubmittedRequests() {
  try {
    const token = localStorage.getItem("animua_token");

    const response = await fetch(SURRENDER_REQUESTS_API_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch surrender requests from backend.");
    }

    const savedRequests = data.requests || [];

    return savedRequests.map((request, index) => {
      const ownerName = request.owner?.name || "Unknown Owner";
      const petName = request.pet?.name || "Unnamed Pet";
      const species = request.pet?.species || "Dog";

      return {
        id: request.id || `SR-PUBLIC-${String(index + 1).padStart(3, "0")}`,
        status: request.status || "Pending",
        submittedAt: request.submittedAt || new Date().toISOString().split("T")[0],

        owner: {
          name: ownerName,
          contact: request.owner?.contact || "—",
          address: request.owner?.address || "—",
          barangay: request.owner?.barangay || "Not specified",
          idType: "Online Account",
          color: "#6f191c",
          initials: ownerName
            .split(" ")
            .map(name => name[0])
            .join("")
            .toUpperCase()
            .slice(0, 2),
        },

        pet: {
          name: petName,
          species: species,
          breed: request.pet?.breed || "Not specified",
          age: request.pet?.age || "Not specified",
          sex: request.pet?.sex || "Not specified",
        },

        surrenderReason: request.surrenderReason || "No reason provided.",

        agreement: request.agreement || null,

        nlp: {
          sentiment: request.nlp?.sentiment || "Neutral",
          category: request.nlp?.category || "Other",
          urgencyLabel: request.nlp?.urgencyLabel || "Low",
          urgencyScore: request.nlp?.urgencyScore || 20,
          confidence: request.nlp?.confidence || 0.5,
          keywords: request.nlp?.keywords || [],
          suggestedPriority: request.nlp?.suggestedPriority || "Normal Priority",
          source: request.nlp?.source || "TF-IDF + Logistic Regression",
        },

        documents: [
          {
            name: "Online surrender form",
            status: "submitted",
          },
          {
            name: "Agreement and consent",
            status: request.agreement?.agreedToTerms ? "submitted" : "missing",
          },
        ],

        docsSubmitted: request.agreement?.agreedToTerms ? 2 : 1,
        totalDocs: 2,

        reviewedBy: request.reviewedBy || null,
        reviewedAt: request.reviewedAt || null,
        reviewNotes: request.reviewNotes || null,
        rejectedReason: request.rejectedReason || null,
        intakeId: request.intakeId || null,
        dropoffDate: request.dropoffDate || null,

        source: request.source || "Public Form",
      };
    });
  } catch (error) {
    console.error("Failed to load surrender requests from backend:", error);
    return [];
  }
}
/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
let publicRequests = [];
let allRequests = [];

let filtered = [];
let currentPage = 1;
const PAGE_SIZE = 8;
let activeTab   = "all";
let activeId    = null;
let confirmMode = null;

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
const emoji = s => ({Dog:"🐶",Cat:"🐱",Rabbit:"🐰",Bird:"🐦"}[s]||"🐾");
const thumbCls = s => ({Dog:"thumb-dog",Cat:"thumb-cat"}[s]||"thumb-other");

function formatDate(d) {
  if (!d) return "—";
  return new Date(d+"T00:00:00").toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"});
}

function urgencyCls(u) {
  return { Critical:"urgency-critical", High:"urgency-high", Medium:"urgency-medium", Low:"urgency-low" }[u] || "urgency-low";
}

function statusBadge(s) {
  const m = { Pending:{cls:"badge-pending"}, Approved:{cls:"badge-approved"}, Converted:{cls:"badge-converted"}, Rejected:{cls:"badge-rejected"} }[s] || {cls:"badge-pending"};
  return `<span class="status-badge ${m.cls}">${s}</span>`;
}

const CAT_CSS = {
  Medical:"cat-medical", Financial:"cat-financial", Relocation:"cat-relocation",
  Behavioral:"cat-behavioral", Overcrowding:"cat-overcrowding",
  "Abandonment Risk":"cat-abandonment", "Owner Incapacity":"cat-incapacity", Other:"cat-other",
};
const CAT_ICONS = {
  Medical:"bi-heart-pulse-fill", Financial:"bi-cash-coin", Relocation:"bi-geo-alt-fill",
  Behavioral:"bi-exclamation-diamond-fill", Overcrowding:"bi-collection-fill",
  "Abandonment Risk":"bi-exclamation-triangle-fill", "Owner Incapacity":"bi-person-wheelchair", Other:"bi-three-dots",
};

function catBadge(cat) {
  const cls = CAT_CSS[cat]||"cat-other", icon = CAT_ICONS[cat]||"bi-three-dots";
  return `<span class="nlp-cat-badge ${cls}"><i class="bi ${icon}"></i>${cat}</span>`;
}

const URGENCY_FILL = { Critical:"fill-critical", High:"fill-high", Medium:"fill-medium", Low:"fill-low" };
const URGENCY_PCT  = { Critical:95, High:75, Medium:50, Low:25 };

/* ══════════════════════════════════════════════════════
   STATS
══════════════════════════════════════════════════════ */
function renderStats() {
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set("statTotal", allRequests.length);
  set("statPending", allRequests.filter(r => r.status === "Pending").length);
  set("statCritical", allRequests.filter(r => r.nlp.urgencyLabel === "Critical").length);
  set("statApproved", allRequests.filter(r => r.status === "Approved").length);
  set("statConverted", allRequests.filter(r => r.status === "Converted").length);
  set("statRejected", allRequests.filter(r => r.status === "Rejected").length);
}

/* ══════════════════════════════════════════════════════
   FILTER
══════════════════════════════════════════════════════ */
function applyFilters() {
  const q    = (document.getElementById("searchSR")?.value||"").toLowerCase().trim();
  const urg  = document.getElementById("filterUrgency")?.value||"";
  const cat  = document.getElementById("filterCategory")?.value||"";

  filtered = allRequests.filter(r => {
    if (activeTab !== "all" && r.status !== activeTab) return false;
    if (urg && r.nlp.urgencyLabel !== urg)  return false;
    if (cat && r.nlp.category     !== cat)  return false;
    if (q && !r.id.toLowerCase().includes(q) &&
        !r.owner.name.toLowerCase().includes(q) &&
        !r.pet.name.toLowerCase().includes(q)   &&
        !r.owner.barangay.toLowerCase().includes(q)) return false;
    return true;
  });

  // Sort: Critical first, then High, then by date desc
  const urgOrder = { Critical:0, High:1, Medium:2, Low:3 };
  filtered.sort((a,b) => {
    const ud = (urgOrder[a.nlp.urgencyLabel]||3) - (urgOrder[b.nlp.urgencyLabel]||3);
    if (ud !== 0) return ud;
    return new Date(b.submittedAt) - new Date(a.submittedAt);
  });

  currentPage = 1;
  renderTable();
  renderPagination();
}

/* ══════════════════════════════════════════════════════
   TABLE
══════════════════════════════════════════════════════ */
function renderTable() {
  const tbody = document.getElementById("srTableBody");
  if (!tbody) return;
  const start = (currentPage-1)*PAGE_SIZE;
  const page  = filtered.slice(start, start+PAGE_SIZE);

  if (!page.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">No surrender requests found.</td></tr>`;
    return;
  }

  tbody.innerHTML = page.map(r => `
    <tr data-id="${r.id}" class="${r.id===activeId?"row-active":""}">
      <td style="font-family:var(--mono);font-size:0.76rem;color:var(--stone)">${r.id}</td>
      <td>
        <div class="owner-cell">
          <div class="owner-avatar" style="background:${r.owner.color}">${r.owner.initials}</div>
          <div>
            <div class="owner-name">${r.owner.name}</div>
            <div class="owner-barangay"><i class="bi bi-geo-alt-fill" style="color:var(--clay);font-size:0.65rem"></i> Brgy. ${r.owner.barangay}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="pet-mini">
          <div class="pet-mini-thumb ${thumbCls(r.pet.species)}">${emoji(r.pet.species)}</div>
          <div>
            <div class="pet-mini-name">${r.pet.name}</div>
            <div class="pet-mini-breed">${r.pet.breed} · ${r.pet.sex}</div>
          </div>
        </div>
      </td>
      <td>${catBadge(r.nlp.category)}</td>
      <td><span class="urgency-badge ${urgencyCls(r.nlp.urgencyLabel)}">${r.nlp.urgencyLabel}</span></td>
      <td style="font-family:var(--mono);font-size:0.76rem;color:var(--stone)">${formatDate(r.submittedAt)}</td>
      <td>${statusBadge(r.status)}</td>
      <td>
        <button class="tbl-action-btn" data-action="view" data-id="${r.id}" title="View">
          <i class="bi bi-chevron-right"></i>
        </button>
      </td>
    </tr>`).join("");

  tbody.querySelectorAll("tr[data-id]").forEach(row => {
    row.addEventListener("click", e => { if(e.target.closest("[data-action]"))return; openDrawer(row.dataset.id); });
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
  bar.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>{ currentPage=parseInt(b.dataset.page);renderTable();renderPagination(); }));
}

/* ══════════════════════════════════════════════════════
   DRAWER
══════════════════════════════════════════════════════ */
function openDrawer(id) {
  const r = allRequests.find(x => x.id === id);
  if (!r) return;
  activeId = id;
  document.querySelectorAll("tr[data-id]").forEach(row => row.classList.toggle("row-active", row.dataset.id === id));
  document.getElementById("srLayout")?.classList.add("drawer-open");
  renderDrawer(r);
}

function closeDrawer() {
  activeId = null;
  document.getElementById("srLayout")?.classList.remove("drawer-open");
  document.querySelectorAll("tr[data-id]").forEach(r => r.classList.remove("row-active"));
}

function renderDrawer(r) {
  const inner = document.getElementById("srDrawerInner");
  if (!inner) return;

  const pct  = URGENCY_PCT[r.nlp.urgencyLabel] || 25;
  const fill = URGENCY_FILL[r.nlp.urgencyLabel] || "fill-low";
  const confPct = Math.round(r.nlp.confidence * 100);

  // ── NLP analysis section ─────────────────────────────
  const nlpSection = `
    <div class="drawer-section">
      <div class="drawer-section-title"><i class="bi bi-cpu"></i> Sentiment Analysis</div>
      <div class="nlp-analysis-card">
        <div class="nlp-analysis-header">
          <span class="nlp-chip"><i class="bi bi-cpu-fill"></i> NLP Classified</span>
          <span style="font-size:0.75rem;color:var(--stone)">
            ${r.nlp.source || "TF-IDF + Logistic Regression"}
          </span>
        </div>
        <div class="nlp-category-row">
          <div>
            <div style="font-size:0.72rem;font-weight:700;color:var(--stone);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.06em">Category</div>
            ${catBadge(r.nlp.category)}
          </div>
          <div class="nlp-confidence">Confidence: <span>${confPct}%</span></div>
        </div>
        <div style="margin-top:10px">
        <div style="font-size:0.72rem;font-weight:700;color:var(--stone);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em">
          Sentiment Result
        </div>

        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="nlp-cat-badge cat-other">
            <i class="bi bi-chat-heart-fill"></i>
            ${r.nlp.sentiment || "Neutral"}
          </span>

          <span style="font-size:0.75rem;color:var(--stone)">
            ${r.nlp.confidence < 0.5
              ? "Low confidence — needs staff review"
              : `Suggested Priority: ${r.nlp.suggestedPriority || "Normal Priority"}`}
          </span>
        </div>
      </div>
        <div>
          <div style="font-size:0.72rem;font-weight:700;color:var(--stone);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em">Urgency Level</div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span class="urgency-badge ${urgencyCls(r.nlp.urgencyLabel)}">${r.nlp.urgencyLabel}</span>
            <span style="font-size:0.75rem;color:var(--stone);font-family:var(--mono)">Score: ${r.nlp.urgencyScore}/100</span>
          </div>
          <div class="urgency-meter">
            <div class="urgency-meter-track">
              <div class="urgency-meter-fill ${fill}" style="width:${pct}%"></div>
            </div>
          </div>
        </div>
        ${r.nlp.keywords.length ? `
        <div style="margin-top:10px">
          <div style="font-size:0.72rem;font-weight:700;color:var(--stone);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em">Detected Keywords</div>
          <div class="reason-keywords">
            ${r.nlp.keywords.map(k=>`<span class="keyword-tag">${k}</span>`).join("")}
          </div>
        </div>` : ""}
      </div>

      <div style="font-size:0.72rem;font-weight:700;color:var(--stone);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em">Surrender Reason (Owner's Words)</div>
      <div class="reason-box">"${r.surrenderReason}"</div>
    </div>`;

  // ── Owner section ─────────────────────────────────────
  const ownerSection = `
    <div class="drawer-section">
      <div class="drawer-section-title"><i class="bi bi-person-fill"></i> Owner Information</div>
      <div class="drawer-info-grid">
        <div class="drawer-info-item drawer-info-full">
          <div class="drawer-info-lbl">Full Name</div>
          <div class="drawer-info-val">${r.owner.name}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Contact</div>
          <div class="drawer-info-val">${r.owner.contact}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">ID Type</div>
          <div class="drawer-info-val">${r.owner.idType}</div>
        </div>
        <div class="drawer-info-item drawer-info-full">
          <div class="drawer-info-lbl">Address</div>
          <div class="drawer-info-val" style="font-size:0.82rem">${r.owner.address}, Brgy. ${r.owner.barangay}, Angeles City</div>
        </div>
        <div class="drawer-info-item drawer-info-full">
          <div class="drawer-info-lbl">Residency Verification</div>
          <div class="drawer-info-val" style="display:flex;align-items:center;gap:7px">
            <i class="bi bi-check-circle-fill" style="color:var(--green)"></i>
            <span style="color:var(--green);font-weight:700">Angeles City Resident</span>
            <span style="font-size:0.75rem;color:var(--stone)">(Barangay verified)</span>
          </div>
        </div>
      </div>
    </div>`;

  // ── Pet section ───────────────────────────────────────
  const petSection = `
    <div class="drawer-section">
      <div class="drawer-section-title"><i class="bi bi-heart-pulse"></i> Pet Information</div>
      <div class="drawer-info-grid">
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Pet Name</div>
          <div class="drawer-info-val">${emoji(r.pet.species)} ${r.pet.name}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Species</div>
          <div class="drawer-info-val">${r.pet.species}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Breed</div>
          <div class="drawer-info-val">${r.pet.breed}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Sex / Age</div>
          <div class="drawer-info-val">${r.pet.sex} · ${r.pet.age}</div>
        </div>
      </div>
    </div>`;

  // ── Documents section ─────────────────────────────────
  const docsSection = `
    <div class="drawer-section">
      <div class="drawer-section-title"><i class="bi bi-folder-fill"></i> Documents (${r.docsSubmitted}/${r.totalDocs})</div>
      <div class="doc-list">
        ${r.documents.map(d => {
          const isOk  = d.status==="submitted";
          const isPend= d.status==="pending";
          const iconCls = isOk?"bi-check doc-ok":isPend?"bi-hourglass-split doc-pending":"bi-x doc-missing";
          const label   = isOk?"Submitted":isPend?"Pending":"Not submitted";
          return `
            <div class="doc-item">
              <div class="doc-icon"><i class="bi bi-file-earmark-text"></i></div>
              <span class="doc-name">${d.name}</span>
              <span class="doc-status ${isOk?"doc-ok":isPend?"doc-pending":"doc-missing"}">
                <i class="bi ${isOk?"bi-check-circle-fill":isPend?"bi-hourglass-split":"bi-x-circle"}"></i> ${label}
              </span>
            </div>`;
        }).join("")}
      </div>
    </div>`;

  // ── Status-specific sections ──────────────────────────
  let statusSection = "";
  if (r.status === "Rejected") {
    statusSection = `
      <div class="drawer-section">
        <div class="drawer-section-title" style="color:var(--clay)"><i class="bi bi-x-circle-fill"></i> Rejection</div>
        <div class="info-banner banner-rejected">${r.rejectedReason}</div>
      </div>`;
  }
  if (r.status === "Approved") {
    statusSection = `
      <div class="drawer-section">
        <div class="drawer-section-title" style="color:var(--blue)"><i class="bi bi-check-circle-fill"></i> Approval</div>
        <div class="info-banner banner-approved">
          <strong>Approved by ${r.reviewedBy}</strong> on ${formatDate(r.reviewedAt)}
          ${r.reviewNotes ? `<div class="mt-1" style="font-size:0.82rem">${r.reviewNotes}</div>` : ""}
        </div>
      </div>`;
  }
  if (r.status === "Converted") {
    statusSection = `
      <div class="drawer-section">
        <div class="drawer-section-title" style="color:var(--green)"><i class="bi bi-arrow-right-circle-fill"></i> Converted to Intake</div>
        <div class="info-banner banner-converted">
          <strong>Intake record created: ${r.intakeId}</strong>
          <div class="mt-1" style="font-size:0.82rem">Scheduled drop-off: ${formatDate(r.dropoffDate)}</div>
        </div>
      </div>`;
  }

  // ── Footer buttons ────────────────────────────────────
  let footerBtns = `<button class="btn-ghost-clay" id="drawerCloseBtn"><i class="bi bi-x"></i> Close</button>`;
  if (r.status === "Pending") {
    footerBtns += `
      <button class="btn-danger-outline" id="drawerRejectBtn"><i class="bi bi-x-lg"></i> Reject</button>
      <button class="btn-approve-confirm" id="drawerApproveBtn"><i class="bi bi-check-lg"></i> Approve</button>`;
  }
    if (r.status === "Approved") {
    footerBtns += `
      <button class="btn-ghost-clay" disabled>
        <i class="bi bi-info-circle"></i> Waiting for intake submission
      </button>`;
  }

  inner.innerHTML = `
    <div class="drawer-header">
      <div class="drawer-header-left">
        <h3>${r.id}</h3>
        <p>
        ${r.owner.name} · ${emoji(r.pet.species)} ${r.pet.name} · ${statusBadge(r.status)}
        ${r.source ? ` · <span style="color:var(--stone);font-size:0.78rem">${r.source}</span>` : ""}
      </p>
      </div>
      <button class="drawer-close-btn" id="drawerCloseX"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="drawer-body">
      ${nlpSection}
      ${ownerSection}
      ${petSection}
      ${docsSection}
      ${statusSection}
    </div>
    <div class="drawer-footer">${footerBtns}</div>`;

  document.getElementById("drawerCloseX")?.addEventListener("click",   closeDrawer);
  document.getElementById("drawerCloseBtn")?.addEventListener("click",  closeDrawer);
  document.getElementById("drawerApproveBtn")?.addEventListener("click",()=> openApproveModal(r.id));
  document.getElementById("drawerRejectBtn")?.addEventListener("click", ()=> openRejectModal(r.id));
  //document.getElementById("drawerConvertBtn")?.addEventListener("click",()=> openConvertModal(r.id));
}

async function updateSurrenderStatusInBackend(id, payload) {
  const token = localStorage.getItem("animua_token");

  const response = await fetch(`http://localhost:5000/api/surrenders/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update surrender request.");
  }

  return data.request;
}

/* ══════════════════════════════════════════════════════
   ACTIONS
══════════════════════════════════════════════════════ */
// Approve
function openApproveModal(id) {
  const r = allRequests.find(x => x.id === id)
  if (!r) return;
  confirmMode = { type:"approve", id };
  document.getElementById("approveConfirmMsg").textContent =
    `Approve surrender request ${id} from ${r.owner.name} for ${r.pet.name}?`;
  document.getElementById("approveNotes").value = "";
  openModal("approveModalBackdrop");
}
async function executeApprove() {
  const r = allRequests.find(x => x.id === confirmMode.id);

  if (!r) return;

  try {
    const reviewNotes = document.getElementById("approveNotes").value.trim() || null;

    const updatedRequest = await updateSurrenderStatusInBackend(r.id, {
      status: "Approved",
      reviewNotes,
    });

    Object.assign(r, updatedRequest);

    sessionStorage.setItem(
      "approved_surrender_for_intake",
      JSON.stringify({
        surrenderId: r.id,
        ownerName: r.owner?.name || "",
        ownerContact: r.owner?.contact || "",
        approvedDate: new Date().toISOString().split("T")[0],

        petName: r.pet?.name || "",
        species: r.pet?.species || "",
        breed: r.pet?.breed || "",
        sex: r.pet?.sex || "",
        age: r.pet?.age || "",
        colorMarkings: r.pet?.colorMarkings || "",
        vaccinationHistory: r.pet?.vaccinationHistory || "",
        surrenderReason: r.surrenderReason || "",
      })
    );

    closeModal("approveModalBackdrop");

    showToast("success", `Request ${r.id} approved. Redirecting to Animal Intake...`);

    setTimeout(() => {
      window.location.href = "/pages/intakeList.html?source=surrender";
    }, 900);

  } catch (error) {
    console.error("Approve surrender request error:", error);
    showToast("error", error.message || "Failed to approve request.");
  }
}

// Reject
function openRejectModal(id) {
  const r = allRequests.find(x=>x.id===id);
  if (!r) return;
  confirmMode = { type:"reject", id };
  document.getElementById("rejectConfirmMsg").textContent =
    `Reject surrender request ${id} from ${r.owner.name}?`;
  document.getElementById("rejectReason").value = "";
  document.getElementById("errRejectReason").textContent = "";
  openModal("rejectModalBackdrop");
}
async function executeReject() {
  const reason = document.getElementById("rejectReason")?.value.trim();

  if (!reason) {
    document.getElementById("errRejectReason").textContent = "A reason is required.";
    return;
  }

  const r = allRequests.find(x => x.id === confirmMode.id);

  if (!r) return;

  try {
    const updatedRequest = await updateSurrenderStatusInBackend(r.id, {
      status: "Rejected",
      rejectedReason: reason,
    });

    Object.assign(r, updatedRequest);

    closeModal("rejectModalBackdrop");
    renderStats();
    applyFilters();
    renderDrawer(r);

    showToast("info", `Request ${r.id} rejected.`);
  } catch (error) {
    console.error("Reject surrender request error:", error);
    showToast("error", error.message || "Failed to reject request.");
  }
}

// Convert to intake
function openConvertModal(id) {
  const r = allRequests.find(x=>x.id===id);
  if (!r) return;
  confirmMode = { type:"convert", id };
  document.getElementById("convertConfirmMsg").textContent =
    `Convert ${r.id} (${r.pet.name} from ${r.owner.name}) to a formal Intake record?`;
  document.getElementById("fDropoffDate").value = new Date().toISOString().split("T")[0];
  openModal("convertModalBackdrop");
}
async function executeConvert() {
  const r = allRequests.find(x => x.id === confirmMode.id);

  if (!r) return;

  try {
    const dropoffDate = document.getElementById("fDropoffDate").value;

    const updatedRequest = await updateSurrenderStatusInBackend(r.id, {
      status: "Converted",
      dropoffDate,
    });

    Object.assign(r, updatedRequest);

    closeModal("convertModalBackdrop");
    renderStats();
    applyFilters();
    renderDrawer(r);

    showToast("success", `Intake record ${r.intakeId} created from ${r.id}.`);
  } catch (error) {
    console.error("Convert surrender request error:", error);
    showToast("error", error.message || "Failed to convert request.");
  }
}

/* ══════════════════════════════════════════════════════
   MODAL / TOAST / SIDEBAR
══════════════════════════════════════════════════════ */
function openModal(id)  { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }
function closeAllModals() {
  ["rejectModalBackdrop","approveModalBackdrop","convertModalBackdrop"].forEach(closeModal);
}

let toastT;
function showToast(type,msg) {
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
    await protectManagementPage();
    renderTopbarUser();
    loadSidebar(); 

    publicRequests = await getPublicSubmittedRequests();

    if (!Array.isArray(publicRequests)) {
      console.warn("Public requests was not an array. Resetting to empty array.", publicRequests);
      publicRequests = [];
    }

    allRequests = [...publicRequests];
    filtered = [...allRequests];

    renderStats();
    applyFilters();

    // Tabs
    document.querySelectorAll(".sr-tab").forEach(btn => {
      btn.addEventListener("click",()=>{
        document.querySelectorAll(".sr-tab").forEach(t=>t.classList.remove("active"));
        btn.classList.add("active"); activeTab=btn.dataset.tab; applyFilters();
      });
    });

    document.getElementById("searchSR")?.addEventListener("input",      applyFilters);
    document.getElementById("filterUrgency")?.addEventListener("change", applyFilters);
    document.getElementById("filterCategory")?.addEventListener("change",applyFilters);

    // Reject modal
    document.getElementById("rejectModalClose")?.addEventListener("click",  ()=>closeModal("rejectModalBackdrop"));
    document.getElementById("rejectModalCancel")?.addEventListener("click", ()=>closeModal("rejectModalBackdrop"));
    document.getElementById("rejectConfirmBtn")?.addEventListener("click",  executeReject);

    // Approve modal
    document.getElementById("approveModalClose")?.addEventListener("click",  ()=>closeModal("approveModalBackdrop"));
    document.getElementById("approveModalCancel")?.addEventListener("click", ()=>closeModal("approveModalBackdrop"));
    document.getElementById("approveConfirmBtn")?.addEventListener("click",  executeApprove);

    // Convert modal
    document.getElementById("convertModalClose")?.addEventListener("click",  ()=>closeModal("convertModalBackdrop"));
    document.getElementById("convertModalCancel")?.addEventListener("click", ()=>closeModal("convertModalBackdrop"));
    document.getElementById("convertConfirmBtn")?.addEventListener("click",  executeConvert);

    // Backdrop click
    ["rejectModalBackdrop","approveModalBackdrop","convertModalBackdrop"].forEach(id=>{
      document.getElementById(id)?.addEventListener("click",e=>{if(e.target.id===id)closeModal(id);});
    });

    document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeAllModals(); });

    document.body.classList.remove("loading");
  } catch(err) {
    console.error("Surrender Requests init failed:", err);
    document.body.classList.remove("loading");
  }
}

window.addEventListener("DOMContentLoaded", init);