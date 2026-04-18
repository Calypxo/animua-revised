// admin-frontend/src/management/reports.js
import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../css/reports.css";

import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser }      from "../components/management/topbarUser.js";
import { loadSidebar }           from "../components/management/sidebarLoader.js";

/* ══════════════════════════════════════════════════════
   CHART.JS DEFAULTS
══════════════════════════════════════════════════════ */
const FONT   = "'Outfit', sans-serif";
const MONO   = "'DM Mono', monospace";
const COLORS = {
  clay:    "#6f191c",
  clayMid: "#97262b",
  claySoft:"rgba(111,25,28,0.15)",
  amber:   "#b86a00",
  amberS:  "rgba(184,106,0,0.15)",
  blue:    "#2558a8",
  blueS:   "rgba(37,88,168,0.15)",
  green:   "#186534",
  greenS:  "rgba(24,101,52,0.15)",
  rose:    "#9b2c4e",
  roseS:   "rgba(155,44,78,0.15)",
  teal:    "#0d6e6e",
  tealS:   "rgba(13,110,110,0.15)",
  stone:   "#8c8481",
  stoneS:  "rgba(140,132,129,0.15)",
  purple:  "#6b21a8",
  purpleS: "rgba(107,33,168,0.15)",
};

const TOOLTIP_DEFAULTS = {
  backgroundColor:"#fff",
  titleColor:"#181517",
  bodyColor:"#8c8481",
  borderColor:"rgba(28,20,20,0.12)",
  borderWidth:1,
  padding:12,
  cornerRadius:10,
  titleFont:{ family:FONT, weight:"700", size:13 },
  bodyFont: { family:FONT, size:12 },
};

function xAxis(extra={}) {
  return { grid:{ display:false }, ticks:{ font:{ family:MONO, size:11 }, color:"#b5b0ac" }, ...extra };
}
function yAxis(extra={}) {
  return { grid:{ color:"rgba(28,20,20,0.05)" }, ticks:{ font:{ family:MONO, size:11 }, color:"#b5b0ac" }, beginAtZero:true, ...extra };
}

/* ══════════════════════════════════════════════════════
   DONUT LEGEND HELPER
══════════════════════════════════════════════════════ */
function buildLegend(containerId, labels, colors, counts, total) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = labels.map((lbl,i) => `
    <div class="donut-legend-item">
      <div class="donut-legend-dot" style="background:${colors[i]}"></div>
      <span><span class="donut-legend-name">${lbl}</span>${counts[i]} (${Math.round(counts[i]/total*100)}%)</span>
    </div>`).join("");
}

/* ══════════════════════════════════════════════════════
   CHART BUILDERS
══════════════════════════════════════════════════════ */

// ── OVERVIEW ─────────────────────────────────────────
function buildOverviewTrend() {
  const ctx = document.getElementById("chartOverviewTrend"); if(!ctx) return;
  new Chart(ctx, {
    type:"bar",
    data:{
      labels:["Jan W1","Jan W2","Jan W3","Jan W4","Feb W1","Feb W2","Feb W3","Feb W4","Mar W1","Mar W2","Mar W3","Mar W4"],
      datasets:[
        { label:"Intake",    data:[3,4,3,5,4,3,5,4,5,6,4,5], backgroundColor:COLORS.claySoft, borderColor:COLORS.clay, borderWidth:2, borderRadius:5, borderSkipped:false },
        { label:"Adoptions", data:[1,2,2,3,2,2,3,3,3,4,3,3], backgroundColor:COLORS.greenS,  borderColor:COLORS.green, borderWidth:2, borderRadius:5, borderSkipped:false },
      ]
    },
    options:{ responsive:true, maintainAspectRatio:false, interaction:{ mode:"index", intersect:false },
      plugins:{ legend:{ display:false }, tooltip:TOOLTIP_DEFAULTS },
      scales:{ x:xAxis(), y:yAxis({ stepSize:2 }) }
    }
  });
}

function buildStatusDonut() {
  const ctx = document.getElementById("chartStatusDonut"); if(!ctx) return;
  const labels = ["Profiling","Quarantine","Ready"];
  const data   = [50,30,20];
  const colors = [COLORS.amber, COLORS.blue, COLORS.green];
  new Chart(ctx, {
    type:"doughnut",
    data:{ labels, datasets:[{ data, backgroundColor:colors, borderColor:"#fff", borderWidth:3, hoverOffset:5 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:"70%",
      plugins:{ legend:{ display:false }, tooltip:{ ...TOOLTIP_DEFAULTS, callbacks:{ label: c=>`  ${c.label}: ${c.parsed} animals` } } }
    }
  });
  buildLegend("statusDonutLegend", labels, colors, data, 100);
}

function buildSourceDonut() {
  const ctx = document.getElementById("chartSourceDonut"); if(!ctx) return;
  const labels = ["Rescue","Barangay Impound","Approved Surrender"];
  const data   = [34,33,33];
  const colors = [COLORS.amber, COLORS.blue, COLORS.teal];
  new Chart(ctx, {
    type:"doughnut",
    data:{ labels, datasets:[{ data, backgroundColor:colors, borderColor:"#fff", borderWidth:3, hoverOffset:5 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:"70%",
      plugins:{ legend:{ display:false }, tooltip:{ ...TOOLTIP_DEFAULTS, callbacks:{ label: c=>`  ${c.label}: ${c.parsed}` } } }
    }
  });
  buildLegend("sourceDonutLegend", labels, colors, data, 100);
}

function buildSpeciesPie() {
  const ctx = document.getElementById("chartSpeciesPie"); if(!ctx) return;
  const labels = ["Dogs","Cats"];
  const data   = [50,50];
  const colors = [COLORS.amber, COLORS.blue];
  new Chart(ctx, {
    type:"doughnut",
    data:{ labels, datasets:[{ data, backgroundColor:colors, borderColor:"#fff", borderWidth:3, hoverOffset:5 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:"65%",
      plugins:{ legend:{ display:false }, tooltip:{ ...TOOLTIP_DEFAULTS, callbacks:{ label: c=>`  ${c.label}: ${c.parsed}` } } }
    }
  });
  buildLegend("speciesLegend", labels, colors, data, 100);
}

function buildUrgencyBar() {
  const ctx = document.getElementById("chartUrgencyBar"); if(!ctx) return;
  new Chart(ctx, {
    type:"bar",
    data:{
      labels:["Critical","High","Medium","Low"],
      datasets:[{ label:"Requests", data:[4,5,4,2],
        backgroundColor:[COLORS.roseS, COLORS.claySoft, COLORS.amberS, COLORS.greenS],
        borderColor:[COLORS.rose, COLORS.clay, COLORS.amber, COLORS.green],
        borderWidth:2, borderRadius:8, borderSkipped:false }]
    },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }, tooltip:TOOLTIP_DEFAULTS },
      scales:{ x:xAxis(), y:yAxis({ stepSize:2, max:7 }) }
    }
  });
}

// ── ANIMAL ───────────────────────────────────────────
function buildAnimalStage() {
  const ctx = document.getElementById("chartAnimalStage"); if(!ctx) return;
  new Chart(ctx, {
    type:"bar",
    data:{
      labels:["Profiling","Quarantine","Ready"],
      datasets:[
        { label:"Dogs", data:[25,15,10], backgroundColor:COLORS.amberS, borderColor:COLORS.amber, borderWidth:2, borderRadius:6, borderSkipped:false },
        { label:"Cats", data:[25,15,10], backgroundColor:COLORS.blueS,  borderColor:COLORS.blue,  borderWidth:2, borderRadius:6, borderSkipped:false },
      ]
    },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }, tooltip:{ ...TOOLTIP_DEFAULTS, mode:"index", intersect:false } },
      scales:{ x:xAxis(), y:yAxis({ stepSize:10 }) }
    }
  });
}

function buildStay() {
  const ctx = document.getElementById("chartStay"); if(!ctx) return;
  new Chart(ctx, {
    type:"bar",
    data:{
      labels:["0–7d","8–14d","15–30d","31–60d","60+d"],
      datasets:[{ label:"Animals", data:[12,18,32,24,14],
        backgroundColor:[COLORS.greenS,COLORS.blueS,COLORS.amberS,COLORS.claySoft,COLORS.roseS],
        borderColor:[COLORS.green,COLORS.blue,COLORS.amber,COLORS.clay,COLORS.rose],
        borderWidth:2, borderRadius:8, borderSkipped:false }]
    },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }, tooltip:TOOLTIP_DEFAULTS },
      scales:{ x:xAxis(), y:yAxis({ stepSize:10 }) }
    }
  });
}

function buildSexBar() {
  const ctx = document.getElementById("chartSexBar"); if(!ctx) return;
  new Chart(ctx, {
    type:"bar",
    data:{
      labels:["Male Dogs","Female Dogs","Male Cats","Female Cats"],
      datasets:[{ label:"Count", data:[28,22,26,24],
        backgroundColor:[COLORS.amberS,COLORS.claySoft,COLORS.blueS,COLORS.tealS],
        borderColor:[COLORS.amber,COLORS.clay,COLORS.blue,COLORS.teal],
        borderWidth:2, borderRadius:8, borderSkipped:false }]
    },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }, tooltip:TOOLTIP_DEFAULTS },
      scales:{ x:xAxis(), y:yAxis({ stepSize:10 }) }
    }
  });
}

function buildTraitRadar() {
  const ctx = document.getElementById("chartTraitRadar"); if(!ctx) return;
  new Chart(ctx, {
    type:"radar",
    data:{
      labels:["Energy","Exercise","Friendliness","Playfulness","Good w/ Kids","Good w/ Pets","Trainability"],
      datasets:[
        { label:"Dogs (avg)", data:[4.1,4.3,4.0,4.2,3.8,3.9,3.7], borderColor:COLORS.amber, backgroundColor:"rgba(184,106,0,0.12)", pointBackgroundColor:COLORS.amber, pointRadius:4 },
        { label:"Cats (avg)", data:[3.2,2.8,3.9,3.5,3.6,3.4,2.9], borderColor:COLORS.blue,  backgroundColor:"rgba(37,88,168,0.12)",  pointBackgroundColor:COLORS.blue,  pointRadius:4 },
      ]
    },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:true, labels:{ font:{ family:FONT, size:11 }, color:"#5f5e5a", boxWidth:10, usePointStyle:true } }, tooltip:TOOLTIP_DEFAULTS },
      scales:{ r:{ min:1, max:5, ticks:{ stepSize:1, font:{ family:MONO, size:10 }, color:"#b5b0ac", backdropColor:"transparent" }, grid:{ color:"rgba(28,20,20,0.07)" }, pointLabels:{ font:{ family:FONT, size:11 }, color:"#5f5e5a" } } }
    }
  });
}

// ── INTAKE ───────────────────────────────────────────
function buildIntakeWeekly() {
  const ctx = document.getElementById("chartIntakeWeekly"); if(!ctx) return;
  new Chart(ctx, {
    type:"line",
    data:{
      labels:["Jan W1","Jan W2","Jan W3","Jan W4","Feb W1","Feb W2","Feb W3","Feb W4","Mar W1","Mar W2","Mar W3","Mar W4"],
      datasets:[
        { label:"Intake",    data:[3,4,3,5,4,3,5,4,5,6,4,5], borderColor:COLORS.clay, backgroundColor:COLORS.claySoft, tension:0.4, fill:true, pointRadius:4, pointBackgroundColor:COLORS.clay },
        { label:"Approved",  data:[3,4,3,4,4,3,5,3,5,5,4,5], borderColor:COLORS.blue, backgroundColor:COLORS.blueS,   tension:0.4, fill:false,pointRadius:4, pointBackgroundColor:COLORS.blue },
      ]
    },
    options:{ responsive:true, maintainAspectRatio:false, interaction:{ mode:"index", intersect:false },
      plugins:{ legend:{ display:true, labels:{ font:{ family:FONT, size:11 }, color:"#5f5e5a", boxWidth:10, usePointStyle:true } }, tooltip:TOOLTIP_DEFAULTS },
      scales:{ x:xAxis(), y:yAxis({ stepSize:2 }) }
    }
  });
}

function buildIntakeDay() {
  const ctx = document.getElementById("chartIntakeDay"); if(!ctx) return;
  new Chart(ctx, {
    type:"bar",
    data:{
      labels:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
      datasets:[{ label:"Intakes", data:[5,4,6,5,6,11,3],
        backgroundColor:[COLORS.blueS,COLORS.blueS,COLORS.blueS,COLORS.blueS,COLORS.blueS,COLORS.claySoft,COLORS.blueS],
        borderColor:[COLORS.blue,COLORS.blue,COLORS.blue,COLORS.blue,COLORS.blue,COLORS.clay,COLORS.blue],
        borderWidth:2, borderRadius:8, borderSkipped:false }]
    },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }, tooltip:TOOLTIP_DEFAULTS },
      scales:{ x:xAxis(), y:yAxis({ stepSize:4 }) }
    }
  });
}

// ── SURRENDER ────────────────────────────────────────
function buildSurrenderCat() {
  const ctx = document.getElementById("chartSurrenderCat"); if(!ctx) return;
  const labels = ["Medical","Abandonment Risk","Financial","Owner Incapacity","Relocation","Behavioral","Overcrowding","Other"];
  const data   = [4,3,3,2,2,2,1,1];   // n=18 from mock + rounding for chart
  const colors = [COLORS.purple,COLORS.clay,COLORS.amber,COLORS.stone,COLORS.blue,COLORS.rose,COLORS.teal,"#8c8481"];
  new Chart(ctx, {
    type:"bar",
    data:{ labels, datasets:[{ label:"Requests", data, backgroundColor:colors.map(c=>c+"30"), borderColor:colors, borderWidth:2, borderRadius:8, borderSkipped:false }] },
    options:{ indexAxis:"y", responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }, tooltip:TOOLTIP_DEFAULTS },
      scales:{ x:xAxis({ stepSize:1 }), y:{ ...yAxis(), grid:{ display:false } } }
    }
  });
}

function buildSurrenderUrgency() {
  const ctx = document.getElementById("chartSurrenderUrgency"); if(!ctx) return;
  const labels = ["Critical","High","Medium","Low"];
  const data   = [4,5,4,2];
  const colors = [COLORS.rose, COLORS.clay, COLORS.amber, COLORS.green];
  new Chart(ctx, {
    type:"doughnut",
    data:{ labels, datasets:[{ data, backgroundColor:colors.map(c=>c+"33"), borderColor:colors, borderWidth:2, hoverOffset:6 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:"60%",
      plugins:{ legend:{ display:true, position:"right", labels:{ font:{ family:FONT, size:11 }, color:"#5f5e5a", boxWidth:10, usePointStyle:true } }, tooltip:{ ...TOOLTIP_DEFAULTS, callbacks:{ label: c=>`  ${c.label}: ${c.parsed} requests` } } }
    }
  });
}

function buildSurrenderBarangay() {
  const ctx = document.getElementById("chartSurrenderBarangay"); if(!ctx) return;
  new Chart(ctx, {
    type:"bar",
    data:{
      labels:["Balibago","Anunas","Pampang","Malabañas","Sto. Domingo","Pulung Maragul","Cutcut","Pandan"],
      datasets:[{ label:"Requests", data:[3,2,2,2,2,1,1,1],
        backgroundColor:COLORS.claySoft, borderColor:COLORS.clay, borderWidth:2, borderRadius:8, borderSkipped:false }]
    },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }, tooltip:TOOLTIP_DEFAULTS },
      scales:{ x:xAxis(), y:yAxis({ stepSize:1, max:4 }) }
    }
  });
}

// ── MEDICAL ──────────────────────────────────────────
function buildMedTypes() {
  const ctx = document.getElementById("chartMedTypes"); if(!ctx) return;
  new Chart(ctx, {
    type:"bar",
    data:{
      labels:["Deworming","Vaccination","Checkup","Treatment","Quarantine\nClearance","Surgery"],
      datasets:[{ label:"Records", data:[18,14,8,4,2,1],
        backgroundColor:[COLORS.tealS,COLORS.greenS,COLORS.blueS,COLORS.amberS,COLORS.roseS,COLORS.claySoft],
        borderColor:[COLORS.teal,COLORS.green,COLORS.blue,COLORS.amber,COLORS.rose,COLORS.clay],
        borderWidth:2, borderRadius:8, borderSkipped:false }]
    },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }, tooltip:TOOLTIP_DEFAULTS },
      scales:{ x:xAxis(), y:yAxis({ stepSize:5 }) }
    }
  });
}

function buildClearance() {
  const ctx = document.getElementById("chartClearance"); if(!ctx) return;
  const labels = ["Cleared","Pending","On Hold"];
  const data   = [26,18,6];
  const colors = [COLORS.green, COLORS.amber, COLORS.clay];
  new Chart(ctx, {
    type:"doughnut",
    data:{ labels, datasets:[{ data, backgroundColor:colors.map(c=>c+"33"), borderColor:colors, borderWidth:2, hoverOffset:5 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:"65%",
      plugins:{ legend:{ display:false }, tooltip:{ ...TOOLTIP_DEFAULTS, callbacks:{ label: c=>`  ${c.label}: ${c.parsed} animals` } } }
    }
  });
  buildLegend("clearanceLegend", labels, colors, data, 50);
}

// ── ADOPTION ─────────────────────────────────────────
function buildAppTypeCompare() {
  const ctx = document.getElementById("chartAppTypeCompare"); if(!ctx) return;
  new Chart(ctx, {
    type:"bar",
    data:{
      labels:["Applications","Approved","Finalized","Rejected"],
      datasets:[
        { label:"Direct Browse",  data:[12,9,9,2], backgroundColor:COLORS.blueS,  borderColor:COLORS.blue,  borderWidth:2, borderRadius:6, borderSkipped:false },
        { label:"AI Quiz Match",  data:[8,7,7,0],  backgroundColor:COLORS.tealS,  borderColor:COLORS.teal,  borderWidth:2, borderRadius:6, borderSkipped:false },
      ]
    },
    options:{ responsive:true, maintainAspectRatio:false, interaction:{ mode:"index", intersect:false },
      plugins:{ legend:{ display:true, labels:{ font:{ family:FONT, size:11 }, color:"#5f5e5a", boxWidth:10, usePointStyle:true } }, tooltip:TOOLTIP_DEFAULTS },
      scales:{ x:xAxis(), y:yAxis({ stepSize:4 }) }
    }
  });
}

function buildCompatDist() {
  const ctx = document.getElementById("chartCompatDist"); if(!ctx) return;
  new Chart(ctx, {
    type:"bar",
    data:{
      labels:["50–60%","60–70%","70–80%","80–90%","90–100%"],
      datasets:[{ label:"Finalized Adoptions", data:[0,1,2,3,2],
        backgroundColor:[COLORS.stoneS,COLORS.amberS,COLORS.blueS,COLORS.greenS,COLORS.tealS],
        borderColor:[COLORS.stone,COLORS.amber,COLORS.blue,COLORS.green,COLORS.teal],
        borderWidth:2, borderRadius:8, borderSkipped:false }]
    },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }, tooltip:TOOLTIP_DEFAULTS },
      scales:{ x:xAxis(), y:yAxis({ stepSize:1, max:5 }) }
    }
  });
}

function buildAdoptionSpecies() {
  const ctx = document.getElementById("chartAdoptionSpecies"); if(!ctx) return;
  const labels = ["Dogs","Cats"];
  const data   = [11,9];
  const colors = [COLORS.amber, COLORS.blue];
  new Chart(ctx, {
    type:"doughnut",
    data:{ labels, datasets:[{ data, backgroundColor:colors.map(c=>c+"33"), borderColor:colors, borderWidth:2, hoverOffset:5 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:"65%",
      plugins:{ legend:{ display:false }, tooltip:{ ...TOOLTIP_DEFAULTS, callbacks:{ label: c=>`  ${c.label}: ${c.parsed}` } } }
    }
  });
  buildLegend("adoptionSpeciesLegend", labels, colors, data, 20);
}

function buildFunnel() {
  const ctx = document.getElementById("chartFunnel"); if(!ctx) return;
  new Chart(ctx, {
    type:"bar",
    data:{
      labels:["Applications","Under Review","Approved","Finalized"],
      datasets:[{ label:"Applications", data:[20,8,6,4],  backgroundColor:COLORS.claySoft,  borderColor:COLORS.clay,  borderWidth:2, borderRadius:8, borderSkipped:false },
                { label:"Quiz Match",   data:[8,7,6,4],  backgroundColor:COLORS.tealS, borderColor:COLORS.teal, borderWidth:2, borderRadius:8, borderSkipped:false }]
    },
    options:{ responsive:true, maintainAspectRatio:false, interaction:{ mode:"index", intersect:false },
      plugins:{ legend:{ display:true, labels:{ font:{ family:FONT, size:11 }, color:"#5f5e5a", boxWidth:10, usePointStyle:true } }, tooltip:TOOLTIP_DEFAULTS },
      scales:{ x:xAxis(), y:yAxis({ stepSize:5 }) }
    }
  });
}

/* ══════════════════════════════════════════════════════
   BUILD ALL CHARTS FOR VISIBLE TAB
══════════════════════════════════════════════════════ */
const builtCharts = new Set();

function buildChartsForTab(tab) {
  if (builtCharts.has(tab)) return;
  builtCharts.add(tab);

  switch(tab) {
    case "overview":
      buildOverviewTrend(); buildStatusDonut(); buildSourceDonut();
      buildSpeciesPie(); buildUrgencyBar();
      break;
    case "animal":
      buildAnimalStage(); buildStay(); buildSexBar(); buildTraitRadar();
      break;
    case "intake":
      buildIntakeWeekly(); buildIntakeDay();
      break;
    case "surrender":
      buildSurrenderCat(); buildSurrenderUrgency(); buildSurrenderBarangay();
      break;
    case "medical":
      buildMedTypes(); buildClearance();
      break;
    case "adoption":
      buildAppTypeCompare(); buildCompatDist(); buildAdoptionSpecies(); buildFunnel();
      break;
  }
}

/* ══════════════════════════════════════════════════════
   TABS
══════════════════════════════════════════════════════ */
function bindTabs() {
  document.querySelectorAll(".report-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".report-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".report-content").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.getElementById(`tab-${tab}`)?.classList.add("active");
      // Defer chart build to after the tab is visible
      requestAnimationFrame(() => buildChartsForTab(tab));
    });
  });
}

/* ══════════════════════════════════════════════════════
   EXPORT (MOCK)
══════════════════════════════════════════════════════ */
function bindExport() {
  document.getElementById("btnExportPDF")?.addEventListener("click", () => {
    showToast("info", "PDF export is not yet connected to the backend. This is a mock action.");
  });
  document.getElementById("btnExportCSV")?.addEventListener("click", () => {
    // Generate a simple mock CSV for the overview
    const rows = [
      ["Report","ANIMUA Shelter — Q1 2025 Overview"],
      ["Generated","2025-03-31"],
      [""],
      ["Metric","Value","Change vs Prior Period"],
      ["Total Animals","100","+18%"],
      ["In Profiling","50","50%"],
      ["In Quarantine","30","30%"],
      ["Ready for Adoption","20","—"],
      ["Surrender Requests","15","+2"],
      ["Critical Urgency Cases","4","—"],
      ["Medical Records","47","—"],
      ["Adoption Applications","20","—"],
      ["Finalized Adoptions","8","—"],
      ["Adoption Rate","68%","+5pp"],
      ["Avg Length of Stay","24 days","−3 days"],
      ["Quarantine Clearance Rate","85%","+4pp"],
      ["NLP Avg Confidence","87%","Mock"],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "animua-report-q1-2025.csv";
    a.click(); URL.revokeObjectURL(url);
    showToast("success","CSV downloaded — animua-report-q1-2025.csv");
  });

  document.getElementById("reportPeriod")?.addEventListener("change", e => {
    showToast("info", `Showing mock data for ${e.target.options[e.target.selectedIndex].text}. Real data pending API connection.`);
  });
}

/* ══════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════ */
let toastT;
function showToast(type, msg) {
  const t=document.getElementById("umToast"),i=document.getElementById("toastIcon"),m=document.getElementById("toastMsg"); if(!t) return;
  const icons={success:"bi-check-circle-fill",error:"bi-x-circle-fill",info:"bi-info-circle-fill"};
  t.className=`um-toast toast-${type}`; i.className=`bi ${icons[type]||"bi-info-circle-fill"}`; m.textContent=msg;
  t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),4000);
}


/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */
async function init() {
  try {
    await protectManagementPage();
    renderTopbarUser();
    loadSidebar(); 

    bindTabs();
    bindExport();
    // Build overview charts (first active tab) after paint
    requestAnimationFrame(() => buildChartsForTab("overview"));
    document.body.classList.remove("loading");
  } catch(err) {
    console.error("Reports init failed:", err);
    document.body.classList.remove("loading");
  }
}

window.addEventListener("DOMContentLoaded", init);