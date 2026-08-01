import "../css/reports.css";
import "../css/managementTables.css";
import "../css/recordsPanelReference.css";
import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { renderPageHeader } from "../components/management/pageHeader.js";
import { PAGE_HEADER_CONFIGS } from "../components/management/pageHeaderConfigs.js";
import { apiFetch } from "../utils/api.js";

const CONFIG = {
  intake: { label: "Animal Intake", description: "Incoming animals and intake conversion", icon: "bi-box-arrow-in-down", tone: "amber", columns: [["date", "Intake Date"], ["id", "Intake ID"], ["animal", "Description"], ["source", "Source"], ["species", "Species"], ["status", "Intake Status"], ["conversion", "Conversion"], ["location", "Location"]] },
  status: { label: "Animal Status", description: "Care stages and adoption readiness", icon: "bi-heart-pulse-fill", tone: "blue", columns: [["date", "Intake Date"], ["id", "Animal ID"], ["animal", "Description"], ["species", "Species"], ["status", "Current Status"], ["clearance", "Clearance"], ["assessment", "Behavioral Assessment"]] },
  adoption: { label: "Adoption", description: "Applications, approvals, and placements", icon: "bi-balloon-heart-fill", tone: "rose", columns: [["date", "Submitted"], ["id", "Application ID"], ["animalId", "Animal ID"], ["animal", "Shelter Description"], ["applicant", "Applicant"], ["contact", "Contact"], ["source", "Source"], ["status", "Status"], ["adoptionDate", "Adoption Date"], ["adoptedName", "Adopter-Given Name"]] },
  medical: { label: "Medical & Quarantine", description: "Clinical activity and animal clearance", icon: "bi-clipboard2-pulse-fill", tone: "green", columns: [["date", "Date"], ["animalId", "Animal ID"], ["animal", "Description"], ["type", "Record Type"], ["veterinarian", "Veterinarian"], ["diagnosis", "Diagnosis"], ["treatment", "Treatment"], ["inventoryItem", "Inventory Used"], ["quantityUsed", "Qty"], ["clearance", "Clearance"]] },
  inventory: { label: "Inventory Usage", description: "Consumed stock and remaining supply", icon: "bi-box-seam-fill", tone: "stone", columns: [["date", "Usage Date"], ["inventoryItem", "Item"], ["quantityUsed", "Qty Used"], ["unit", "Unit"], ["remainingStock", "Remaining"], ["stockStatus", "Stock Status"], ["animalId", "Animal ID"], ["animal", "Description"], ["type", "Procedure"], ["veterinarian", "Veterinarian"]] },
  surrender: { label: "Surrender Requests", description: "Owner requests, urgency, and outcomes", icon: "bi-file-earmark-text-fill", tone: "teal", columns: [["date", "Submitted"], ["id", "Request ID"], ["owner", "Owner"], ["barangay", "Barangay"], ["animal", "Animal Description"], ["species", "Species"], ["category", "NLP Category"], ["urgency", "Urgency"], ["status", "Status"]] },
};

let payload = { available: [], reports: {} };
let active = "";
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const text = (value) => value === null || value === undefined || value === "" ? "?" : String(value);

function workspace() {
  document.querySelector(".page-body").innerHTML = `
    <div id="pageHeaderMount"></div>
    <section class="report-command-card">
      <div class="command-card-heading"><span class="command-icon"><i class="bi bi-sliders"></i></span><div><span>Report controls</span><h2>Focus the operational view</h2><p>Select a reporting period, then search within the active dataset.</p></div></div>
      <div class="report-filter-grid">
        <label><span>From date</span><div class="report-input"><i class="bi bi-calendar3"></i><input type="date" id="dateFrom"></div></label>
        <label><span>To date</span><div class="report-input"><i class="bi bi-calendar3"></i><input type="date" id="dateTo"></div></label>
        <label class="report-search-field"><span>Search current report</span><div class="report-input"><i class="bi bi-search"></i><input type="search" id="reportSearch" placeholder="Search any field"></div></label>
        <button class="report-apply-btn" id="btnApply"><i class="bi bi-funnel-fill"></i><span>Apply period</span></button>
        <button class="report-clear-btn" id="btnClear" aria-label="Clear report filters"><i class="bi bi-arrow-counterclockwise"></i></button>
      </div>
    </section>
    <section class="report-catalog-section"><div class="section-heading"><div><span class="section-kicker">Report catalog</span><h2>Choose a live operational dataset</h2></div><span class="live-data-pill"><i></i> Live shelter data</span></div><div class="report-tabs" id="liveReportTabs"></div></section>
    <section class="report-overview-grid"><div class="report-summary-grid" id="reportSummary"></div><aside class="report-insight-card" id="reportInsight"></aside></section>
    <section class="rpt-card report-data-card"><div class="rpt-card-head"><div><span class="section-kicker">Detailed records</span><h3 id="reportTitle">Operational report</h3><p id="reportMeta">Loading live records?</p></div><span class="table-record-count" id="tableRecordCount">0 rows</span></div><div class="table-responsive report-table-wrap"><table class="rpt-table"><thead><tr id="reportHead"></tr></thead><tbody id="reportBody"><tr><td class="text-center py-5"><div class="um-spinner"></div></td></tr></tbody></table></div><div class="report-table-footer" id="reportTableFooter">Live data is shown exactly as recorded by shelter workflows.</div></section>`;
}

async function load() {
  const from = document.getElementById("dateFrom").value;
  const to = document.getElementById("dateTo").value;
  if (from && to && from > to) throw new Error("The From date cannot be later than the To date.");
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  document.getElementById("btnApply")?.classList.add("is-loading");
  try {
    payload = await apiFetch(`/reports${query.size ? `?${query.toString()}` : ""}`);
    if (!payload.available.includes(active)) active = payload.available[0] || "";
    tabs();
    render();
  } finally {
    document.getElementById("btnApply")?.classList.remove("is-loading");
  }
}

function tabs() {
  const target = document.getElementById("liveReportTabs");
  target.innerHTML = payload.available.map((key) => {
    const config = CONFIG[key];
    const count = payload.reports[key]?.length || 0;
    return `<button class="report-tab tone-${config.tone} ${key === active ? "active" : ""}" data-report="${key}"><span class="report-tab-icon"><i class="bi ${config.icon}"></i></span><span class="report-tab-copy"><strong>${esc(config.label)}</strong><small>${esc(config.description)}</small></span><span class="report-tab-count">${count}</span></button>`;
  }).join("");
  target.querySelectorAll("[data-report]").forEach((button) => button.addEventListener("click", () => { active = button.dataset.report; tabs(); render(); }));
}

function rows() {
  const query = document.getElementById("reportSearch").value.toLowerCase().trim();
  const list = payload.reports[active] || [];
  return query ? list.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(query))) : list;
}

function pillClass(value = "") {
  const normalized = String(value).toLowerCase();
  if (/ready|approved|success|clear|converted|completed|normal|adequate/.test(normalized)) return "is-positive";
  if (/pending|profiling|warning|low|review|moderate/.test(normalized)) return "is-warning";
  if (/failed|rejected|critical|quarantine|missing|urgent/.test(normalized)) return "is-danger";
  return "is-neutral";
}

function cellMarkup(key, value) {
  const safe = esc(text(value));
  if (/^(status|clearance|stockStatus|conversion|urgency|category|source|species)$/.test(key)) return `<span class="report-value-pill ${pillClass(value)}">${safe}</span>`;
  if (/^(id|animalId)$/.test(key)) return `<span class="report-id">${safe}</span>`;
  return safe;
}

function summary(list) {
  const config = CONFIG[active];
  const counts = {};
  list.forEach((row) => { const label = row.status || row.clearance || row.stockStatus || ""; if (label && label !== "N/A") counts[label] = (counts[label] || 0) + 1; });
  const cards = [{ label: "Visible records", value: list.length, icon: "bi-list-check", tone: config.tone }, ...Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, value], index) => ({ label, value, icon: ["bi-check2-circle", "bi-activity", "bi-flag"][index], tone: ["green", "amber", "rose"][index] }))];
  while (cards.length < 4) cards.push({ label: "Tracked fields", value: config.columns.length, icon: "bi-columns-gap", tone: "stone" });
  document.getElementById("reportSummary").innerHTML = cards.slice(0, 4).map((card) => `<article class="rpt-kpi tone-${card.tone}"><span class="rpt-kpi-icon"><i class="bi ${card.icon}"></i></span><div><div class="rpt-kpi-val">${card.value}</div><div class="rpt-kpi-lbl">${esc(card.label)}</div></div></article>`).join("");
}

function renderInsight(list) {
  const config = CONFIG[active];
  const allCells = list.length * config.columns.length;
  const completed = list.reduce((total, row) => total + config.columns.filter(([key]) => text(row[key]) !== "?").length, 0);
  const completeness = allCells ? Math.round((completed / allCells) * 100) : 0;
  document.getElementById("reportInsight").innerHTML = `<span class="insight-icon"><i class="bi bi-stars"></i></span><div><span class="section-kicker">Reporting insight</span><h3>${esc(config.label)} is ready for review</h3><p>${list.length ? `${list.length} live record${list.length === 1 ? "" : "s"} match the current filters, with ${completeness}% field completeness.` : "No live records match this period and search combination."}</p><div class="completeness-row"><span><i style="width:${completeness}%"></i></span><strong>${completeness}%</strong><small>data completeness</small></div></div>`;
}

function render() {
  const config = CONFIG[active];
  if (!config) return;
  const list = rows();
  const allCount = Object.values(payload.reports).reduce((total, records) => total + (Array.isArray(records) ? records.length : 0), 0);
  [["reportSourceCount", payload.available.length], ["reportAllCount", allCount], ["reportVisibleCount", list.length], ["heroReportCount", list.length]].forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
  document.getElementById("reportTitle").textContent = `${config.label} report`;
  document.getElementById("reportMeta").textContent = `Generated ${new Date(payload.generatedAt).toLocaleString("en-PH")} ? ${config.description}`;
  document.getElementById("tableRecordCount").textContent = `${list.length} row${list.length === 1 ? "" : "s"}`;
  document.getElementById("reportHead").innerHTML = config.columns.map(([, label]) => `<th>${esc(label)}</th>`).join("");
  document.getElementById("reportBody").innerHTML = list.length ? list.map((row) => `<tr>${config.columns.map(([key]) => `<td>${cellMarkup(key, row[key])}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${config.columns.length}"><div class="report-empty-state"><span><i class="bi bi-bar-chart"></i></span><strong>No matching report records</strong><small>Adjust the date range or clear the current search to broaden this dataset.</small></div></td></tr>`;
  document.getElementById("reportTableFooter").textContent = `Showing ${list.length} of ${(payload.reports[active] || []).length} records in ${config.label}.`;
  summary(list);
  renderInsight(list);
}

function csv() {
  const config = CONFIG[active];
  const list = rows();
  if (!config || !list.length) return;
  const quote = (value) => `"${text(value).replaceAll('"', '""')}"`;
  const content = [config.columns.map(([, label]) => quote(label)).join(","), ...list.map((row) => config.columns.map(([key]) => quote(row[key])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `animua-${active}-report-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
}

function error(errorValue) {
  console.error(errorValue);
  const body = document.getElementById("reportBody");
  if (body) body.innerHTML = `<tr><td><div class="report-empty-state is-error"><span><i class="bi bi-cloud-slash"></i></span><strong>Unable to load this report</strong><small>${esc(errorValue.message)}</small></div></td></tr>`;
}

async function init() {
  try {
    await protectManagementPage(); renderTopbarUser(); loadSidebar(); workspace(); renderPageHeader(PAGE_HEADER_CONFIGS.reports);
    const now = new Date(); document.getElementById("dateFrom").value = `${now.getFullYear()}-01-01`; document.getElementById("dateTo").value = now.toISOString().slice(0, 10);
    document.getElementById("btnApply").addEventListener("click", () => load().catch(error));
    document.getElementById("btnClear").addEventListener("click", () => { document.getElementById("dateFrom").value = ""; document.getElementById("dateTo").value = ""; document.getElementById("reportSearch").value = ""; load().catch(error); });
    document.getElementById("reportSearch").addEventListener("input", render);
    document.getElementById("btnCsv").addEventListener("click", csv);
    document.getElementById("btnPrint").addEventListener("click", () => window.print());
    await load();
  } catch (errorValue) { error(errorValue); } finally { document.body.classList.remove("loading"); }
}

window.addEventListener("DOMContentLoaded", init);
