// admin-frontend/src/management/surrenderRequests.js
import "../css/surrenderRequests.css";
import "../css/managementTables.css";
import "../css/recordsWorkspace.css";
import "../css/recordsPanelReference.css";
import "../css/reviewQueueRecords.css";
import { renderPageHeader } from "../components/management/pageHeader.js";
import { PAGE_HEADER_CONFIGS } from "../components/management/pageHeaderConfigs.js";

import { protectPageByModule } from "../auth/authGuard.js";
import { hasPermission } from "../auth/permissions.js";
import { renderTopbarUser }      from "../components/management/topbarUser.js";
import { loadSidebar, navigateManagementPage } from "../components/management/sidebarLoader.js";
import { getUserName }           from "../utils/storage.js";
import { API_BASE_URL }          from "../utils/api.js";
import { compareSurrenderUrgency } from "./surrenderRequestSorting.js";
import { installManagementImageFallbacks } from "../utils/image.js";

renderPageHeader(PAGE_HEADER_CONFIGS.surrenders);

const SURRENDER_REQUESTS_API_URL =
  `${API_BASE_URL}/surrenders`;
const SURRENDER_AVAILABILITY_API_URL =
  `${SURRENDER_REQUESTS_API_URL}/availability`;


async function getPublicSubmittedRequests() {
  try {
    const response = await fetch(SURRENDER_REQUESTS_API_URL, {
      method: "GET",
      credentials: "include",
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
        createdAt: request.createdAt || request.submittedAt || null,
        updatedAt: request.updatedAt || null,

        owner: {
          name: ownerName,
          email: request.owner?.email || request.account?.email || "—",
          contact: request.owner?.contact || "—",
          address: request.owner?.address || "—",
          barangay: request.owner?.barangay || "Not specified",
          city: request.owner?.city || "Angeles City",
          isAngelesResident: request.owner?.isAngelesResident === true,
          identityDocuments: {
            front: request.owner?.identityDocuments?.front || null,
            back: request.owner?.identityDocuments?.back || null,
          },
          idType: "Online Account",
          color: "#780116",
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
          colorMarkings: request.pet?.colorMarkings || "Not specified",
          status: Array.isArray(request.pet?.status) ? request.pet.status : [],
          vaccinationHistory: request.pet?.vaccinationHistory || "Not specified",
          photoName: request.pet?.photoName || "",
          photoType: request.pet?.photoType || "",
          photoDataUrl: request.pet?.photoDataUrl || "",
        },

        surrenderReason: request.surrenderReason || "No reason provided.",

        agreement: request.agreement || null,

        account: {
          email: request.account?.email || request.owner?.email || "—",
          role: request.account?.role || "Public",
        },

        nlp: {
          sentiment: request.nlp?.sentiment || "Neutral",
          category: request.nlp?.category || "Other",
          urgencyLabel: request.nlp?.urgencyLabel || "Low",
          urgencyScore: request.nlp?.urgencyScore ?? 20,
          confidence: request.nlp?.categoryConfidence ?? request.nlp?.confidence ?? 0.5,
          sentimentConfidence: request.nlp?.sentimentConfidence ?? null,
          categoryConfidence: request.nlp?.categoryConfidence ?? request.nlp?.confidence ?? 0.5,
          modelCategory: request.nlp?.modelCategory || request.nlp?.category || "Other",
          categoryAdjusted: request.nlp?.categoryAdjusted === true,
          categoryAdjustmentReason: request.nlp?.categoryAdjustmentReason || "",
          rulesVersion: request.nlp?.rulesVersion || "",
          keywords: Array.isArray(request.nlp?.keywords) ? request.nlp.keywords : [],
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
          {
            name: "Animal photo",
            status: request.pet?.photoDataUrl ? "submitted" : "missing",
          },
          {
            name: "Valid ID front",
            status: request.owner?.identityDocuments?.front?.dataUrl ? "submitted" : "missing",
          },
          {
            name: "Valid ID back",
            status: request.owner?.identityDocuments?.back?.dataUrl ? "submitted" : "missing",
          },
        ],

        docsSubmitted:
          1 +
          (request.agreement?.agreedToTerms ? 1 : 0) +
          (request.pet?.photoDataUrl ? 1 : 0) +
          (request.owner?.identityDocuments?.front?.dataUrl ? 1 : 0) +
          (request.owner?.identityDocuments?.back?.dataUrl ? 1 : 0),
        totalDocs: 5,

        reviewedBy: request.reviewedBy || null,
        reviewedAt: request.reviewedAt || null,
        reviewNotes: request.reviewNotes || null,
        rejectedReason: request.rejectedReason || null,
        intakeId: request.intakeId || null,
        dropoffDate: request.dropoffDate || null,
        surrenderAppointment: request.surrenderAppointment || null,
        surrenderRescheduleRequest: request.surrenderRescheduleRequest || null,
        attendanceDeadlineAt: request.attendanceDeadlineAt || null,
        deadlineStatus: request.deadlineStatus || "",
        deadlineReminderStage: request.deadlineReminderStage || "",
        noShowRisk: request.noShowRisk === true,
        arrivalConfirmedAt: request.arrivalConfirmedAt || null,
        expiredAt: request.expiredAt || null,
        expirationReason: request.expirationReason || "",
        deadlineExtensions: request.deadlineExtensions || [],

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
let attendanceWorkflow = null;
let currentRole = "";
let surrenderAvailability = null;

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
const emoji = s => ({Dog:"D",Cat:"C"}[s]||"A");
const thumbCls = s => ({Dog:"thumb-dog",Cat:"thumb-cat"}[s]||"thumb-other");
const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const displayValue = (value, fallback = "—") => escapeHtml(value || fallback);
const safePhotoUrl = value => /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(value || "") ? value : "";

function can(action) {
  return hasPermission(currentRole, "surrender", action);
}

function renderSurrenderAvailability({ busy = false, error = "" } = {}) {
  const control = document.querySelector(".surrender-intake-control");
  const toggle = document.getElementById("surrenderAvailabilityToggle");
  const label = document.getElementById("surrenderAvailabilityLabel");
  const description = document.getElementById("surrenderAvailabilityDescription");
  const accepting = surrenderAvailability?.acceptingRequests !== false;

  if (toggle) {
    toggle.checked = accepting;
    toggle.disabled = busy || !can("approve") || surrenderAvailability === null;
  }
  control?.classList.toggle("is-paused", surrenderAvailability !== null && !accepting);
  control?.classList.toggle("is-busy", busy);
  control?.classList.toggle("has-error", Boolean(error));

  if (label) {
    label.textContent = error
      ? "Unavailable"
      : surrenderAvailability === null
        ? "Checking"
        : accepting
          ? "Accepting"
          : "Paused";
  }
  if (description) {
    description.textContent = error
      || (accepting
        ? "The public surrender form is open and can receive new requests."
        : "The public form is closed because shelter space or cages may be unavailable.");
  }
}

async function loadSurrenderAvailability() {
  renderSurrenderAvailability({ busy: true });
  try {
    const response = await fetch(SURRENDER_AVAILABILITY_API_URL, {
      headers: { Accept: "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Unable to load the public request setting.");
    }
    surrenderAvailability = data.availability || { acceptingRequests: true };
    renderSurrenderAvailability();
  } catch (error) {
    surrenderAvailability = null;
    renderSurrenderAvailability({
      error: error.message || "Unable to load the public request setting.",
    });
  }
}

async function updateSurrenderAvailability(acceptingRequests) {
  const previous = surrenderAvailability;
  surrenderAvailability = { ...(previous || {}), acceptingRequests };
  renderSurrenderAvailability({ busy: true });

  try {
    const response = await fetch(SURRENDER_AVAILABILITY_API_URL, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ acceptingRequests }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Unable to update incoming surrender requests.");
    }
    surrenderAvailability = data.availability;
    renderSurrenderAvailability();
    showToast(
      "success",
      acceptingRequests
        ? "The public surrender form is now accepting requests."
        : "New public surrender requests have been paused."
    );
  } catch (error) {
    surrenderAvailability = previous;
    renderSurrenderAvailability();
    showToast("error", error.message || "Unable to update incoming surrender requests.");
  }
}

function formatDate(d) {
  if (!d) return "—";
  const value = /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? `${d}T00:00:00` : d;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"});
}

function urgencyCls(u) {
  return { Critical:"urgency-critical", High:"urgency-high", Medium:"urgency-medium", Low:"urgency-low" }[u] || "urgency-low";
}

function statusBadge(s) {
  const m = { Pending:{cls:"badge-pending"}, Approved:{cls:"badge-approved"}, Converted:{cls:"badge-converted"}, Rejected:{cls:"badge-rejected"}, Expired:{cls:"badge-rejected"} }[s] || {cls:"badge-pending"};
  return `<span class="status-badge ${m.cls}">${escapeHtml(s || "Pending")}</span>`;
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
  return `<span class="nlp-cat-badge ${cls}"><i class="bi ${icon}"></i>${escapeHtml(cat || "Other")}</span>`;
}

const URGENCY_FILL = { Critical:"fill-critical", High:"fill-high", Medium:"fill-medium", Low:"fill-low" };

/* ══════════════════════════════════════════════════════
   STATS
══════════════════════════════════════════════════════ */
function renderStats() {
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  const pendingCount = allRequests.filter(r => r.status === "Pending").length;
  set("statTotal", allRequests.length);
  set("statPending", pendingCount);
  set("heroPendingCount", pendingCount);
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

  // Sort: Critical, High, Medium, Low, then newest first within each level.
  filtered.sort(compareSurrenderUrgency);

  const resultLabel = document.getElementById("surrenderResultLabel");
  if (resultLabel) resultLabel.textContent = `${filtered.length} record${filtered.length === 1 ? "" : "s"}`;

  currentPage = 1;
  renderTable();
  renderPagination();
}

function clearSurrenderFilters() {
  activeTab = "all";
  const search = document.getElementById("searchSR");
  const urgency = document.getElementById("filterUrgency");
  const category = document.getElementById("filterCategory");
  if (search) search.value = "";
  if (urgency) urgency.value = "";
  if (category) category.value = "";
  document.querySelectorAll(".sr-tab").forEach((tab) => {
    const selected = tab.dataset.tab === "all";
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  applyFilters();
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
    tbody.innerHTML = `<tr><td colspan="7"><div class="reference-records-empty"><span><i class="bi bi-inbox"></i></span><strong>No surrender requests match</strong><small>Change the status, urgency, category, or search term to broaden this view.</small></div></td></tr>`;
    return;
  }

  tbody.innerHTML = page.map(r => `
    <tr data-id="${r.id}" class="management-card-row ${r.id===activeId?"row-active":""}">
      <td class="management-card-primary management-review-card-header management-review-identity surrender-owner-field" data-label="Owner">
        <div class="owner-cell">
          <div class="owner-avatar">${r.owner.initials}</div>
          <div>
            <div class="owner-name">${r.owner.name}</div>
            <div class="owner-barangay"><i class="bi bi-geo-alt-fill" style="color:var(--clay);font-size:0.65rem"></i> Brgy. ${r.owner.barangay}</div>
          </div>
        </div>
      </td>
      <td class="management-review-identity surrender-pet-field" data-label="Pet">
        <div class="pet-mini">
          <div class="pet-mini-thumb ${thumbCls(r.pet.species)}">${r.pet.photoDataUrl ? `<img src="${r.pet.photoDataUrl}" data-original-src="" alt="" loading="lazy" decoding="async" fetchpriority="low"><span data-image-fallback hidden>${emoji(r.pet.species)}</span>` : emoji(r.pet.species)}</div>
          <div>
            <div class="pet-mini-name">${r.pet.name}</div>
            <div class="pet-mini-breed">${r.pet.breed} · ${r.pet.sex}</div>
          </div>
        </div>
      </td>
      <td class="surrender-category-field" data-label="Category">${catBadge(r.nlp.category)}</td>
      <td class="surrender-urgency-field" data-label="Urgency"><span class="urgency-badge ${urgencyCls(r.nlp.urgencyLabel)}">${r.nlp.urgencyLabel}</span></td>
      <td data-label="Submitted" class="submitted-date surrender-submitted-field">${formatDate(r.submittedAt)}</td>
      <td class="surrender-status-field" data-label="Status">${statusBadge(r.status)}</td>
      <td class="management-card-actions surrender-actions-field" data-label="Actions">
        <button type="button" class="tbl-action-btn management-card-open management-view-action management-view-action--compact" data-action="view" data-id="${r.id}" title="View request" aria-label="View surrender request details">
          <i class="bi bi-eye" aria-hidden="true"></i><span class="management-action-text">View request</span>
        </button>
      </td>
    </tr>`).join("");

  installManagementImageFallbacks(tbody);

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
  document.getElementById("srDrawer")?.setAttribute("aria-hidden", "false");
  document.body.classList.add("management-drawer-open");
  renderDrawer(r);
}

function closeDrawer() {
  activeId = null;
  document.getElementById("srLayout")?.classList.remove("drawer-open");
  document.getElementById("srDrawer")?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("management-drawer-open");
  document.querySelectorAll("tr[data-id]").forEach(r => r.classList.remove("row-active"));
}

function renderDrawer(r) {
  const inner = document.getElementById("srDrawerInner");
  if (!inner) return;

  const owner = r.owner || {};
  const agreement = r.agreement || {};

  const urgencyScore = Math.max(0, Math.min(100, Number(r.nlp.urgencyScore) || 0));
  const fill = URGENCY_FILL[r.nlp.urgencyLabel] || "fill-low";
  const confPct = Math.max(0, Math.min(100, Math.round((Number(r.nlp.categoryConfidence ?? r.nlp.confidence) || 0) * 100)));
  const insufficientText = /insufficient meaningful text/i.test(String(r.nlp.categoryAdjustmentReason || ""));
  const confidenceNote = insufficientText
    ? "Insufficient explanation — staff review needed"
    : r.nlp.categoryAdjusted
      ? "Rule-adjusted — verify with the message"
      : confPct >= 75
        ? "Strong category match"
        : confPct >= 50
          ? "Moderate category match — verify"
          : "Low category match — staff review needed";
  const confidenceDetail = insufficientText
    ? "The submitted reason did not contain enough meaningful text for RoBERTa classification."
    : r.nlp.categoryAdjusted
      ? `RoBERTa suggested ${escapeHtml(r.nlp.modelCategory || "Other")}; ${escapeHtml(r.nlp.categoryAdjustmentReason || "a high-precision rule")} adjusted the displayed category.`
      : "RoBERTa confidence in the displayed reason category.";
  const priority = r.nlp.suggestedPriority || "Normal Priority";
  const urgencyNote = {
    Critical: "Review immediately and check for an urgent welfare risk.",
    High: "Review soon; the message may describe a serious welfare concern.",
    Medium: "Review in the normal queue and confirm the owner's situation.",
    Low: "No urgent risk was detected, but staff should still verify the request.",
  }[r.nlp.urgencyLabel] || "Review the owner's message before making a decision.";
  const keywords = Array.isArray(r.nlp.keywords) ? r.nlp.keywords : [];
  const usesNodeFallback = /node fallback/i.test(String(r.nlp.source || ""));
  const reanalyzeLabel = usesNodeFallback
    ? "Run Tagalog RoBERTa"
    : "Re-run Tagalog RoBERTa";

  // ── Plain-language automated triage section ──────────
  const nlpSection = `
    <div class="drawer-section drawer-section-analysis">
      <div class="drawer-section-title"><i class="bi bi-clipboard2-heart"></i> Request Triage</div>
      <div class="nlp-analysis-card">
        <div class="triage-callout">
          <span class="triage-callout-icon" aria-hidden="true"><i class="bi bi-flag-fill"></i></span>
          <div class="triage-callout-copy">
            <span>Recommended staff response</span>
            <strong>${escapeHtml(priority)}</strong>
            <p>${urgencyNote}</p>
          </div>
          <div class="triage-urgency ${urgencyCls(r.nlp.urgencyLabel)}">
            <span>${escapeHtml(r.nlp.urgencyLabel || "Low")}</span>
            <small>${urgencyScore}/100 urgency</small>
          </div>
        </div>

        <div class="triage-signals" aria-label="Automated review signals">
          <div class="triage-signal">
            <span class="triage-signal-label">Reason category</span>
            ${catBadge(r.nlp.category)}
          </div>
          <div class="triage-signal">
            <span class="triage-signal-label">Message tone</span>
            <span class="nlp-cat-badge cat-other">
              <i class="bi bi-chat-heart-fill"></i>${escapeHtml(r.nlp.sentiment || "Neutral")}
            </span>
          </div>
          <div class="triage-signal triage-confidence">
            <span class="triage-signal-label">Analysis confidence</span>
            <strong>${confPct}%</strong>
            <small class="triage-signal-status">${confidenceNote}</small>
            <p>${confidenceDetail}</p>
          </div>
        </div>

        <div class="triage-meter">
          <div class="triage-meter-heading">
            <span>Urgency score</span>
            <strong>${urgencyScore} / 100</strong>
          </div>
          <p>Estimates how quickly staff should review the request. A higher score means faster review.</p>
          <div class="urgency-meter">
            <div class="urgency-meter-track" role="meter" aria-label="Urgency score" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${urgencyScore}">
              <div class="urgency-meter-fill ${fill}" style="width:${urgencyScore}%"></div>
            </div>
          </div>
          <div class="triage-meter-scale" aria-hidden="true"><span>Low</span><span>Medium</span><span>High</span><span>Critical</span></div>
        </div>

        ${keywords.length ? `
        <div class="triage-keywords">
          <span class="triage-signal-label">Signals found in the message</span>
          <div class="reason-keywords">
            ${keywords.map(k=>`<span class="keyword-tag">${escapeHtml(k)}</span>`).join("")}
          </div>
        </div>` : ""}

        <div class="triage-disclaimer">
          <i class="bi bi-info-circle" aria-hidden="true"></i>
          <span><strong>Decision support only.</strong> Confirm the result against the owner's message before acting.</span>
          <div class="triage-analysis-source">
            <small>Analyzed by ${escapeHtml(r.nlp.source || "automated text analysis")}</small>
            <button class="triage-reanalyze-btn" id="reanalyzeSurrenderBtn" type="button" data-default-label="${reanalyzeLabel}">
                <i class="bi bi-stars" aria-hidden="true"></i>
                ${reanalyzeLabel}
            </button>
          </div>
        </div>
      </div>

      <div class="surrender-reason-panel">
        <div class="surrender-reason-label">Surrender Reason (Owner's Words)</div>
        <div class="reason-box">"${r.surrenderReason}"</div>
      </div>
    </div>`;

  // ── Owner section ─────────────────────────────────────
  const identityIdFrontUrl = safePhotoUrl(owner.identityDocuments?.front?.dataUrl);
  const identityIdBackUrl = safePhotoUrl(owner.identityDocuments?.back?.dataUrl);
  const identityDocumentsBlock = `
        <div class="drawer-info-item drawer-info-full">
          <div class="drawer-info-lbl">Submitted Valid ID</div>
          <div class="identity-document-strip">
            <figure class="${identityIdFrontUrl ? "" : "is-missing"}">
              ${identityIdFrontUrl ? `<img src="${identityIdFrontUrl}" data-original-src="" alt="Front of submitted valid ID" loading="lazy" decoding="async"><i class="bi bi-card-image" data-image-fallback hidden></i>` : `<i class="bi bi-card-image"></i>`}
              <figcaption>${displayValue(owner.identityDocuments?.front?.name, "Front ID")}</figcaption>
            </figure>
            <figure class="${identityIdBackUrl ? "" : "is-missing"}">
              ${identityIdBackUrl ? `<img src="${identityIdBackUrl}" data-original-src="" alt="Back of submitted valid ID" loading="lazy" decoding="async"><i class="bi bi-card-image" data-image-fallback hidden></i>` : `<i class="bi bi-card-image"></i>`}
              <figcaption>${displayValue(owner.identityDocuments?.back?.name, "Back ID")}</figcaption>
            </figure>
          </div>
        </div>`;

  const ownerSection = `
    <div class="drawer-section drawer-section-owner">
      <div class="drawer-section-title"><i class="bi bi-person-fill"></i> Owner Information</div>
      <div class="drawer-info-grid">
        <div class="drawer-info-item drawer-info-full">
          <div class="drawer-info-lbl">Full Name</div>
          <div class="drawer-info-val">${r.owner.name}</div>
        </div>
        <div class="drawer-info-item drawer-info-full">
          <div class="drawer-info-lbl">Email</div>
          <div class="drawer-info-val">${displayValue(owner.email || r.account?.email)}</div>
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
        ${identityDocumentsBlock}
      </div>
    </div>`;

  // ── Pet section ───────────────────────────────────────
  const submittedPhoto = safePhotoUrl(r.pet.photoDataUrl);
  const petPhotoBlock = submittedPhoto ? `
    <div class="surrender-pet-photo">
      <img src="${submittedPhoto}" data-original-src="" alt="Submitted photo of ${displayValue(r.pet.name, "the animal")}" loading="lazy" decoding="async">
      <div>
        <span>Submitted Animal Photo</span>
        <strong>${r.pet.photoName || "Uploaded photo"}</strong>
      </div>
    </div>` : `
    <div class="surrender-pet-photo is-empty">
      <i class="bi bi-image"></i>
      <div>
        <span>Submitted Animal Photo</span>
        <strong>No photo uploaded</strong>
      </div>
    </div>`;

  const petSection = `
    <div class="drawer-section drawer-section-pet">
      <div class="drawer-section-title"><i class="bi bi-heart-pulse"></i> Pet Information</div>
      ${petPhotoBlock}
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
  const extraPetDetailsSection = `
    <div class="drawer-section drawer-section-pet-extra">
      <div class="drawer-section-title"><i class="bi bi-card-checklist"></i> Additional Animal Details</div>
      <div class="drawer-info-grid">
        <div class="drawer-info-item drawer-info-full">
          <div class="drawer-info-lbl">Color / Markings</div>
          <div class="drawer-info-val">${r.pet.colorMarkings}</div>
        </div>
        <div class="drawer-info-item drawer-info-full">
          <div class="drawer-info-lbl">Reproductive Status</div>
          <div class="drawer-info-val">${r.pet.status.length ? r.pet.status.join(", ") : "Not specified"}</div>
        </div>
        <div class="drawer-info-item drawer-info-full">
          <div class="drawer-info-lbl">Vaccination / Health History</div>
          <div class="drawer-info-val">${r.pet.vaccinationHistory}</div>
        </div>
      </div>
    </div>`;

  const docsSection = `
    <div class="drawer-section drawer-section-documents">
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
        <div class="info-banner banner-rejected">
          <strong>${displayValue(r.rejectedReason, "No rejection reason provided.")}</strong>
          <div class="mt-1" style="font-size:0.82rem">Reviewed by ${displayValue(r.reviewedBy, "Staff")} on ${formatDate(r.reviewedAt)}</div>
        </div>
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
  if (r.status === "Expired") {
    statusSection = `
      <div class="drawer-section">
        <div class="drawer-section-title" style="color:var(--clay)"><i class="bi bi-calendar-x-fill"></i> Expired \u2014 No Show</div>
        <div class="info-banner banner-rejected"><strong>${displayValue(r.expirationReason, "The 14-day attendance deadline passed without confirmed arrival.")}</strong><div class="mt-1">Expired ${formatDate(r.expiredAt)}</div></div>
      </div>`;
  }

  const deadlineSection = ["Approved", "Expired"].includes(r.status) ? `
    <div class="drawer-section deadline-workflow-card ${r.noShowRisk ? "is-risk" : ""}">
      <div class="drawer-section-title"><i class="bi bi-calendar2-check"></i> Attendance Deadline</div>
      <div class="drawer-info-grid">
        <div class="drawer-info-item"><div class="drawer-info-lbl">Deadline</div><div class="drawer-info-val">${formatDate(r.attendanceDeadlineAt)}</div></div>
        <div class="drawer-info-item"><div class="drawer-info-lbl">Current State</div><div class="drawer-info-val">${displayValue(r.deadlineStatus, "Awaiting appointment")}</div></div>
        <div class="drawer-info-item"><div class="drawer-info-lbl">Drop-off Appointment</div><div class="drawer-info-val">${r.surrenderAppointment?.date ? `${formatDate(r.surrenderAppointment.date)} ${r.surrenderAppointment.time || ""}` : "Not scheduled"}</div></div>
        <div class="drawer-info-item"><div class="drawer-info-lbl">Arrival</div><div class="drawer-info-val">${r.arrivalConfirmedAt ? `Confirmed ${formatDate(r.arrivalConfirmedAt)}` : "Not confirmed"}</div></div>
      </div>
      ${String(r.surrenderRescheduleRequest?.status || "").toLowerCase() === "pending" ? `
        <div class="info-banner banner-approved mt-2">
          <strong>Drop-off reschedule awaiting review</strong>
          <div class="mt-1">${formatDate(r.surrenderRescheduleRequest.date)} ${r.surrenderRescheduleRequest.time || ""}</div>
          <div class="mt-2">
            <button class="btn-approve-confirm" id="drawerApproveRescheduleBtn"><i class="bi bi-check-lg"></i> Approve New Date</button>
            <button class="btn-danger-outline" id="drawerRejectRescheduleBtn"><i class="bi bi-x-lg"></i> Reject Change</button>
          </div>
        </div>` : ""}
    </div>` : "";

  // ── Footer buttons ────────────────────────────────────
  const submissionSection = `
    <div class="drawer-section drawer-section-submission">
      <div class="drawer-section-title"><i class="bi bi-shield-check"></i> Consent and Submission</div>
      <div class="drawer-info-grid">
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Submitted</div>
          <div class="drawer-info-val">${formatDate(r.submittedAt || r.createdAt)}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Source</div>
          <div class="drawer-info-val">${displayValue(r.source, "Public Form")}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Terms Accepted</div>
          <div class="drawer-info-val">${agreement.agreedToTerms ? "Yes" : "No"}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-lbl">Accepted On</div>
          <div class="drawer-info-val">${formatDate(agreement.agreedAt)}</div>
        </div>
        ${agreement.agreementText ? `
          <div class="drawer-info-item drawer-info-full">
            <div class="drawer-info-lbl">Consent Statement</div>
            <div class="drawer-info-val">${escapeHtml(agreement.agreementText)}</div>
          </div>` : ""}
      </div>
    </div>`;

  let footerBtns = `<button class="btn-ghost-clay" id="drawerCloseBtn"><i class="bi bi-x"></i> Close</button>`;
  if (r.status === "Pending") {
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
        ? `<button class="btn-approve-confirm" id="drawerApproveBtn">
            <i class="bi bi-check-lg"></i> Approve
          </button>`
        : ""
    }`;
}
  if (r.status === "Approved") {
    footerBtns += r.arrivalConfirmedAt
      ? `<button class="btn-convert-confirm management-primary-action" id="drawerConvertBtn"><i class="bi bi-clipboard2-plus-fill"></i> Start Intake</button>`
      : `
        <details class="management-more-actions">
          <summary>More actions <i class="bi bi-chevron-down" aria-hidden="true"></i></summary>
          <div>
            <button class="btn-ghost-clay" id="drawerExtendDeadlineBtn"><i class="bi bi-calendar-plus"></i> Extend deadline</button>
            <button class="btn-danger-outline" id="drawerNoShowBtn"><i class="bi bi-calendar-x"></i> Mark no show</button>
          </div>
        </details>
        <button class="btn-approve-confirm management-primary-action" id="drawerArrivalBtn"><i class="bi bi-person-check"></i> Confirm Arrival</button>`;
  }
  if (r.status === "Expired") {
    footerBtns += `<button class="btn-approve-confirm" id="drawerRestoreBtn"><i class="bi bi-arrow-counterclockwise"></i> Restore Request</button>`;
  }

  inner.innerHTML = `
    <div class="drawer-header">
      <div class="drawer-header-left">
        <h3>Surrender Request Details</h3>
        <p>${displayValue(r.id, "Surrender request")} · Submitted ${formatDate(r.submittedAt || r.createdAt)} · ${displayValue(r.source, "Public Form")}</p>
      </div>
      <button class="drawer-close-btn" id="drawerCloseX" aria-label="Close request details"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="action-alert drawer-action-alert" id="drawerActionAlert" role="status" aria-live="polite" hidden>
      <i class="bi" aria-hidden="true"></i>
      <div><strong></strong><span></span></div>
    </div>
    <div class="drawer-body">
      <section class="surrender-overview" aria-label="Owner and animal summary">
        <div class="overview-person">
          <span class="overview-avatar">${displayValue(owner.initials, "OW")}</span>
          <span><small>Owner</small><strong>${displayValue(owner.name, "Unknown owner")}</strong></span>
        </div>
        <span class="overview-link"><i class="bi bi-arrow-right"></i><small>is surrendering</small></span>
        <div class="overview-animal">
          <span class="overview-avatar overview-pet">${emoji(r.pet.species)}</span>
          <span><small>Animal</small><strong>${displayValue(r.pet.name, "Unnamed animal")}</strong></span>
        </div>
        <div class="overview-date">
          <small>Request Status</small>
          <strong>${statusBadge(r.status)}</strong>
        </div>
      </section>
      ${nlpSection}
      ${ownerSection}
      ${petSection}
      ${extraPetDetailsSection}
      ${docsSection}
      ${submissionSection}
      ${deadlineSection}
      ${statusSection}
    </div>
    <div class="drawer-footer">${footerBtns}</div>`;

  installManagementImageFallbacks(inner);

  document.getElementById("drawerCloseX")?.addEventListener("click",   closeDrawer);
  document.getElementById("drawerCloseBtn")?.addEventListener("click",  closeDrawer);
  document.getElementById("drawerApproveBtn")?.addEventListener("click",()=> openApproveModal(r.id));
  document.getElementById("drawerRejectBtn")?.addEventListener("click", ()=> openRejectModal(r.id));
  document.getElementById("drawerExtendDeadlineBtn")?.addEventListener("click", () => openAttendanceWorkflow(r.id, "deadline/extend"));
  document.getElementById("drawerArrivalBtn")?.addEventListener("click", () => openAttendanceWorkflow(r.id, "arrival"));
  document.getElementById("drawerNoShowBtn")?.addEventListener("click", () => openAttendanceWorkflow(r.id, "no-show"));
  document.getElementById("drawerRestoreBtn")?.addEventListener("click", () => openAttendanceWorkflow(r.id, "deadline/restore"));
  document.getElementById("drawerApproveRescheduleBtn")?.addEventListener("click", () => openAttendanceWorkflow(r.id, "reschedule/approve"));
  document.getElementById("drawerRejectRescheduleBtn")?.addEventListener("click", () => openAttendanceWorkflow(r.id, "reschedule/reject"));
  document.getElementById("drawerConvertBtn")?.addEventListener("click", () => beginSurrenderIntake(r.id));
  document.getElementById("reanalyzeSurrenderBtn")?.addEventListener("click", () => reanalyzeSurrenderRequest(r.id));
}

async function reanalyzeSurrenderRequest(id) {
  const button = document.getElementById("reanalyzeSurrenderBtn");
  if (button?.disabled) return;

  if (button) {
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Starting RoBERTa...';
  }

  try {
    const response = await fetch(`${SURRENDER_REQUESTS_API_URL}/${encodeURIComponent(id)}/reanalyze`, {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to run Tagalog RoBERTa analysis.");
    }

    const request = allRequests.find(item => item.id === id);
    if (request) {
      request.nlp = { ...request.nlp, ...data.nlp };
      request.nlpAnalyzedAt = data.nlpAnalyzedAt || null;
      renderStats();
      applyFilters();
      renderDrawer(request);
    }

    showToast("success", data.message || "Tagalog RoBERTa analysis completed.");
  } catch (error) {
    showToast("error", error.message || "Unable to run Tagalog RoBERTa analysis.");
    if (button?.isConnected) {
      button.disabled = false;
      button.innerHTML = `<i class="bi bi-stars" aria-hidden="true"></i> ${button.dataset.defaultLabel || "Run Tagalog RoBERTa"}`;
    }
  }
}

async function updateSurrenderStatusInBackend(id, payload) {
  const response = await fetch(`${SURRENDER_REQUESTS_API_URL}/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update surrender request.");
  }

  return data.request;
}

const attendanceWorkflowConfig = {
  arrival: {
    title: "Confirm Shelter Arrival",
    heading: "Owner and animal are physically at the shelter",
    message: "This completes attendance and unlocks the final Intake review.",
    icon: "bi-person-check-fill",
    button: "Confirm Arrival",
  },
  "deadline/extend": {
    title: "Extend Attendance Deadline",
    heading: "Give the sender additional time",
    message: "Choose 1 to 30 additional days and record why the extension is needed.",
    icon: "bi-calendar-plus-fill",
    button: "Extend Deadline",
    needsDays: true,
    needsReason: true,
  },
  "no-show": {
    title: "Mark as No Show",
    heading: "Close this request for non-attendance",
    message: "The request will expire and the reason will be kept in its audit history.",
    icon: "bi-calendar-x-fill",
    button: "Mark No Show",
    danger: true,
    needsReason: true,
    defaultReason: "Missed shelter appointment.",
  },
  "deadline/restore": {
    title: "Restore Expired Request",
    heading: "Reopen the attendance window",
    message: "A new 14-day deadline will be created after you confirm.",
    icon: "bi-arrow-counterclockwise",
    button: "Restore Request",
    needsReason: true,
  },
  "reschedule/approve": {
    title: "Approve New Drop-off Date",
    heading: "Accept the requested appointment change",
    message: "The approved date must still fall inside the active attendance deadline.",
    icon: "bi-calendar2-check-fill",
    button: "Approve New Date",
  },
  "reschedule/reject": {
    title: "Reject Date Change",
    heading: "Keep the current drop-off schedule",
    message: "Explain why the requested appointment change cannot be accepted.",
    icon: "bi-calendar2-x-fill",
    button: "Reject Change",
    danger: true,
    needsReason: true,
  },
};

function setActionAlert(id, type = "error", title = "", message = "") {
  const alert = document.getElementById(id);
  if (!alert) return;
  if (!message) {
    alert.hidden = true;
    return;
  }
  alert.className = `action-alert is-${type}${id === "drawerActionAlert" ? " drawer-action-alert" : ""}`;
  alert.querySelector("i").className = `bi ${type === "success" ? "bi-check-circle-fill" : type === "warning" ? "bi-exclamation-triangle-fill" : "bi-exclamation-circle-fill"}`;
  alert.querySelector("strong").textContent = title;
  alert.querySelector("span").textContent = message;
  alert.hidden = false;
}

function openAttendanceWorkflow(id, action) {
  const request = allRequests.find(item => item.id === id);
  const config = attendanceWorkflowConfig[action];
  if (!request || !config) return;
  attendanceWorkflow = { id, action };
  document.getElementById("workflowModalTitle").textContent = config.title;
  document.getElementById("workflowModalHeading").textContent = config.heading;
  document.getElementById("workflowModalMessage").textContent = config.message;
  document.querySelector("#workflowModalIcon i").className = `bi ${config.icon}`;
  document.getElementById("workflowDaysGroup").hidden = !config.needsDays;
  document.getElementById("workflowReasonGroup").hidden = !config.needsReason;
  document.getElementById("workflowDays").value = config.needsDays ? "7" : "";
  document.getElementById("workflowReason").value = config.defaultReason || "";
  document.getElementById("errWorkflowDays").textContent = "";
  document.getElementById("errWorkflowReason").textContent = "";
  document.getElementById("workflowDays").removeAttribute("aria-invalid");
  document.getElementById("workflowReason").removeAttribute("aria-invalid");
  setActionAlert("workflowActionAlert");
  const button = document.getElementById("workflowConfirmBtn");
  button.className = config.danger ? "btn-reject-confirm" : "btn-approve-confirm";
  button.innerHTML = `<i class="bi ${config.icon}"></i> ${config.button}`;
  openModal("workflowModalBackdrop");
}

async function executeAttendanceWorkflow() {
  if (!attendanceWorkflow) return;
  const { id, action } = attendanceWorkflow;
  const config = attendanceWorkflowConfig[action];
  const daysInput = document.getElementById("workflowDays");
  const reasonInput = document.getElementById("workflowReason");
  const extensionDays = Number(daysInput.value);
  const reason = reasonInput.value.trim();
  let valid = true;

  if (config.needsDays && (!Number.isInteger(extensionDays) || extensionDays < 1 || extensionDays > 30)) {
    document.getElementById("errWorkflowDays").textContent = "Enter a whole number from 1 to 30.";
    daysInput.setAttribute("aria-invalid", "true");
    valid = false;
  }
  if (config.needsReason && reason.length < 5) {
    document.getElementById("errWorkflowReason").textContent = "Enter a clear reason using at least 5 characters.";
    reasonInput.setAttribute("aria-invalid", "true");
    valid = false;
  }
  if (!valid) {
    setActionAlert("workflowActionAlert", "warning", "Check the highlighted fields", "Complete the required information before confirming.");
    return;
  }

  const payload = {};
  if (config.needsDays) payload.extensionDays = extensionDays;
  if (config.needsReason) payload.reason = reason;
  const button = document.getElementById("workflowConfirmBtn");
  const original = button.innerHTML;

  try {
    button.disabled = true;
    button.innerHTML = '<span class="button-spinner" aria-hidden="true"></span> Updating…';
    const response = await fetch(
      `${SURRENDER_REQUESTS_API_URL}/${encodeURIComponent(id)}/${action}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const responseText = await response.text();
    let result = {};
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      result = {};
    }
    if (!response.ok) {
      const message = response.status === 404
        ? "This attendance action is unavailable. Restart the management backend and try again."
        : result.message || "Unable to update the attendance workflow.";
      throw new Error(message);
    }

    closeModal("workflowModalBackdrop");
    publicRequests = await getPublicSubmittedRequests();
    allRequests = [...publicRequests];
    renderStats();
    applyFilters();
    const request = allRequests.find(item => item.id === id);
    if (request) {
      renderDrawer(request);
      setActionAlert("drawerActionAlert", "success", "Attendance updated", result.message || "The request workflow was updated successfully.");
    }
    showToast("success", result.message || "Attendance workflow updated.");
  } catch (error) {
    setActionAlert("workflowActionAlert", "error", "Could not update the request", error.message || "Please try again.");
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

/* ══════════════════════════════════════════════════════
   ACTIONS
══════════════════════════════════════════════════════ */
// Approve
function openApproveModal(id) {
  if (!can("approve")) {
  showToast(
    "error",
    "You do not have permission to approve surrender requests."
  );
  return;
}
  const r = allRequests.find(x => x.id === id)
  if (!r) return;
  confirmMode = { type:"approve", id };
  document.getElementById("approveConfirmMsg").textContent =
    `Approve surrender request ${id} from ${r.owner.name} for ${r.pet.name}?`;
  document.getElementById("approveNotes").value = "";
  setActionAlert("approveActionAlert");
  openModal("approveModalBackdrop");
}
async function executeApprove() {
  if (!can("approve")) {
  showToast(
    "error",
    "You do not have permission to approve surrender requests."
  );
  return;
}
  const r = allRequests.find(x => x.id === confirmMode.id);

  if (!r) return;

  const button = document.getElementById("approveConfirmBtn");
  const original = button?.innerHTML;
  try {
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span class="button-spinner" aria-hidden="true"></span> Approving…';
    }
    const reviewNotes = document.getElementById("approveNotes").value.trim() || null;

    const updatedRequest = await updateSurrenderStatusInBackend(r.id, {
      status: "Approved",
      reviewNotes,
    });

    Object.assign(r, updatedRequest);

    closeModal("approveModalBackdrop");
    publicRequests = await getPublicSubmittedRequests();
    allRequests = [...publicRequests];
    renderStats();
    applyFilters();
    const approvedRequest = allRequests.find(item => item.id === r.id);
    if (approvedRequest) renderDrawer(approvedRequest);
    showToast("success", `Request ${r.id} approved. Awaiting appointment and shelter arrival.`);

  } catch (error) {
    console.error("Approve surrender request error:", error);
    setActionAlert("approveActionAlert", "error", "Approval was not saved", error.message || "Please try again.");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = original;
    }
  }
}

// Reject
function openRejectModal(id) {
  if (!can("reject")) {
  showToast(
    "error",
    "You do not have permission to reject surrender requests."
  );
  return;
}
  const r = allRequests.find(x=>x.id===id);
  if (!r) return;
  confirmMode = { type:"reject", id };
  document.getElementById("rejectConfirmMsg").textContent =
    `Reject surrender request ${id} from ${r.owner.name}?`;
  document.getElementById("rejectReason").value = "";
  document.getElementById("rejectReason").removeAttribute("aria-invalid");
  document.getElementById("errRejectReason").textContent = "";
  setActionAlert("rejectActionAlert");
  openModal("rejectModalBackdrop");
}
async function executeReject() {
  if (!can("reject")) {
  showToast(
    "error",
    "You do not have permission to reject surrender requests."
  );
  return;
}
  const reason = document.getElementById("rejectReason")?.value.trim();

  if (!reason || reason.length < 5) {
    document.getElementById("errRejectReason").textContent = "Enter a clear reason using at least 5 characters.";
    document.getElementById("rejectReason").setAttribute("aria-invalid", "true");
    setActionAlert("rejectActionAlert", "warning", "Reason required", "Add enough detail for staff and the sender to understand this decision.");
    return;
  }

  const r = allRequests.find(x => x.id === confirmMode.id);

  if (!r) return;

  const button = document.getElementById("rejectConfirmBtn");
  const original = button?.innerHTML;
  try {
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span class="button-spinner" aria-hidden="true"></span> Rejecting…';
    }
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
    setActionAlert("rejectActionAlert", "error", "Rejection was not saved", error.message || "Please try again.");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = original;
    }
  }
}

// Arrival is already confirmed, so open the one final intake review directly.
function beginSurrenderIntake(id) {
  const r = allRequests.find(x=>x.id===id);
  if (!r) return;
  if (r.status !== "Approved" || !r.arrivalConfirmedAt) {
    showToast("error", "Confirm the owner and animal's arrival before starting Intake.");
    return;
  }

  sessionStorage.setItem(
    "approved_surrender_for_intake",
    JSON.stringify({
      surrenderId: r.id,
      ownerName: r.owner?.name || "",
      ownerContact: r.owner?.contact || "",
      approvedDate: r.reviewedAt || new Date().toISOString().split("T")[0],
      arrivalConfirmedAt: r.arrivalConfirmedAt,
      petName: r.pet?.name || "",
      species: r.pet?.species || "",
      breed: r.pet?.breed || "",
      sex: r.pet?.sex || "",
      age: r.pet?.age || "",
      colorMarkings: r.pet?.colorMarkings || "",
      vaccinationHistory: r.pet?.vaccinationHistory || "",
      photoName: r.pet?.photoName || "",
      photoType: r.pet?.photoType || "",
      photoDataUrl: r.pet?.photoDataUrl || "",
      surrenderReason: r.surrenderReason || "",
    })
  );

  showToast("success", "Opening the final Intake review...");
  setTimeout(() => {
    navigateManagementPage("/pages/intakeList.html?source=surrender");
  }, 500);
}

/* ══════════════════════════════════════════════════════
   MODAL / TOAST / SIDEBAR
══════════════════════════════════════════════════════ */
function openModal(id)  { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }
function closeAllModals() {
  ["rejectModalBackdrop","approveModalBackdrop","workflowModalBackdrop"].forEach(closeModal);
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
    const session = await protectPageByModule("surrender");
    currentRole = session.role;
    renderTopbarUser();
    loadSidebar(); 

    document.getElementById("surrenderAvailabilityToggle")?.addEventListener("change", event => {
      updateSurrenderAvailability(event.currentTarget.checked);
    });

    await loadSurrenderAvailability();

    publicRequests = await getPublicSubmittedRequests();

    if (!Array.isArray(publicRequests)) {
      console.warn("Public requests was not an array. Resetting to empty array.", publicRequests);
      publicRequests = [];
    }

    allRequests = [...publicRequests];
    filtered = [...allRequests];

    renderStats();
    applyFilters();
    const requestedId = new URLSearchParams(window.location.search).get("id");
    if (requestedId && allRequests.some((request) => request.id === requestedId)) {
      openDrawer(requestedId);
    }

    // Tabs
    document.querySelectorAll(".sr-tab").forEach(btn => {
      btn.addEventListener("click",()=>{
        document.querySelectorAll(".sr-tab").forEach(t=>t.classList.remove("active"));
        btn.classList.add("active"); activeTab=btn.dataset.tab; applyFilters();
      });
    });

    document.getElementById("reviewPendingBtn")?.addEventListener("click", () => {
      const pendingTab = document.querySelector('.sr-tab[data-tab="Pending"]');
      pendingTab?.click();
      document.getElementById("srTablePanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.getElementById("searchSR")?.addEventListener("input",      applyFilters);
    document.getElementById("filterUrgency")?.addEventListener("change", applyFilters);
    document.getElementById("filterCategory")?.addEventListener("change",applyFilters);
    document.getElementById("clearSurrenderFilters")?.addEventListener("click", clearSurrenderFilters);
    document.getElementById("srDrawerBackdrop")?.addEventListener("click", closeDrawer);
    // Reject modal
    document.getElementById("rejectModalClose")?.addEventListener("click",  ()=>closeModal("rejectModalBackdrop"));
    document.getElementById("rejectModalCancel")?.addEventListener("click", ()=>closeModal("rejectModalBackdrop"));
    document.getElementById("rejectConfirmBtn")?.addEventListener("click",  executeReject);

    // Approve modal
    document.getElementById("approveModalClose")?.addEventListener("click",  ()=>closeModal("approveModalBackdrop"));
    document.getElementById("approveModalCancel")?.addEventListener("click", ()=>closeModal("approveModalBackdrop"));
    document.getElementById("approveConfirmBtn")?.addEventListener("click",  executeApprove);

    // Attendance workflow modal
    document.getElementById("workflowModalClose")?.addEventListener("click",  ()=>closeModal("workflowModalBackdrop"));
    document.getElementById("workflowModalCancel")?.addEventListener("click", ()=>closeModal("workflowModalBackdrop"));
    document.getElementById("workflowConfirmBtn")?.addEventListener("click", executeAttendanceWorkflow);
    document.getElementById("workflowDays")?.addEventListener("input", event => {
      event.currentTarget.removeAttribute("aria-invalid");
      document.getElementById("errWorkflowDays").textContent = "";
      setActionAlert("workflowActionAlert");
    });
    document.getElementById("workflowReason")?.addEventListener("input", event => {
      event.currentTarget.removeAttribute("aria-invalid");
      document.getElementById("errWorkflowReason").textContent = "";
      setActionAlert("workflowActionAlert");
    });
    document.getElementById("rejectReason")?.addEventListener("input", event => {
      event.currentTarget.removeAttribute("aria-invalid");
      document.getElementById("errRejectReason").textContent = "";
      setActionAlert("rejectActionAlert");
    });

    // Backdrop click
    ["rejectModalBackdrop","approveModalBackdrop","workflowModalBackdrop"].forEach(id=>{
      document.getElementById(id)?.addEventListener("click",e=>{if(e.target.id===id)closeModal(id);});
    });

    document.addEventListener("keydown",e=>{
      if(e.key!=="Escape") return;
      const hasOpenModal = document.querySelector(".um-modal-backdrop.open");
      if(hasOpenModal) closeAllModals();
      else closeDrawer();
    });

    document.body.classList.remove("loading");
  } catch(err) {
    console.error("Surrender Requests init failed:", err);
    document.body.classList.remove("loading");
  }
}

window.addEventListener("DOMContentLoaded", init);
