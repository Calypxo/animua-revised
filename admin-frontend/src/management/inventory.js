// admin-frontend/src/management/inventory.js
// ─────────────────────────────────────────────────────
// Predictive inventory page
// Data is loaded from backend predictive endpoints.
// Local stock actions are currently handled in-page until full inventory API integration is completed.

import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../css/inventory.css";

import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { getUserName } from "../utils/storage.js";
import { getPredictiveInventoryItems } from "../services/predictiveInventory.service.js";

/* ══════════════════════════════════════════════════════
   Local recalculation helper
   Used for in-page stock changes until full inventory mutation API integration is completed.
══════════════════════════════════════════════════════ */
function rfClassify(item) {
  const dailyUsage = item.avgMonthlyUsage / 30;
  const reorderPoint = Math.ceil(dailyUsage * item.leadTimeDays);
  const daysUntilStockout =
    item.avgMonthlyUsage > 0
      ? Math.round((item.currentStock / item.avgMonthlyUsage) * 30)
      : 999;

  const daysToRestock = Math.max(0, daysUntilStockout - item.leadTimeDays);

  // RF decision (mirrors dataset labels)
  const isFast =
    (item.monthlyTurnoverRatio >= 0.5 && item.recencyDays <= 7) ||
    item.stockoutFrequency > 0;

  const stockStatus =
    item.currentStock <= reorderPoint * 0.5
      ? "Critical"
      : item.currentStock <= reorderPoint
      ? "Low"
      : "OK";

  const reorderRisk =
    item.currentStock < item.avgMonthlyUsage || item.stockoutFrequency > 0
      ? "Review"
      : "OK";

  return {
    movement: isFast ? "Fast" : "Slow",
    reorderPoint,
    daysUntilStockout,
    daysToRestock,
    stockStatus,
    reorderRisk,
  };
}

function mapPredictiveItem(item, index = 0) {
  const currentStock = Number(
    item.currentStock ??
      item.quantity ??
      item.stock ??
      item.onHand ??
      0
  );

  const daysUntilStockout = Math.round(Number(item.daysToStockout ?? 999));

  const avgMonthlyUsage =
    item.avgMonthlyUsage != null
      ? Number(item.avgMonthlyUsage)
      : daysUntilStockout > 0 && daysUntilStockout < 999
      ? Math.max(1, Math.round((currentStock / daysUntilStockout) * 30))
      : 1;

  const leadTimeDays = Number(item.leadTimeDays ?? item.leadTime ?? 7);
  const movementRaw = String(
    item.predictedMovement ?? item.movementLabel ?? "Slow"
  ).toLowerCase();
  const movement = movementRaw.includes("fast") ? "Fast" : "Slow";
  const reorderRisk =
    Number(item.stockoutRiskPercent ?? 0) >= 50 ? "Review" : "OK";

  const reorderPoint = Math.ceil((avgMonthlyUsage / 30) * leadTimeDays);

  const stockStatus =
    currentStock <= reorderPoint * 0.5
      ? "Critical"
      : currentStock <= reorderPoint
      ? "Low"
      : "OK";

  return {
    id: item.id || item.itemId || `PRED-${String(index + 1).padStart(3, "0")}`,
    name: item.itemDescription || item.name || "Unnamed Item",
    unit: item.unit || "pcs",
    category: item.category || "Uncategorized",
    currentStock,
    averageInventory: Number(item.averageInventory ?? currentStock),
    avgMonthlyUsage,
    recencyDays: Number(item.recencyDays ?? 0),
    leadTimeDays,
    stockoutFrequency: Number(item.stockoutFrequency ?? 0),
    monthlyTurnoverRatio: Number(item.monthlyTurnoverRatio ?? 0),
    movementLabel: movement,
    movement,
    reorderRisk,
    daysUntilStockout,
    daysToRestock: Math.max(0, daysUntilStockout - leadTimeDays),
    reorderPoint,
    stockStatus,
    transactions: [],
  };
}

let store = [];
let filtered = [];
let currentPage = 1;
const PAGE_SIZE = 12;
let activeTab = "all";
let activeItemId = null;
let viewMode = "table";

/* ══════════════════════════════════════════════════════
   CATEGORY COLORS
══════════════════════════════════════════════════════ */
const CAT_COLORS = {
  Antibiotic: { bg: "#f3e8ff", color: "#6b21a8" },
  Antiparasitic: { bg: "var(--teal-soft)", color: "var(--teal)" },
  Antifungal: { bg: "#fef3c7", color: "#92400e" },
  Anesthetic: { bg: "var(--rose-soft)", color: "var(--rose)" },
  Supplement: { bg: "var(--green-soft)", color: "var(--green)" },
  Vaccine: { bg: "var(--blue-soft)", color: "var(--blue)" },
  Consumable: { bg: "var(--amber-soft)", color: "var(--amber)" },
  "Surgical Supply": { bg: "var(--clay-soft)", color: "var(--clay)" },
  Equipment: { bg: "var(--cream-3)", color: "var(--stone)" },
  Disinfectant: { bg: "var(--teal-soft)", color: "var(--teal)" },
  "Topical Medicine": { bg: "var(--rose-soft)", color: "var(--rose)" },
  "Hormonal Medicine": { bg: "#fef3c7", color: "#92400e" },
  "Respiratory Medicine": { bg: "var(--blue-soft)", color: "var(--blue)" },
  "Pain Relief": { bg: "var(--amber-soft)", color: "var(--amber)" },
  Sedative: { bg: "var(--clay-soft)", color: "var(--clay)" },
  Diagnostic: { bg: "var(--blue-soft)", color: "var(--blue)" },
  Feed: { bg: "var(--green-soft)", color: "var(--green)" },
  "Shelter Supply": { bg: "var(--cream-3)", color: "var(--stone)" },
};

const catBadge = (cat) => {
  const c = CAT_COLORS[cat] || {
    bg: "var(--cream-3)",
    color: "var(--stone)",
  };
  return `<span class="cat-badge" style="background:${c.bg};color:${c.color}">${cat}</span>`;
};

const today = () => new Date().toISOString().split("T")[0];

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/* ── Stats ──────────────────────────────────────────── */
function renderStats() {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };

  const critical = store.filter((i) => i.stockStatus === "Critical").length;
  const low = store.filter((i) => i.stockStatus === "Low").length;
  const fast = store.filter((i) => i.movement === "Fast").length;

  set("statTotal", store.length);
  set("statCritical", critical);
  set("statLow", low);
  set("statFast", fast);
}

/* ── Alerts ─────────────────────────────────────────── */
function renderAlerts() {
  const bar = document.getElementById("alertsBar");
  if (!bar) return;

  const critical = store.filter((i) => i.stockStatus === "Critical");
  let html = "";

  if (critical.length) {
    const names =
      critical
        .slice(0, 3)
        .map((i) => i.name.trim())
        .join(", ") + (critical.length > 3 ? ` +${critical.length - 3} more` : "");

    html += `
      <div class="alert-row alert-critical">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <div>
          <strong>${critical.length} item${critical.length > 1 ? "s" : ""} at CRITICAL stock level</strong>
          — Immediate restocking required: ${names}
        </div>
        <span class="alert-action" data-filter-risk="Review">View all →</span>
      </div>
    `;
  } else {
    html = "";
  }

  bar.innerHTML = html;

  bar.querySelectorAll("[data-filter-risk]").forEach((el) => {
    el.addEventListener("click", () => {
      const riskFilter = document.getElementById("filterRisk");
      if (riskFilter) riskFilter.value = "Review";
      applyFilters();
    });
  });
}

/* ── Filter ─────────────────────────────────────────── */
function applyFilters() {
  const q = (document.getElementById("searchInventory")?.value || "")
    .toLowerCase()
    .trim();
  const movement = document.getElementById("filterMovement")?.value || "";
  const risk = document.getElementById("filterRisk")?.value || "";

  filtered = store.filter((item) => {
    if (activeTab !== "all" && item.category !== activeTab) return false;
    if (movement && item.movement !== movement) return false;
    if (risk && item.reorderRisk !== risk) return false;
    if (
      q &&
      !item.name.toLowerCase().includes(q) &&
      !item.id.toLowerCase().includes(q) &&
      !item.category.toLowerCase().includes(q)
    )
      return false;
    return true;
  });

  const so = { Critical: 0, Low: 1, OK: 2 };
  filtered.sort((a, b) => {
    const d = (so[a.stockStatus] || 2) - (so[b.stockStatus] || 2);
    return d !== 0 ? d : a.daysUntilStockout - b.daysUntilStockout;
  });

  currentPage = 1;
  renderView();
  renderPagination();
}

/* ── Stock helpers ──────────────────────────────────── */
function stockBar(item) {
  const pct = Math.min(
    100,
    Math.round((item.currentStock / item.averageInventory) * 100)
  );
  const fillCls =
    item.stockStatus === "Critical"
      ? "fill-crit"
      : item.stockStatus === "Low"
      ? "fill-low"
      : "fill-ok";
  const valCls =
    item.stockStatus === "Critical"
      ? "days-crit"
      : item.stockStatus === "Low"
      ? "days-warn"
      : "days-ok";

  return `
    <div class="stock-cell">
      <span class="stock-val ${valCls}">
        ${item.currentStock}
        <span style="font-size:0.7rem;font-weight:500;color:var(--stone)">${item.unit}</span>
      </span>
      <div class="stock-bar-wrap">
        <div class="stock-bar">
          <div class="stock-bar-fill ${fillCls}" style="width:${pct}%"></div>
        </div>
        <span style="font-size:0.68rem;font-family:var(--mono);color:var(--stone)">${pct}%</span>
      </div>
    </div>
  `;
}

function daysBadge(item) {
  if (item.daysUntilStockout >= 999)
    return `<span class="days-cell days-ok">—</span>`;
  const cls =
    item.daysUntilStockout <= 14
      ? "days-crit"
      : item.daysUntilStockout <= 30
      ? "days-warn"
      : "days-ok";
  return `<span class="days-cell ${cls}">${item.daysUntilStockout}d</span>`;
}

/* ── Table view ─────────────────────────────────────── */
function renderTable() {
  const tbody = document.getElementById("inventoryTableBody");
  if (!tbody) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);

  if (!page.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">No items found.</td></tr>`;
    return;
  }

  tbody.innerHTML = page
    .map(
      (item) => `
    <tr data-id="${item.id}" class="${item.id === activeItemId ? "row-active" : ""}">
      <td>
        <div class="item-name-cell">
          <div class="item-name">${item.name.trim()}</div>
          <div class="item-id">${item.id}</div>
        </div>
      </td>
      <td>${catBadge(item.category)}</td>
      <td>${stockBar(item)}</td>
      <td>${daysBadge(item)}</td>
      <td>
        <span class="movement-badge movement-${item.movement.toLowerCase()}">
          <i class="bi ${item.movement === "Fast" ? "bi-lightning-charge-fill" : "bi-hourglass"}"></i>${item.movement}
        </span>
      </td>
      <td>
        <span class="${item.reorderRisk === "Review" ? "risk-review" : "risk-ok"}">
          <i class="bi ${
            item.reorderRisk === "Review"
              ? "bi-exclamation-circle-fill"
              : "bi-check-circle-fill"
          }"></i> ${item.reorderRisk}
        </span>
      </td>
      <td>
        <button class="tbl-action-btn" title="View" data-action="view" data-id="${item.id}"><i class="bi bi-eye"></i></button>
        <button class="tbl-action-btn stock-in" title="Stock In" data-action="stockin" data-id="${item.id}"><i class="bi bi-plus-lg"></i></button>
        <button class="tbl-action-btn use" title="Record Usage" data-action="use" data-id="${item.id}"><i class="bi bi-dash-lg"></i></button>
      </td>
    </tr>
  `
    )
    .join("");

  tbody.querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-action]")) return;
      openDrawer(row.dataset.id);
    });
  });

  tbody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if (action === "view") openDrawer(id);
      if (action === "stockin") openStockIn(id);
      if (action === "use") openStockOut(id);
    });
  });
}

/* ── Card view ──────────────────────────────────────── */
function renderCards() {
  const grid = document.getElementById("inventoryCardGrid");
  if (!grid) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);

  if (!page.length) {
    grid.innerHTML = `<div class="text-center text-muted py-5" style="grid-column:1/-1">No items found.</div>`;
    return;
  }

  grid.innerHTML = page
    .map((item) => {
      const bc =
        item.stockStatus === "Critical"
          ? "card-crit"
          : item.stockStatus === "Low"
          ? "card-low"
          : "";

      const pct = Math.min(
        100,
        Math.round((item.currentStock / item.averageInventory) * 100)
      );
      const fc =
        item.stockStatus === "Critical"
          ? "fill-crit"
          : item.stockStatus === "Low"
          ? "fill-low"
          : "fill-ok";

      return `
      <div class="inv-card ${bc} ${item.id === activeItemId ? "card-active" : ""}" data-id="${item.id}">
        <div class="inv-card-header">
          <div>
            <div class="inv-card-name">${item.name.trim()}</div>
            <div class="inv-card-id">${item.id}</div>
          </div>
          ${catBadge(item.category)}
        </div>
        <div class="inv-card-stock">${item.currentStock}</div>
        <div class="inv-card-unit">${item.unit} in stock</div>
        <div style="margin:8px 0 4px">
          <div class="stock-bar" style="height:5px">
            <div class="stock-bar-fill ${fc}" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="inv-card-meta">
          <span class="movement-badge movement-${item.movement.toLowerCase()}" style="font-size:0.65rem;padding:2px 7px">
            <i class="bi ${item.movement === "Fast" ? "bi-lightning-charge-fill" : "bi-hourglass"}"></i>${item.movement}
          </span>
          ${daysBadge(item)}
        </div>
        <div class="inv-card-footer">
          <button class="inv-card-btn" data-action="stockin" data-id="${item.id}"><i class="bi bi-plus-lg"></i> Stock In</button>
          <button class="inv-card-btn card-use" data-action="use" data-id="${item.id}"><i class="bi bi-dash-lg"></i> Use</button>
        </div>
      </div>
    `;
    })
    .join("");

  grid.querySelectorAll(".inv-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-action]")) return;
      openDrawer(card.dataset.id);
    });
  });

  grid.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (btn.dataset.action === "stockin") openStockIn(btn.dataset.id);
      if (btn.dataset.action === "use") openStockOut(btn.dataset.id);
    });
  });
}

function renderView() {
  viewMode === "table" ? renderTable() : renderCards();
}

/* ── Pagination ─────────────────────────────────────── */
function renderPagination() {
  const bar = document.getElementById("paginationBar");
  if (!bar) return;

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = Math.min((currentPage - 1) * PAGE_SIZE + 1, total);
  const end = Math.min(currentPage * PAGE_SIZE, total);

  let h = `<span class="page-info">Showing ${total ? start : 0}–${end} of ${total}</span>`;
  h += `<button class="page-btn" id="pagePrev" ${
    currentPage === 1 ? "disabled" : ""
  }><i class="bi bi-chevron-left"></i></button>`;

  for (let i = 1; i <= Math.min(pages, 8); i++) {
    h += `<button class="page-btn ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>`;
  }

  if (pages > 8) {
    h += `<span style="color:var(--stone);font-size:0.82rem;padding:0 4px">…${pages}</span>`;
  }

  h += `<button class="page-btn" id="pageNext" ${
    currentPage === pages ? "disabled" : ""
  }><i class="bi bi-chevron-right"></i></button>`;

  bar.innerHTML = h;

  bar.querySelector("#pagePrev")?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderView();
      renderPagination();
    }
  });

  bar.querySelector("#pageNext")?.addEventListener("click", () => {
    if (currentPage < pages) {
      currentPage++;
      renderView();
      renderPagination();
    }
  });

  bar.querySelectorAll("[data-page]").forEach((b) =>
    b.addEventListener("click", () => {
      currentPage = parseInt(b.dataset.page);
      renderView();
      renderPagination();
    })
  );
}

/* ── Drawer ─────────────────────────────────────────── */
function openDrawer(id) {
  const item = store.find((i) => i.id === id);
  if (!item) return;

  activeItemId = id;

  document
    .querySelectorAll("tr[data-id]")
    .forEach((r) => r.classList.toggle("row-active", r.dataset.id === id));
  document
    .querySelectorAll(".inv-card")
    .forEach((c) => c.classList.toggle("card-active", c.dataset.id === id));

  document.getElementById("invLayout")?.classList.add("drawer-open");
  renderDrawer(item);
}

function closeDrawer() {
  activeItemId = null;
  document.getElementById("invLayout")?.classList.remove("drawer-open");
  document
    .querySelectorAll("tr[data-id]")
    .forEach((r) => r.classList.remove("row-active"));
  document
    .querySelectorAll(".inv-card")
    .forEach((c) => c.classList.remove("card-active"));
}

function renderDrawer(item) {
  const inner = document.getElementById("invDrawerInner");
  if (!inner) return;

  const txns = item.transactions.slice().reverse().slice(0, 8);

  inner.innerHTML = `
    <div class="drawer-header">
      <div>
        <h3>${item.name.trim()}</h3>
        <p>${item.id} · ${item.category} · ${item.unit}</p>
      </div>
      <button class="drawer-close-btn" id="drawerCloseX"><i class="bi bi-x-lg"></i></button>
    </div>

    <div class="drawer-body">

      <div class="drawer-section">
        <div class="drawer-section-title"><i class="bi bi-boxes"></i> Stock Status</div>
        <div class="drawer-info-grid">
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Current Stock</div>
            <div class="drawer-info-val" style="font-size:1.3rem;font-weight:800;color:${
              item.stockStatus === "Critical"
                ? "var(--clay)"
                : item.stockStatus === "Low"
                ? "var(--amber)"
                : "var(--ink)"
            }">
              ${item.currentStock} <span style="font-size:0.8rem;font-weight:500;color:var(--stone)">${item.unit}</span>
            </div>
          </div>

          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Status</div>
            <div class="drawer-info-val">
              <span class="${
                item.stockStatus === "Critical" || item.stockStatus === "Low"
                  ? "risk-review"
                  : "risk-ok"
              }" style="${
    item.stockStatus === "Low"
      ? "background:var(--amber-soft);color:var(--amber)"
      : ""
  }">
                ${
                  item.stockStatus === "Critical"
                    ? "⚠ Critical"
                    : item.stockStatus === "Low"
                    ? "↓ Low"
                    : "✓ OK"
                }
              </span>
            </div>
          </div>

          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Avg Monthly Usage</div>
            <div class="drawer-info-val">${item.avgMonthlyUsage} ${item.unit}/mo</div>
          </div>

          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Reorder Point</div>
            <div class="drawer-info-val">${item.reorderPoint} ${item.unit}</div>
          </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title"><i class="bi bi-diagram-3-fill"></i> Inventory Insight</div>
        <div class="rf-pred-card">
          <div class="rf-pred-header">
            <span class="rf-chip"><i class="bi bi-graph-up-arrow"></i> Prediction Result</span>
            <span class="movement-badge movement-${item.movement.toLowerCase()}">
              <i class="bi ${item.movement === "Fast" ? "bi-lightning-charge-fill" : "bi-hourglass"}"></i>
              ${item.movement}-Moving
            </span>
          </div>

          <div class="rf-pred-metrics">
            <div class="rf-metric">
              <div class="rf-metric-val">${
                item.daysUntilStockout >= 999 ? "—" : item.daysUntilStockout + "d"
              }</div>
              <div class="rf-metric-lbl">Days Until Stockout</div>
            </div>

            <div class="rf-metric">
              <div class="rf-metric-val">${item.reorderRisk}</div>
              <div class="rf-metric-lbl">Reorder Risk</div>
            </div>
          </div>

          <div style="margin-top:10px;font-size:0.75rem;color:var(--teal);display:flex;align-items:center;gap:5px">
            <i class="bi bi-info-circle"></i>
            <span>${
              item.reorderRisk === "Review"
                ? `⚠ Restock recommended${
                    item.daysToRestock <= 0
                      ? " now"
                      : " within " + item.daysToRestock + " days"
                  } — allow ${item.leadTimeDays}d lead time`
                : "✓ Stock is adequate. No action needed yet."
            }</span>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title"><i class="bi bi-clock-history"></i> Transaction History (${item.transactions.length})</div>
        ${
          txns.length
            ? `<div class="txn-list">${txns
                .map(
                  (t) => `
          <div class="txn-item">
            <div class="txn-icon ${t.type === "in" ? "txn-in" : "txn-out"}">
              <i class="bi ${t.type === "in" ? "bi-plus-lg" : "bi-dash-lg"}"></i>
            </div>
            <div class="txn-body">
              <div class="txn-type">${t.type === "in" ? "Stock In" : "Used — " + t.procedure}</div>
              <div class="txn-meta">${fmtDate(t.date)}${
                    t.animal ? " · " + t.animal : ""
                  }${t.supplier ? " · " + t.supplier : ""}${
                    t.staff ? " · by " + t.staff : ""
                  }</div>
              ${
                t.notes
                  ? `<div class="txn-meta" style="font-style:italic">${t.notes}</div>`
                  : ""
              }
            </div>
            <span class="txn-qty ${t.type === "in" ? "qty-in" : "qty-out"}">${t.type === "in" ? "+" : "-"}${t.qty}</span>
          </div>
          `
                )
                .join("")}</div>`
            : `<p style="font-size:0.84rem;color:var(--stone);text-align:center;padding:16px 0">No transactions recorded yet.</p>`
        }
      </div>

    </div>

    <div class="drawer-footer">
      <button class="btn-ghost-clay" id="drawerCloseBtn"><i class="bi bi-x"></i> Close</button>
      <button class="btn-outline-add" id="drawerEditBtn"><i class="bi bi-pencil"></i> Edit</button>
      <button class="btn-primary-clay" style="background:var(--amber);flex:1" id="drawerUseBtn"><i class="bi bi-dash-lg"></i> Record Usage</button>
      <button class="btn-primary-clay" style="flex:1" id="drawerStockInBtn"><i class="bi bi-plus-lg"></i> Stock In</button>
    </div>
  `;

  document.getElementById("drawerCloseX")?.addEventListener("click", closeDrawer);
  document.getElementById("drawerCloseBtn")?.addEventListener("click", closeDrawer);
  document
    .getElementById("drawerStockInBtn")
    ?.addEventListener("click", () => openStockIn(item.id));
  document
    .getElementById("drawerUseBtn")
    ?.addEventListener("click", () => openStockOut(item.id));
  document
    .getElementById("drawerEditBtn")
    ?.addEventListener("click", () => openItemModal(item.id));
}

async function loadPredictiveInventory() {
  try {
    const data = await getPredictiveInventoryItems();
    const rawItems = Array.isArray(data.items) ? data.items : [];

    if (!rawItems.length) {
      throw new Error("No predictive inventory items returned.");
    }

    store = rawItems.map(mapPredictiveItem);
    filtered = [...store];
    return true;
  } catch (error) {
    console.error("[loadPredictiveInventory]", error.message);
    showToast("error", error.message || "Failed to load predictive inventory.");
    store = [];
    filtered = [];
    return false;
  }
}

/* ── Real-time deduction ────────────────────────────── */
function deductStock(itemId, qty, opts = {}) {
  const item = store.find((i) => i.id === itemId);
  if (!item) return null;
  if (item.currentStock < qty) return { error: "Insufficient stock" };

  item.currentStock -= qty;

  item.transactions.push({
    type: "out",
    qty,
    date: opts.date || today(),
    animal: opts.animal || "",
    procedure: opts.procedure || "General Use",
    notes: opts.notes || "",
    staff: getUserName()?.split(" ")[0] || "Staff",
  });

  // update predictive fields
  item.recencyDays = 0;
  item.stockoutFrequency = item.currentStock <= 0
    ? (Number(item.stockoutFrequency) || 0) + 1
    : Number(item.stockoutFrequency) || 0;

  item.monthlyTurnoverRatio =
    item.averageInventory > 0
      ? Number(((Number(item.avgMonthlyUsage) || 0) / Number(item.averageInventory)).toFixed(2))
      : 0;

  Object.assign(item, rfClassify(item));
  return item;
}

function addStock(itemId, qty, opts = {}) {
  const item = store.find((i) => i.id === itemId);
  if (!item) return null;

  item.currentStock += qty;
  item.transactions.push({
    type: "in",
    qty,
    date: opts.date || today(),
    supplier: opts.supplier || "",
    notes: opts.notes || "",
    staff: getUserName()?.split(" ")[0] || "Staff",
  });

  Object.assign(item, rfClassify(item));
  return item;
}

window.addEventListener("animua:stockDeduct", (e) => {
  const { itemId, qty, animal, procedure, notes } = e.detail;
  const result = deductStock(itemId, qty, { animal, procedure, notes });

  if (result?.error) {
    console.warn("[stockDeduct]", result.error);
  } else {
    renderStats();
    renderAlerts();
    renderView();
    if (activeItemId === itemId) renderDrawer(store.find((i) => i.id === itemId));
  }
});

/* ── Stock In Modal ─────────────────────────────────── */
function openStockIn(prefillId = null) {
  const select = document.getElementById("fStockItemSelect");
  select.innerHTML = store
    .map(
      (i) =>
        `<option value="${i.id}">${i.name.trim()} (${i.id}) — ${i.currentStock} ${i.unit}</option>`
    )
    .join("");

  if (prefillId) select.value = prefillId;

  document.getElementById("fStockDate").value = "";
  document.getElementById("fStockQty").value = "";
  document.getElementById("fStockSupplier").value = "";
  document.getElementById("fStockNotes").value = "";
  document.getElementById("errStockItem").textContent = "";
  document.getElementById("errStockQty").textContent = "";
  document.getElementById("stockInTitle").textContent = prefillId
    ? `Stock In — ${store.find((i) => i.id === prefillId)?.name.trim()}`
    : "Stock In";
  document.getElementById("fStockDate").value = today();

  openModal("stockInModalBackdrop");
}

function saveStockIn() {
  const id = document.getElementById("fStockItemSelect").value;
  const qty = parseInt(document.getElementById("fStockQty").value);

  if (!id) {
    document.getElementById("errStockItem").textContent = "Please select an item.";
    return;
  }

  if (!qty || qty < 1) {
    document.getElementById("errStockQty").textContent = "Enter a valid quantity.";
    return;
  }

  const result = addStock(id, qty, {
    date: document.getElementById("fStockDate").value,
    supplier: document.getElementById("fStockSupplier").value.trim(),
    notes: document.getElementById("fStockNotes").value.trim(),
  });

  closeModal("stockInModalBackdrop");
  renderStats();
  renderAlerts();
  renderView();
  if (activeItemId === id) renderDrawer(result);
  showToast("success", `+${qty} ${result.unit} added to ${result.name.trim()}.`);
}

/* ── Stock Out Modal ────────────────────────────────── */
function openStockOut(id) {
  const item = store.find((i) => i.id === id);
  if (!item) return;

  document.getElementById("fOutItemId").value = id;
  document.getElementById("fOutItemName").textContent = `${item.name.trim()} — ${item.currentStock} ${item.unit} available`;
  document.getElementById("fOutQty").value = "";
  document.getElementById("fOutDate").value = today();
  document.getElementById("fOutAnimal").value = "";
  document.getElementById("fOutProcedure").value = "";
  document.getElementById("fOutNotes").value = "";
  document.getElementById("errOutQty").textContent = "";
  document.getElementById("stockOutSubtitle").textContent = `Deduct from: ${item.name.trim()} (${item.currentStock} ${item.unit} available)`;

  openModal("stockOutModalBackdrop");
}

function saveStockOut() {
  const id = document.getElementById("fOutItemId").value;
  const qty = parseInt(document.getElementById("fOutQty").value);
  const item = store.find((i) => i.id === id);

  if (!qty || qty < 1) {
    document.getElementById("errOutQty").textContent = "Enter a valid quantity.";
    return;
  }

  if (qty > item.currentStock) {
    document.getElementById("errOutQty").textContent = `Only ${item.currentStock} ${item.unit} available.`;
    return;
  }

  const result = deductStock(id, qty, {
    date: document.getElementById("fOutDate").value,
    animal: document.getElementById("fOutAnimal").value.trim(),
    procedure: document.getElementById("fOutProcedure").value,
    notes: document.getElementById("fOutNotes").value.trim(),
  });

  closeModal("stockOutModalBackdrop");
  renderStats();
  renderAlerts();
  renderView();

  if (activeItemId === id) renderDrawer(result);

  if (result.stockStatus === "Critical") {
    showToast(
      "error",
      `⚠ ${result.name.trim()} is now at CRITICAL stock level (${result.currentStock} ${result.unit}).`
    );
  } else if (result.stockStatus === "Low") {
    showToast(
      "warning",
      `↓ ${result.name.trim()} stock is LOW (${result.currentStock} ${result.unit}).`
    );
  } else {
    showToast("success", `−${qty} ${result.unit} deducted from ${result.name.trim()}.`);
  }
}

/* ── Add/Edit Item Modal ────────────────────────────── */
let editingItemId = null;

function openItemModal(id = null) {
  editingItemId = id;
  const item = id ? store.find((i) => i.id === id) : null;

  document.getElementById("itemModalTitle").textContent = id ? "Edit Item" : "Add New Item";
  document.getElementById("fItemId").value = id || "";
  document.getElementById("fItemName").value = item?.name.trim() || "";
  document.getElementById("fItemCategory").value = item?.category || "";
  document.getElementById("fItemUnit").value = item?.unit || "";
  document.getElementById("fItemCurrentStock").value = item?.currentStock || "";
  document.getElementById("fItemAvgUsage").value = item?.avgMonthlyUsage || "";
  document.getElementById("fItemLeadTime").value = item?.leadTimeDays || "";

  ["errItemName", "errItemCategory", "errItemStock"].forEach((id) => {
    document.getElementById(id).textContent = "";
  });

  openModal("itemModalBackdrop");
}

function saveItem() {
  const name = document.getElementById("fItemName").value.trim();
  const cat = document.getElementById("fItemCategory").value;
  const stock = parseInt(document.getElementById("fItemCurrentStock").value);

  if (!name) {
    document.getElementById("errItemName").textContent = "Name is required.";
    return;
  }

  if (!cat) {
    document.getElementById("errItemCategory").textContent = "Category is required.";
    return;
  }

  if (isNaN(stock) || stock < 0) {
    document.getElementById("errItemStock").textContent = "Valid stock required.";
    return;
  }

  if (editingItemId) {
    const item = store.find((i) => i.id === editingItemId);
    if (item) {
      item.name = name;
      item.category = cat;
      item.unit = document.getElementById("fItemUnit").value.trim() || item.unit;
      item.currentStock = stock;
      item.avgMonthlyUsage =
        parseInt(document.getElementById("fItemAvgUsage").value) || item.avgMonthlyUsage;
      item.leadTimeDays =
        parseInt(document.getElementById("fItemLeadTime").value) || item.leadTimeDays;

      Object.assign(item, rfClassify(item));
    }
    showToast("success", "Item updated.");
  } else {
    const newId = `ITM${String(store.length + 1).padStart(3, "0")}X`;
    const newItem = {
      id: newId,
      name,
      category: cat,
      unit: document.getElementById("fItemUnit").value.trim() || "pcs",
      currentStock: stock,
      averageInventory: stock,
      avgMonthlyUsage: parseInt(document.getElementById("fItemAvgUsage").value) || 1,
      leadTimeDays: parseInt(document.getElementById("fItemLeadTime").value) || 7,
      stockoutFrequency: 0,
      monthlyTurnoverRatio: 0,
      recencyDays: 0,
      transactions: [],
    };

    Object.assign(newItem, rfClassify(newItem));
    store.push(newItem);
    buildCategoryTabs();
    showToast("success", "New item added.");
  }

  closeModal("itemModalBackdrop");
  renderStats();
  renderAlerts();
  applyFilters();
}

/* ── Category tabs ──────────────────────────────────── */
function buildCategoryTabs() {
  const allowedTabs = [
    "all",
    "Antibiotic",
    "Antiparasitic",
    "Consumable",
    "Disinfectant",
    "Equipment",
    "Supplement",
    "Vaccine"
  ];

  const labels = {
    all: "All",
    Antibiotic: "Antibiotic",
    Antiparasitic: "Antiparasitic",
    Consumable: "Consumable",
    Disinfectant: "Disinfectant",
    Equipment: "Equipment",
    Supplement: "Supplement",
    Vaccine: "Vaccine"
  };

  const container = document.getElementById("categoryTabs");
  if (!container) return;

  container.innerHTML = allowedTabs
    .map(
      (c) =>
        `<button class="inv-tab ${c === activeTab ? "active" : ""}" data-tab="${c}">${labels[c] || c}</button>`
    )
    .join("");

  container.querySelectorAll(".inv-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".inv-tab").forEach((t) =>
        t.classList.remove("active")
      );
      btn.classList.add("active");
      activeTab = btn.dataset.tab;

      if (activeTab === "all") {
        const movementFilter = document.getElementById("filterMovement");
        const riskFilter = document.getElementById("filterRisk");
        const searchInput = document.getElementById("searchInventory");

        if (movementFilter) movementFilter.value = "";
        if (riskFilter) riskFilter.value = "";
        if (searchInput) searchInput.value = "";
      }

      applyFilters();
    });
  });
}
/* ── Modals / Toast / Sidebar ───────────────────────── */
const openModal = (id) => document.getElementById(id)?.classList.add("open");
const closeModal = (id) => document.getElementById(id)?.classList.remove("open");
const closeAllModals = () =>
  ["stockInModalBackdrop", "stockOutModalBackdrop", "itemModalBackdrop"].forEach(
    closeModal
  );

let toastT;
function showToast(type, msg) {
  const t = document.getElementById("umToast");
  const i = document.getElementById("toastIcon");
  const m = document.getElementById("toastMsg");
  if (!t) return;

  const icons = {
    success: "bi-check-circle-fill",
    error: "bi-x-circle-fill",
    info: "bi-info-circle-fill",
    warning: "bi-exclamation-triangle-fill",
  };

  t.className = `um-toast toast-${type}`;
  i.className = `bi ${icons[type] || "bi-info-circle-fill"}`;
  m.textContent = msg;

  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 4000);
}

function bindSidebarToggle() {
  document.getElementById("sidebarToggle")?.addEventListener("click", () => {
    const sb = document.getElementById("sidebar");
    const ct = document.getElementById("sidebar-container");

    if (window.innerWidth <= 768) {
      document.getElementById("mobile-nav-toggle")?.click();
      return;
    }

    const c = sb?.classList.toggle("collapsed");
    if (ct) {
      ct.style.width = c ? "64px" : "";
      ct.style.minWidth = c ? "64px" : "";
    }
  });
}

/* ── Init ───────────────────────────────────────────── */
async function init() {
  try {
    await protectManagementPage();
    loadSidebar();
    renderTopbarUser();
    bindSidebarToggle();

    await loadPredictiveInventory();
    buildCategoryTabs();
    renderStats();
    renderAlerts();
    applyFilters();

    document.getElementById("searchInventory")?.addEventListener("input", applyFilters);
    document.getElementById("filterMovement")?.addEventListener("change", applyFilters);
    document.getElementById("filterRisk")?.addEventListener("change", applyFilters);

    document.getElementById("btnTableView")?.addEventListener("click", () => {
      viewMode = "table";
      document.getElementById("btnTableView")?.classList.add("active");
      document.getElementById("btnCardView")?.classList.remove("active");
      document.getElementById("tableView").style.display = "";
      document.getElementById("cardView").style.display = "none";
      renderView();
    });

    document.getElementById("btnCardView")?.addEventListener("click", () => {
      viewMode = "card";
      document.getElementById("btnCardView")?.classList.add("active");
      document.getElementById("btnTableView")?.classList.remove("active");
      document.getElementById("tableView").style.display = "none";
      document.getElementById("cardView").style.display = "";
      renderView();
    });

    document.getElementById("btnStockIn")?.addEventListener("click", () => openStockIn());
    document.getElementById("btnAddItem")?.addEventListener("click", () => openItemModal());

    document.getElementById("stockInClose")?.addEventListener("click", () => closeModal("stockInModalBackdrop"));
    document.getElementById("stockInCancel")?.addEventListener("click", () => closeModal("stockInModalBackdrop"));
    document.getElementById("stockInSave")?.addEventListener("click", saveStockIn);

    document.getElementById("stockOutClose")?.addEventListener("click", () => closeModal("stockOutModalBackdrop"));
    document.getElementById("stockOutCancel")?.addEventListener("click", () => closeModal("stockOutModalBackdrop"));
    document.getElementById("stockOutSave")?.addEventListener("click", saveStockOut);

    document.getElementById("itemModalClose")?.addEventListener("click", () => closeModal("itemModalBackdrop"));
    document.getElementById("itemModalCancel")?.addEventListener("click", () => closeModal("itemModalBackdrop"));
    document.getElementById("itemModalSave")?.addEventListener("click", saveItem);

    document.querySelectorAll(".um-modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) backdrop.classList.remove("open");
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAllModals();
        closeDrawer();
      }
    });

    document.body.classList.remove("loading");
  } catch (error) {
    console.error("[inventory init]", error);
    showToast("error", error.message || "Failed to initialize inventory page.");
    document.body.classList.remove("loading");
  }
}

init();