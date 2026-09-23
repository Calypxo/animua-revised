import "../css/reports.css";
import "../css/managementTables.css";
import "../css/recordsPanelReference.css";
import { protectManagementPage } from "../auth/authGuard.js";
import { getUserName, getUserRole } from "../utils/storage.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { renderPageHeader } from "../components/management/pageHeader.js";
import { PAGE_HEADER_CONFIGS } from "../components/management/pageHeaderConfigs.js";
import { showManagementNotice } from "../components/management/managementAlerts.js";
import { apiFetch } from "../utils/api.js";
import { BARANGAYS } from "../utils/barangays.js";
import { REPORT_CONFIG as CONFIG, summaryCards, dimensionCounts } from "../utils/reports/reportConfig.js";
import { buildReportData, formatReportingPeriod } from "../utils/reports/buildReportData.js";

const CHART_COLORS = ["#780116", "#D1601E", "#186534", "#0A1D4B", "#B86A00", "#0D6E6E", "#8C8481"];
let payload = { available: [], reports: {}, generatedAt: new Date().toISOString() };
let active = "";
let trendChart;
let breakdownChart;
let activePage = 1;
const pageSize = 12;
let exporting = false;
let loading = false;
let reportReady = false;
let appliedPeriod = null;
let loadVersion = 0;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const text = (value) => value === null || value === undefined || value === "" ? "—" : String(value);
const localDate = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

function workspace() {
  document.querySelector(".page-body").innerHTML = `
    <div class="reports-workspace">
      <div id="pageHeaderMount"></div>
      <section class="report-command-card" aria-labelledby="reportControlsTitle">
        <div class="command-card-heading"><span class="command-icon" aria-hidden="true"><i class="bi bi-sliders"></i></span><div><span>Report controls</span><h2 id="reportControlsTitle">Focus the operational view</h2><p>Use a quick period or set exact dates, then search inside the selected dataset.</p></div></div>
        <div class="report-preset-row" aria-label="Quick reporting periods">
          <span>Quick period</span>
          <button type="button" data-period="30">Last 30 days</button>
          <button type="button" data-period="90">Last 90 days</button>
          <button type="button" data-period="ytd" class="active">Year to date</button>
          <button type="button" data-period="all">All records</button>
          <small id="activePeriodLabel">Year to date</small>
        </div>
        <div class="report-filter-grid">
          <label><span>From date</span><div class="report-input"><i class="bi bi-calendar3"></i><input type="date" id="dateFrom"></div></label>
          <label><span>To date</span><div class="report-input"><i class="bi bi-calendar3"></i><input type="date" id="dateTo"></div></label>
          <label><span>Barangay</span><div class="report-input"><i class="bi bi-geo-alt"></i><select id="barangayFilter" aria-label="Filter report by barangay"><option value="">All barangays</option></select></div></label>
          <label class="report-search-field"><span>Search current report</span><div class="report-input"><i class="bi bi-search"></i><input type="search" id="reportSearch" placeholder="Animal, status, staff, barangay…"></div></label>
          <button class="report-apply-btn" id="btnApply" type="button"><i class="bi bi-funnel-fill"></i><span>Apply period</span></button>
          <button class="report-clear-btn" id="btnClear" type="button" aria-label="Clear all report filters" title="Clear filters"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i><span>Reset</span></button>
        </div>
      </section>
      <section class="report-catalog-section"><div class="section-heading"><div><span class="section-kicker">Report catalog</span><h2>Choose a live operational dataset</h2></div><span class="live-data-pill"><i></i> Live shelter data</span></div><div class="report-tabs" id="liveReportTabs" role="tablist" aria-label="Operational report datasets"></div></section>
      <section class="report-overview-section" aria-labelledby="reportOverviewTitle">
        <div class="section-heading report-overview-heading"><div><span class="section-kicker">Management snapshot</span><h2 id="reportOverviewTitle">What the current report is showing</h2></div><span class="current-dataset-pill" id="currentDatasetLabel">Live report</span></div>
        <div class="report-overview-grid"><div class="report-summary-grid" id="reportSummary"></div><aside class="report-insight-card" id="reportInsight"></aside></div>
      </section>
      <section class="report-analytics-grid" aria-label="Report visual analysis">
        <article class="rpt-card report-chart-card">
          <div class="rpt-card-head"><div><span class="section-kicker">Movement over time</span><h3>Operational trend</h3><p id="trendChartMeta">Records grouped by reporting period</p></div><span class="chart-context-pill" id="trendTotal">0 events</span></div>
          <div class="report-chart-wrap"><canvas id="reportTrendChart" role="img" aria-label="Operational records over time"></canvas></div>
        </article>
        <article class="rpt-card report-chart-card">
          <div class="rpt-card-head"><div><span class="section-kicker">Current composition</span><h3 id="breakdownTitle">Status breakdown</h3><p>Share of records in the current view</p></div></div>
          <div class="report-doughnut-layout"><div class="report-doughnut-wrap"><canvas id="reportBreakdownChart" role="img" aria-label="Current report category breakdown"></canvas><div class="chart-center-label"><strong id="breakdownTotal">0</strong><span>records</span></div></div><div class="report-chart-legend" id="reportChartLegend"></div></div>
        </article>
      </section>
      <section class="rpt-card report-data-card" id="reportDataPanel" role="tabpanel">
        <div class="reference-table-section-head report-records-head"><div><span>Detailed records</span><h3 id="reportTitle">Operational report</h3><p id="reportMeta">Loading live records…</p></div><strong class="table-record-count" id="tableRecordCount" aria-live="polite">0 records</strong></div>
        <div class="table-responsive report-table-wrap"><table class="shelter-table rpt-table report-reference-table management-data-table management-card-table" data-card-until="1439" aria-describedby="reportMeta"><caption class="visually-hidden" id="reportTableCaption">Detailed operational report records</caption><thead><tr id="reportHead"></tr></thead><tbody id="reportBody"><tr><td colspan="8" class="text-center py-5"><div class="um-spinner"></div></td></tr></tbody></table></div>
        <div class="um-pagination report-table-footer"><span class="page-info" id="reportTableFooter">Live data is shown exactly as recorded by shelter workflows.</span><div class="report-pagination" id="reportPagination" aria-label="Report table pagination"></div></div>
      </section>
    </div>`;
}

function periodLabel() {
  return formatReportingPeriod(appliedPeriod?.from, appliedPeriod?.to);
}

function selectedPeriodIsApplied() {
  return appliedPeriod
    && document.getElementById("dateFrom").value === appliedPeriod.from
    && document.getElementById("dateTo").value === appliedPeriod.to;
}

function syncExportButtons() {
  const disabled = exporting || loading || !reportReady || !CONFIG[active] || !selectedPeriodIsApplied();
  for (const id of ["btnPrint", "btnExcel"]) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.disabled = Boolean(disabled);
    button.setAttribute("aria-busy", String(exporting));
    button.title = exporting ? "Generating report…"
      : !selectedPeriodIsApplied() ? "Apply the selected period before exporting."
      : !reportReady ? "Load a report before exporting." : "";
  }
}

function setPresetActive(value) {
  document.querySelectorAll("[data-period]").forEach((button) => button.classList.toggle("active", button.dataset.period === value));
}

function applyPreset(value) {
  activePage = 1;
  const today = new Date();
  const from = document.getElementById("dateFrom");
  const to = document.getElementById("dateTo");
  to.value = value === "all" ? "" : localDate(today);
  if (value === "all") from.value = "";
  else if (value === "ytd") from.value = `${today.getFullYear()}-01-01`;
  else {
    const start = new Date(today);
    start.setDate(start.getDate() - (Number(value) - 1));
    from.value = localDate(start);
  }
  setPresetActive(value);
  load().catch(showError);
}

async function load() {
  const version = ++loadVersion;
  const from = document.getElementById("dateFrom").value;
  const to = document.getElementById("dateTo").value;
  reportReady = false;
  loading = false;
  syncExportButtons();
  if (from && to && from > to) {
    document.getElementById("btnApply")?.classList.remove("is-loading");
    document.getElementById("reportDataPanel")?.setAttribute("aria-busy", "false");
    throw new Error("The From date cannot be later than the To date.");
  }
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  loading = true;
  syncExportButtons();
  document.getElementById("btnApply")?.classList.add("is-loading");
  document.getElementById("reportDataPanel")?.setAttribute("aria-busy", "true");
  try {
    const result = await apiFetch(`/reports${query.size ? `?${query.toString()}` : ""}`);
    if (version !== loadVersion) return;
    payload = result;
    appliedPeriod = { from, to };
    reportReady = true;
    if (!payload.available.includes(active)) active = payload.available[0] || "";
    tabs();
    render();
  } catch (error) {
    if (version === loadVersion) throw error;
  } finally {
    if (version === loadVersion) {
      loading = false;
      syncExportButtons();
      document.getElementById("btnApply")?.classList.remove("is-loading");
      document.getElementById("reportDataPanel")?.setAttribute("aria-busy", "false");
    }
  }
}

function tabs({ focusActive = false, smooth = false } = {}) {
  const target = document.getElementById("liveReportTabs");
  target.innerHTML = payload.available.map((key) => {
    const config = CONFIG[key];
    const count = payload.reports[key]?.length || 0;
    return `<button class="report-tab tone-${config.tone} ${key === active ? "active" : ""}" id="report-tab-${key}" type="button" data-report="${key}" role="tab" aria-selected="${key === active}" aria-controls="reportDataPanel"><span class="report-tab-icon" aria-hidden="true"><i class="bi ${config.icon}"></i></span><span class="report-tab-copy"><strong>${esc(config.label)}</strong><small>${esc(config.description)}</small></span><span class="report-tab-count" aria-label="${count} records">${count}</span></button>`;
  }).join("");
  target.querySelectorAll("[data-report]").forEach((button) => button.addEventListener("click", () => {
    active = button.dataset.report;
    activePage = 1;
    tabs({ focusActive: true, smooth: true });
    render();
  }));
  const activeButton = [...target.querySelectorAll("[data-report]")]
    .find((button) => button.dataset.report === active);
  if (focusActive) activeButton?.focus({ preventScroll: true });
  activeButton?.scrollIntoView?.({ behavior: smooth ? "smooth" : "auto", block: "nearest", inline: "nearest" });
}

function rows() {
  const query = document.getElementById("reportSearch").value.toLowerCase().trim();
  const barangay = document.getElementById("barangayFilter")?.value || "";
  let list = payload.reports[active] || [];
  if (barangay) {
    const selectedBarangay = normalizeBarangay(barangay);
    list = list.filter((row) => normalizeBarangay(barangayForRow(row)) === selectedBarangay);
  }
  return query ? list.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(query))) : list;
}

function normalizeBarangay(value) {
  return String(value || "")
    .trim()
    .replace(/^barangay\s+/i, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-PH");
}

function barangayForRow(row = {}) {
  if (String(row.barangay || "").trim()) return row.barangay;
  const location = normalizeBarangay(row.location || row.intakeLocation);
  if (!location) return "";
  return [...BARANGAYS]
    .sort((left, right) => right.length - left.length)
    .find((barangay) => location.includes(normalizeBarangay(barangay))) || "";
}

function syncBarangayFilter() {
  const select = document.getElementById("barangayFilter");
  if (!select) return;
  const previous = select.value;
  const recordedBarangays = (payload.reports[active] || []).map(barangayForRow).filter(Boolean);
  const barangays = [...new Set([...BARANGAYS, ...recordedBarangays])]
    .sort((left, right) => left.localeCompare(right));
  select.innerHTML = `<option value="">All barangays</option>${barangays.map((barangay) => `<option value="${esc(barangay)}">${esc(barangay)}</option>`).join("")}`;
  const previousMatch = barangays.find((barangay) => normalizeBarangay(barangay) === normalizeBarangay(previous));
  select.value = previousMatch || "";
  select.disabled = false;
}

function pillClass(value = "") {
  const normalized = String(value).toLowerCase();
  if (/ready|approved|success|clear|converted|completed|normal|adequate|finalized/.test(normalized)) return "is-positive";
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

function renderSummary(list) {
  document.getElementById("reportSummary").innerHTML = summaryCards(active, list).map((card) => `<article class="rpt-kpi tone-${card.tone}"><span class="rpt-kpi-icon"><i class="bi ${card.icon}"></i></span><div><div class="rpt-kpi-val">${esc(card.value)}</div><div class="rpt-kpi-lbl">${esc(card.label)}</div></div></article>`).join("");
}

function renderInsight(list) {
  const config = CONFIG[active];
  const cards = summaryCards(active, list);
  const completeness = cards.find((card) => card.label === "Data completeness")?.value || "0%";
  const topGroup = dimensionCounts(active, list)[0];
  const signal = topGroup ? `${topGroup[0]} is the largest ${config.dimensionLabel.toLowerCase()} group (${topGroup[1]} of ${list.length}).` : "No dominant group is available for this view.";
  document.getElementById("reportInsight").innerHTML = `<span class="insight-icon"><i class="bi bi-stars"></i></span><div><span class="section-kicker">Management insight</span><h3>${esc(config.label)} at a glance</h3><p>${list.length ? `${esc(signal)} Use the trend and breakdown below to identify changes that need follow-up.` : "No live records match this period and search combination."}</p><div class="completeness-row"><span><i style="width:${esc(completeness)}"></i></span><strong>${esc(completeness)}</strong><small>data completeness</small></div></div>`;
}

function chart(canvasId, previous, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return previous;
  previous?.destroy();
  return new Chart(canvas, config);
}

function timeline(list) {
  const counts = new Map();
  list.forEach((row) => {
    if (!row.date) return;
    const key = String(row.date).slice(0, 7);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function renderCharts(list) {
  const config = CONFIG[active];
  const time = timeline(list);
  const breakdown = dimensionCounts(active, list).slice(0, 7);
  const barangayRanking = active === "barangay";
  trendChart = chart("reportTrendChart", trendChart, {
    type: "line",
    data: { labels: time.map(([key]) => new Date(`${key}-01T00:00:00`).toLocaleDateString("en-PH", { month: "short", year: "2-digit" })), datasets: [{ label: config.label, data: time.map(([, count]) => count), borderColor: "#780116", backgroundColor: "rgba(120,1,22,.10)", borderWidth: 2.5, pointBackgroundColor: "#FFFFFF", pointBorderColor: "#780116", pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: .35, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: "index" }, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#2D2322", padding: 11, displayColors: false } }, scales: { x: { grid: { display: false }, ticks: { color: "#81746D", font: { family: "Poppins", size: 10 } } }, y: { beginAtZero: true, ticks: { precision: 0, color: "#81746D", font: { family: "Poppins", size: 10 } }, grid: { color: "rgba(120,1,22,.06)" } } } },
  });
  breakdownChart = chart("reportBreakdownChart", breakdownChart, {
    type: barangayRanking ? "bar" : "doughnut",
    data: { labels: breakdown.map(([label]) => label), datasets: [{ data: breakdown.map(([, count]) => count), backgroundColor: CHART_COLORS, borderColor: barangayRanking ? CHART_COLORS : "#FFFFFF", borderWidth: barangayRanking ? 0 : 3, borderRadius: barangayRanking ? 7 : 0, hoverOffset: barangayRanking ? 0 : 5 }] },
    options: barangayRanking
      ? { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#2D2322", padding: 11, displayColors: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0, color: "#81746D", font: { family: "Poppins", size: 9 } }, grid: { color: "rgba(120,1,22,.06)" } }, y: { grid: { display: false }, ticks: { color: "#594D48", font: { family: "Poppins", size: 9, weight: "600" } } } } }
      : { responsive: true, maintainAspectRatio: false, cutout: "70%", plugins: { legend: { display: false }, tooltip: { backgroundColor: "#2D2322", padding: 11 } } },
  });
  document.getElementById("trendTotal").textContent = `${list.length} event${list.length === 1 ? "" : "s"}`;
  document.getElementById("trendChartMeta").textContent = time.length ? `${time.length} active month${time.length === 1 ? "" : "s"} in ${periodLabel().toLowerCase()}` : "No dated activity in this view";
  document.getElementById("breakdownTitle").textContent = config.dimensionLabel;
  document.getElementById("breakdownTotal").textContent = list.length;
  document.querySelector(".report-doughnut-wrap")?.classList.toggle("is-ranking", barangayRanking);
  document.getElementById("reportChartLegend").innerHTML = breakdown.length ? breakdown.map(([label, count], index) => `<div><i style="background:${CHART_COLORS[index]}"></i><span><strong>${esc(label)}</strong><small>${count} · ${list.length ? Math.round((count / list.length) * 100) : 0}%</small></span></div>`).join("") : `<p class="text-muted mb-0">No categories to display.</p>`;
}

function paginationItems(totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, activePage - 1, activePage, activePage + 1]);
  const sorted = [...pages].filter((page) => page > 0 && page <= totalPages).sort((left, right) => left - right);
  const items = [];
  sorted.forEach((page, index) => {
    if (index && page - sorted[index - 1] > 1) items.push("ellipsis");
    items.push(page);
  });
  return items;
}

function renderPagination(totalRecords) {
  const target = document.getElementById("reportPagination");
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  activePage = Math.min(activePage, totalPages);
  target.innerHTML = `
    <div class="report-page-buttons">
      <button type="button" class="page-btn" data-page="${activePage - 1}" ${activePage === 1 ? "disabled" : ""} aria-label="Previous page"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
      ${paginationItems(totalPages).map((item) => item === "ellipsis" ? '<span class="page-ellipsis" aria-hidden="true">&hellip;</span>' : `<button type="button" data-page="${item}" class="page-btn ${item === activePage ? "active" : ""}" aria-label="Page ${item}" ${item === activePage ? 'aria-current="page"' : ""}>${item}</button>`).join("")}
      <button type="button" class="page-btn" data-page="${activePage + 1}" ${activePage === totalPages ? "disabled" : ""} aria-label="Next page"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
    </div>`;
}

function reportPrimaryKey(config) {
  if (active === "inventory") return "inventoryItem";
  return config.columns.find(([key]) => key === "id")?.[0]
    || config.columns.find(([key]) => key === "animalId")?.[0]
    || config.columns[0]?.[0];
}

function render() {
  const config = CONFIG[active];
  if (!config || !reportReady) return;
  syncBarangayFilter();
  const list = rows();
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  activePage = Math.min(activePage, totalPages);
  const firstRecord = list.length ? (activePage - 1) * pageSize + 1 : 0;
  const pageRows = list.slice(firstRecord - 1, firstRecord - 1 + pageSize);
  const allCount = Object.values(payload.reports).reduce((total, records) => total + (Array.isArray(records) ? records.length : 0), 0);
  [["reportSourceCount", payload.available.length], ["reportAllCount", allCount], ["reportVisibleCount", list.length], ["heroReportCount", list.length]].forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
  document.getElementById("activePeriodLabel").textContent = periodLabel();
  document.getElementById("currentDatasetLabel").textContent = config.label;
  document.getElementById("reportDataPanel").setAttribute("aria-labelledby", `report-tab-${active}`);
  document.getElementById("reportTitle").textContent = `${config.label} report`;
  document.getElementById("reportTableCaption").textContent = `${config.label} report records for ${periodLabel()}`;
  document.getElementById("reportMeta").textContent = `Generated ${new Date(payload.generatedAt).toLocaleString("en-PH")} · ${config.description}`;
  document.getElementById("tableRecordCount").textContent = `${list.length} record${list.length === 1 ? "" : "s"}`;
  document.getElementById("reportHead").innerHTML = config.columns.map(([key, label]) => `<th class="report-column-${esc(key)}" scope="col">${esc(label)}</th>`).join("");
  const primaryKey = reportPrimaryKey(config);
  document.getElementById("reportBody").innerHTML = list.length ? pageRows.map((row) => `<tr class="management-card-row report-record-card">${config.columns.map(([key, label]) => `<td class="report-cell report-cell-${esc(key)} ${key === primaryKey ? "management-card-primary report-card-identity" : ""}"><span class="management-mobile-label" aria-hidden="true">${esc(label)}</span><span class="report-cell-value">${cellMarkup(key, row[key])}</span></td>`).join("")}</tr>`).join("") : `<tr><td colspan="${config.columns.length}"><div class="report-empty-state"><span><i class="bi bi-bar-chart"></i></span><strong>No matching report records</strong><small>Adjust the date range, barangay, or search to broaden this dataset.</small></div></td></tr>`;
  const lastRecord = Math.min(firstRecord + pageRows.length - 1, list.length);
  document.getElementById("reportTableFooter").textContent = list.length
    ? `Showing ${firstRecord}–${lastRecord} of ${list.length} filtered records (${(payload.reports[active] || []).length} total in ${config.label}).`
    : "No records match the current date, barangay, and search filters.";
  renderPagination(list.length);
  renderSummary(list);
  renderInsight(list);
  renderCharts(list);
  syncExportButtons();
}

async function exportSelectedReport(format) {
  if (exporting || loading || !reportReady || !CONFIG[active] || !selectedPeriodIsApplied()) return;
  exporting = true;
  syncExportButtons();
  const button = document.getElementById(format === "pdf" ? "btnPrint" : "btnExcel");
  const originalContent = button.innerHTML;
  button.innerHTML = '<i class="bi bi-hourglass-split" aria-hidden="true"></i><span>Generating…</span>';
  try {
    const list = rows();
    const report = buildReportData({
      reportType: active,
      config: CONFIG[active],
      records: list,
      summary: summaryCards(active, list),
      breakdown: dimensionCounts(active, list),
      dateFrom: appliedPeriod.from,
      dateTo: appliedPeriod.to,
      generatedBy: getUserName() || getUserRole(),
      filters: [
        { label: "Barangay", value: document.getElementById("barangayFilter").value },
        { label: "Search", value: document.getElementById("reportSearch").value.trim() },
      ],
    });
    if (format === "pdf") {
      const { exportReportToPDF } = await import("../utils/reports/pdfExporter.js");
      await exportReportToPDF(report);
    } else {
      const { exportReportToExcel } = await import("../utils/reports/excelExporter.js");
      await exportReportToExcel(report);
    }
  } catch (error) {
    console.error("Report export failed", error);
    await showManagementNotice({
      icon: "error",
      title: `${format === "pdf" ? "PDF" : "Excel"} export failed`,
      text: "We couldn't generate this report. Please try again. If the problem continues, reload the Reports page.",
      confirmButtonText: "Close",
    });
  } finally {
    exporting = false;
    button.innerHTML = originalContent;
    syncExportButtons();
  }
}

function showError(errorValue) {
  reportReady = false;
  syncExportButtons();
  console.error(errorValue);
  const body = document.getElementById("reportBody");
  if (body) body.innerHTML = `<tr><td colspan="${CONFIG[active]?.columns.length || 1}"><div class="report-empty-state is-error"><span><i class="bi bi-cloud-slash"></i></span><strong>Unable to load this report</strong><small>${esc(errorValue.message)}</small></div></td></tr>`;
}

function bindControls() {
  document.getElementById("btnApply").addEventListener("click", () => { activePage = 1; setPresetActive(""); load().catch(showError); });
  document.getElementById("btnClear").addEventListener("click", () => { activePage = 1; document.getElementById("reportSearch").value = ""; document.getElementById("barangayFilter").value = ""; applyPreset("all"); });
  document.getElementById("reportSearch").addEventListener("input", () => { activePage = 1; render(); });
  document.getElementById("barangayFilter").addEventListener("change", () => { activePage = 1; render(); });
  document.getElementById("dateFrom").addEventListener("change", () => { setPresetActive(""); syncExportButtons(); });
  document.getElementById("dateTo").addEventListener("change", () => { setPresetActive(""); syncExportButtons(); });
  document.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.period)));
  document.getElementById("reportPagination").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page]");
    if (!button || button.disabled) return;
    activePage = Number(button.dataset.page);
    render();
    document.querySelector(".report-data-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("btnExcel").addEventListener("click", () => exportSelectedReport("excel"));
  document.getElementById("btnPrint").addEventListener("click", () => exportSelectedReport("pdf"));
}

async function init() {
  try {
    await protectManagementPage();
    renderTopbarUser();
    loadSidebar();
    workspace();
    renderPageHeader(PAGE_HEADER_CONFIGS.reports);
    const now = new Date();
    document.getElementById("dateFrom").value = `${now.getFullYear()}-01-01`;
    document.getElementById("dateTo").value = localDate(now);
    bindControls();
    await load();
  } catch (errorValue) {
    showError(errorValue);
  } finally {
    document.body.classList.remove("loading");
  }
}

window.addEventListener("DOMContentLoaded", init);
