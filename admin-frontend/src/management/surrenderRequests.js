// admin-frontend/src/management/surrenderRequests.js
import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../css/surrenderRequests.css";

import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser }      from "../components/management/topbarUser.js";
import { loadSidebar }           from "../components/management/sidebarLoader.js";
import { getUserName }           from "../utils/storage.js";

/* ══════════════════════════════════════════════════════
   NLP MOCK ENGINE
   In production this calls your NLP backend endpoint.
   For now we simulate classification with keyword rules.

   Categories:  Medical | Financial | Relocation |
                Behavioral | Overcrowding | Abandonment Risk |
                Owner Incapacity | Other

   Urgency:     Critical (90–100) | High (65–89) |
                Medium (40–64)    | Low (0–39)
══════════════════════════════════════════════════════ */
const NLP_RULES = [
  {
    category: "Medical",
    keywords: ["sick","illness","disease","cancer","tumor","injury","injured","surgery","treatment","veterinary","vet","allergy","paralyzed","dying","terminal","disabled"],
    baseUrgency: 85,
    urgencyBoost: ["dying","terminal","critical","emergency","cannot afford treatment"],
  },
  {
    category: "Abandonment Risk",
    keywords: ["abandon","leave","street","throw","nowhere","no choice","give up","no option","dispose","get rid"],
    baseUrgency: 90,
    urgencyBoost: ["already on the street","will leave","days left"],
  },
  {
    category: "Owner Incapacity",
    keywords: ["hospital","bedridden","disability","nursing home","elderly","senior","alone","no one to care","caregiver","health condition","accident","operation"],
    baseUrgency: 75,
    urgencyBoost: ["hospitalized","bedridden","no family"],
  },
  {
    category: "Financial",
    keywords: ["afford","money","financial","cost","expensive","budget","income","job","unemployed","poverty","struggling","cannot pay","no funds"],
    baseUrgency: 55,
    urgencyBoost: ["no income","lost job","bankrupt"],
  },
  {
    category: "Relocation",
    keywords: ["moving","relocate","transfer","abroad","migration","new home","condo","apartment","landlord","no pets allowed","rules","not allowed"],
    baseUrgency: 40,
    urgencyBoost: ["leaving country","days before moving","eviction"],
  },
  {
    category: "Behavioral",
    keywords: ["aggressive","biting","attack","dangerous","destructive","noise","barking","scratching","fear","anxiety","behavior","temper","violent"],
    baseUrgency: 60,
    urgencyBoost: ["bit a child","attacked","hospitalized someone"],
  },
  {
    category: "Overcrowding",
    keywords: ["too many","multiple pets","cannot handle","too much","overwhelmed","litter","puppies","kittens","several"],
    baseUrgency: 35,
    urgencyBoost: ["no space","10 or more"],
  },
];

function mockNlpAnalyze(reasonText) {
  const text     = reasonText.toLowerCase();
  let bestMatch  = { category:"Other", urgencyScore:20, confidence:0.45, keywords:[] };
  let best       = 0;

  for (const rule of NLP_RULES) {
    const hits = rule.keywords.filter(k => text.includes(k));
    if (hits.length === 0) continue;

    const score     = hits.length / rule.keywords.length;
    const boosted   = rule.urgencyBoost.some(b => text.includes(b));
    const urgency   = Math.min(100, rule.baseUrgency + (boosted ? 15 : 0) + (hits.length > 3 ? 5 : 0));
    const confidence= Math.min(0.98, 0.55 + score * 0.5);

    if (score > best) {
      best      = score;
      bestMatch = { category:rule.category, urgencyScore:urgency, confidence, keywords:hits.slice(0,5) };
    }
  }

  // Map score to label
  const urgencyLabel = bestMatch.urgencyScore >= 85 ? "Critical"
    : bestMatch.urgencyScore >= 65 ? "High"
    : bestMatch.urgencyScore >= 40 ? "Medium" : "Low";

  return { ...bestMatch, urgencyLabel };
}

/* ══════════════════════════════════════════════════════
   ANGELES CITY BARANGAYS
══════════════════════════════════════════════════════ */
const ANGELES_BARANGAYS = [
  "Agapito del Rosario","Amsic","Anunas","Balibago","Capaya","Claro M. Recto",
  "Cuayan","Cutcut","Cutud","Lourdes Norte","Lourdes Sur","Lourdes Sur Este",
  "Malabanias","Margot","Mining","Ninoy Aquino","Pampang","Pandan","Plaridel",
  "Pulung Cacutud","Pulung Maragul","Pulungbulu","Salapungan","San Jose",
  "San Nicolas","Santa Teresita","Santa Trinidad","Santo Cristo","Santo Domingo",
  "Santo Rosario","Sapalibutad","Sapangbato","Sergio Bernal","Silangan",
  "Tabun","Virgen Delos Remedios",
];

/* ══════════════════════════════════════════════════════
   MOCK SURRENDER REQUESTS (15 records)
══════════════════════════════════════════════════════ */
const RAW_REASONS = [
  "My dog has a terminal illness and I cannot afford the expensive veterinary treatment. He is suffering and I want him to be cared for properly.",
  "We are relocating abroad next week and the country we are moving to does not allow pets. We have no other family members who can take care of our cat.",
  "My cat has become extremely aggressive lately, biting family members including my young child. It is no longer safe to keep her at home.",
  "I lost my job three months ago and I can no longer afford food and veterinary care for my dogs. I have two dogs and it is becoming very difficult financially.",
  "I am bedridden due to a serious accident and I am hospitalized. I have no family members in Angeles City who can take care of my dog.",
  "My landlord just gave us a notice that no pets are allowed in our new apartment. We are moving out in a few days and cannot keep our rabbit.",
  "I have too many cats now — my cat had three litters this year and I have 12 cats. I cannot handle all of them and I am overwhelmed.",
  "My dog was diagnosed with cancer and requires surgery. I have no money to pay for the operation and I feel it is better for him to be with people who can afford treatment.",
  "I will be leaving for abroad for work in two weeks. I have no one to leave my dog with and I am afraid she will be abandoned if I cannot find a home for her.",
  "My elderly mother who was the primary caregiver of our pet passed away. I live abroad and I cannot come home to care for the dog personally.",
  "My dog has been attacking our neighbors and has bitten two people already. We are afraid of legal consequences and cannot control his aggressive behavior.",
  "We are financially struggling and can barely feed ourselves. We feel terrible but we cannot provide proper care for our pets anymore.",
  "I am moving to a condo unit that strictly prohibits pets. I tried looking for a new owner but I have not found one in time.",
  "My cat is very sick and I cannot afford treatment. She has not been eating for days and I am worried she will die without proper medical care.",
  "I have 3 dogs and my new apartment only allows one pet. I need to surrender 2 of my dogs as the landlord requires it.",
];

const OWNER_NAMES = [
  "Maria Santos","Juan Dela Cruz","Ana Reyes","Carlo Garcia","Liza Bautista",
  "Ramon Valdez","Karen Cruz","Paolo Mendoza","Rosa Jimenez","Andres Tan",
  "Sophia Lim","Miguel Aquino","Crisanta Ocampo","Eduardo Flores","Beatriz Ramos",
];

const PET_DATA = [
  { name:"Bruno",   species:"Dog", breed:"Aspin",             age:"3 years", sex:"Male" },
  { name:"Whiskers",species:"Cat", breed:"Domestic Shorthair",age:"2 years", sex:"Female" },
  { name:"Princess",species:"Cat", breed:"Persian Mix",       age:"4 years", sex:"Female" },
  { name:"Bantay",  species:"Dog", breed:"Aspin",             age:"5 years", sex:"Male" },
  { name:"Buddy",   species:"Dog", breed:"Labrador Mix",      age:"2 years", sex:"Male" },
  { name:"Mochi",   species:"Rabbit",breed:"Holland Lop",     age:"1 year",  sex:"Female" },
  { name:"Shadow",  species:"Dog", breed:"Aspin",             age:"1 year",  sex:"Male" },
  { name:"Rex",     species:"Dog", breed:"German Shepherd",   age:"4 years", sex:"Male" },
  { name:"Cleo",    species:"Cat", breed:"Siamese",           age:"3 years", sex:"Female" },
  { name:"Choco",   species:"Dog", breed:"Shih Tzu Mix",      age:"6 years", sex:"Female" },
  { name:"Simba",   species:"Dog", breed:"Aspin",             age:"2 years", sex:"Male" },
  { name:"Luna",    species:"Cat", breed:"Puspin",            age:"1 year",  sex:"Female" },
  { name:"Kiko",    species:"Dog", breed:"Aspin",             age:"3 years", sex:"Male" },
  { name:"Nala",    species:"Cat", breed:"Domestic Longhair", age:"5 years", sex:"Female" },
  { name:"Pugoy",   species:"Dog", breed:"Aspin",             age:"4 years", sex:"Male" },
];

const AVATAR_COLORS = [
  "#6f191c","#2558a8","#186534","#b86a00","#0d6e6e",
  "#9b2c4e","#3d2b8a","#1a6b5a","#7a3b00","#1a4e7a",
  "#6f191c","#2558a8","#186534","#b86a00","#0d6e6e",
];

const DOCS_TEMPLATES = [
  ["Valid government ID","Proof of residence","Pet vaccination records","Signed surrender form"],
  ["Valid government ID","Proof of residence","Signed surrender form"],
  ["Valid government ID","Proof of residence","Pet vaccination records","Medical certificate","Signed surrender form"],
];

const STATUSES = ["Pending","Pending","Pending","Pending","Pending","Approved","Approved","Converted","Rejected","Pending","Pending","Approved","Pending","Pending","Rejected"];

const DATES = [
  "2025-03-20","2025-03-19","2025-03-18","2025-03-17","2025-03-17",
  "2025-03-15","2025-03-14","2025-03-10","2025-03-09","2025-03-18",
  "2025-03-16","2025-03-12","2025-03-20","2025-03-19","2025-03-08",
];

// Build the mock records with NLP already applied
const mockRequests = RAW_REASONS.map((reason, i) => {
  const nlp      = mockNlpAnalyze(reason);
  const status   = STATUSES[i];
  const pet      = PET_DATA[i];
  const barangay = ANGELES_BARANGAYS[i % ANGELES_BARANGAYS.length];

  // Document list with random completion
  const docTemplate = DOCS_TEMPLATES[i % DOCS_TEMPLATES.length];
  const docs = docTemplate.map(d => ({
    name:   d,
    status: Math.random() > 0.25 ? "submitted" : Math.random() > 0.4 ? "pending" : "missing",
  }));
  const docsSubmitted = docs.filter(d => d.status === "submitted").length;

  return {
    id:            `SR-2025-${String(i + 1).padStart(3,"0")}`,
    status,
    submittedAt:   DATES[i],
    owner: {
      name:        OWNER_NAMES[i],
      contact:     `09${String(Math.floor(Math.random()*900000000+100000000))}`,
      address:     `${Math.floor(Math.random()*200+1)} ${["Rizal St.","Mabini Ave.","Sto. Rosario St.","MacArthur Hwy","Sto. Tomas","Del Pilar St."][i%6]}`,
      barangay,
      idType:      ["PhilHealth","UMID","Voter's ID","Driver's License","Passport","Postal ID"][i%6],
      color:       AVATAR_COLORS[i],
      initials:    OWNER_NAMES[i].split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2),
    },
    pet,
    surrenderReason: reason,
    nlp: {
      category:    nlp.category,
      urgencyLabel:nlp.urgencyLabel,
      urgencyScore:nlp.urgencyScore,
      confidence:  nlp.confidence,
      keywords:    nlp.keywords,
    },
    documents:       docs,
    docsSubmitted,
    totalDocs:       docs.length,
    reviewedBy:      status !== "Pending" ? "Ana Santos" : null,
    reviewedAt:      status !== "Pending" ? "2025-03-16" : null,
    reviewNotes:     status === "Approved"  ? "All documents verified. Schedule drop-off." : null,
    rejectedReason:  status === "Rejected"  ? "Incomplete documents submitted. Please resubmit with all required IDs and proof of residence." : null,
    intakeId:        status === "Converted" ? `INT-2025-${String(i+1).padStart(3,"0")}` : null,
    dropoffDate:     status === "Converted" ? "2025-03-18" : null,
  };
});

/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
let filtered    = [...mockRequests];
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
  set("statTotal",    mockRequests.length);
  set("statPending",  mockRequests.filter(r=>r.status==="Pending").length);
  set("statCritical", mockRequests.filter(r=>r.nlp.urgencyLabel==="Critical").length);
  set("statApproved", mockRequests.filter(r=>r.status==="Approved").length);
  set("statConverted",mockRequests.filter(r=>r.status==="Converted").length);
  set("statRejected", mockRequests.filter(r=>r.status==="Rejected").length);
}

/* ══════════════════════════════════════════════════════
   FILTER
══════════════════════════════════════════════════════ */
function applyFilters() {
  const q    = (document.getElementById("searchSR")?.value||"").toLowerCase().trim();
  const urg  = document.getElementById("filterUrgency")?.value||"";
  const cat  = document.getElementById("filterCategory")?.value||"";

  filtered = mockRequests.filter(r => {
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
  const r = mockRequests.find(x => x.id === id);
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
      <div class="drawer-section-title"><i class="bi bi-cpu"></i> NLP Analysis (Mock)</div>
      <div class="nlp-analysis-card">
        <div class="nlp-analysis-header">
          <span class="nlp-chip"><i class="bi bi-cpu-fill"></i> NLP Classified</span>
          <span style="font-size:0.75rem;color:var(--stone)">Simulated result</span>
        </div>
        <div class="nlp-category-row">
          <div>
            <div style="font-size:0.72rem;font-weight:700;color:var(--stone);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.06em">Category</div>
            ${catBadge(r.nlp.category)}
          </div>
          <div class="nlp-confidence">Confidence: <span>${confPct}%</span></div>
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
      <button class="btn-danger-outline"  id="drawerRejectBtn"><i class="bi bi-x-lg"></i> Reject</button>
      <button class="btn-convert-confirm" id="drawerConvertBtn"><i class="bi bi-arrow-right-circle-fill"></i> Convert to Intake</button>`;
  }

  inner.innerHTML = `
    <div class="drawer-header">
      <div class="drawer-header-left">
        <h3>${r.id}</h3>
        <p>${r.owner.name} · ${emoji(r.pet.species)} ${r.pet.name} · ${statusBadge(r.status)}</p>
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
  document.getElementById("drawerConvertBtn")?.addEventListener("click",()=> openConvertModal(r.id));
}

/* ══════════════════════════════════════════════════════
   ACTIONS
══════════════════════════════════════════════════════ */
// Approve
function openApproveModal(id) {
  const r = mockRequests.find(x=>x.id===id);
  if (!r) return;
  confirmMode = { type:"approve", id };
  document.getElementById("approveConfirmMsg").textContent =
    `Approve surrender request ${id} from ${r.owner.name} for ${r.pet.name}?`;
  document.getElementById("approveNotes").value = "";
  openModal("approveModalBackdrop");
}
function executeApprove() {
  const r = mockRequests.find(x=>x.id===confirmMode.id);
  if (!r) return;
  r.status      = "Approved";
  r.reviewedBy  = getUserName() || "Admin";
  r.reviewedAt  = new Date().toISOString().split("T")[0];
  r.reviewNotes = document.getElementById("approveNotes").value.trim() || null;
  closeModal("approveModalBackdrop");
  renderStats(); applyFilters(); renderDrawer(r);
  showToast("success", `Request ${r.id} approved.`);
}

// Reject
function openRejectModal(id) {
  const r = mockRequests.find(x=>x.id===id);
  if (!r) return;
  confirmMode = { type:"reject", id };
  document.getElementById("rejectConfirmMsg").textContent =
    `Reject surrender request ${id} from ${r.owner.name}?`;
  document.getElementById("rejectReason").value = "";
  document.getElementById("errRejectReason").textContent = "";
  openModal("rejectModalBackdrop");
}
function executeReject() {
  const reason = document.getElementById("rejectReason")?.value.trim();
  if (!reason) { document.getElementById("errRejectReason").textContent = "A reason is required."; return; }
  const r = mockRequests.find(x=>x.id===confirmMode.id);
  if (!r) return;
  r.status         = "Rejected";
  r.rejectedReason = reason;
  closeModal("rejectModalBackdrop");
  renderStats(); applyFilters(); renderDrawer(r);
  showToast("info", `Request ${r.id} rejected.`);
}

// Convert to intake
function openConvertModal(id) {
  const r = mockRequests.find(x=>x.id===id);
  if (!r) return;
  confirmMode = { type:"convert", id };
  document.getElementById("convertConfirmMsg").textContent =
    `Convert ${r.id} (${r.pet.name} from ${r.owner.name}) to a formal Intake record?`;
  document.getElementById("fDropoffDate").value = new Date().toISOString().split("T")[0];
  openModal("convertModalBackdrop");
}
function executeConvert() {
  const r = mockRequests.find(x=>x.id===confirmMode.id);
  if (!r) return;
  const seq      = mockRequests.filter(x=>x.status==="Converted").length + 1;
  r.status       = "Converted";
  r.intakeId     = `INT-2025-${String(seq).padStart(3,"0")}`;
  r.dropoffDate  = document.getElementById("fDropoffDate").value;
  closeModal("convertModalBackdrop");
  renderStats(); applyFilters(); renderDrawer(r);
  showToast("success", `Intake record ${r.intakeId} created from ${r.id}.`);
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

function bindSidebarToggle() {
  document.getElementById("sidebarToggle")?.addEventListener("click",()=>{
    const sb=document.getElementById("sidebar"),ct=document.getElementById("sidebar-container");
    if(window.innerWidth<=768){document.getElementById("mobile-nav-toggle")?.click();return;}
    const c=sb?.classList.toggle("collapsed"); if(ct){ct.style.width=c?"64px":"";ct.style.minWidth=c?"64px":"";}
  });
}

/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */
async function init() {
  try {
    await protectManagementPage();
    loadSidebar(); renderTopbarUser(); bindSidebarToggle();

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