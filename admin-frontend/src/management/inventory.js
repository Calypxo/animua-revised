// admin-frontend/src/management/inventory.js

import "../css/inventory.css";
import "../css/managementTables.css";
import "../css/recordsPanelReference.css";
import { renderPageHeader } from "../components/management/pageHeader.js";
import { PAGE_HEADER_CONFIGS } from "../components/management/pageHeaderConfigs.js";

import { protectPageByModule } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { getUserName } from "../utils/storage.js";
import { hasPermission } from "../auth/permissions.js";

import {
  getInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  createInventoryItem,
  applyInventoryMovement,
  getItemTransactions,
  getLiveInventoryPredictions
} from "../services/inventoryFirestore.service.js";
import {
  mergeInventoryPredictions,
  markInventoryPredictionsUnavailable,
} from "./inventoryPredictionMerge.js";

renderPageHeader(PAGE_HEADER_CONFIGS.inventory);

/* ══════════════════════════════════════════════════════
   Local recalculation helper
══════════════════════════════════════════════════════ */
function rfClassify(item) {
  const dailyUsage = Number(item.avgMonthlyUsage || 0) / 30;

  const reorderPoint = Math.max(
    1,
    Math.ceil(dailyUsage * Number(item.leadTimeDays || 0))
  );

  const criticalPoint = Math.max(1, Math.floor(reorderPoint * 0.5));

  const daysUntilStockout =
    Number(item.avgMonthlyUsage || 0) > 0
      ? Math.round(
          (Number(item.currentStock || 0) / Number(item.avgMonthlyUsage || 0)) * 30
        )
      : 999;

  const daysToRestock = Math.max(
    0,
    daysUntilStockout - Number(item.leadTimeDays || 0)
  );

  const isFast =
    (Number(item.monthlyTurnoverRatio || 0) >= 0.5 &&
      Number(item.recencyDays || 0) <= 7) ||
    Number(item.stockoutFrequency || 0) > 0;

  const stockStatus =
    Number(item.currentStock || 0) <= criticalPoint
      ? "Critical"
      : Number(item.currentStock || 0) <= reorderPoint
      ? "Low"
      : "OK";

  const reorderRisk =
    Number(item.currentStock || 0) < Number(item.avgMonthlyUsage || 0) ||
    Number(item.stockoutFrequency || 0) > 0
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

function formatUnit(count, unit) {
  const qty = Number(count || 0);
  const cleanUnit = String(unit || "").trim().toLowerCase();

  if (!cleanUnit) return "";

  const irregular = {
    boxes: "box",
    box: "box",
    bottles: "bottle",
    bottle: "bottle",
    packs: "pack",
    pack: "pack",
    pieces: "piece",
    piece: "piece",
    pcs: "pc",
    pc: "pc",
    tablets: "tablet",
    tablet: "tablet",
    capsules: "capsule",
    capsule: "capsule",
    vials: "vial",
    vial: "vial",
    gallons: "gallon",
    gallon: "gallon",
  };

  const singular = irregular[cleanUnit] || cleanUnit.replace(/s$/, "");
  const plural =
    singular === "box"
      ? "boxes"
      : singular === "pc"
      ? "pcs"
      : singular.endsWith("s")
      ? singular
      : `${singular}s`;

  return qty === 1 ? singular : plural;
}

function mapPredictiveItem(item, index = 0) {
  const currentStock = Number(
    item.currentStock ??
      item.quantity ??
      item.stock ??
      item.onHand ??
      0
  );

  const daysUntilStockout =
    item.daysUntilStockout != null
      ? Math.round(Number(item.daysUntilStockout))
      : item.daysToStockout != null
      ? Math.round(Number(item.daysToStockout))
      : Number(item.avgMonthlyUsage || 0) > 0
      ? Math.round((currentStock / Number(item.avgMonthlyUsage || 1)) * 30)
      : 999;

  const avgMonthlyUsage =
    item.avgMonthlyUsage != null
      ? Number(item.avgMonthlyUsage)
      : daysUntilStockout > 0 && daysUntilStockout < 999
      ? Math.max(1, Math.round((currentStock / daysUntilStockout) * 30))
      : 1;

  const leadTimeDays = Number(item.leadTimeDays ?? item.leadTime ?? 7);

  const ruleBasedMovement = rfClassify({
    ...item,
    currentStock,
    avgMonthlyUsage,
    leadTimeDays,
  }).movement;

  const reorderPoint = Math.max(
    1,
    Math.ceil((avgMonthlyUsage / 30) * leadTimeDays)
  );

  const criticalPoint = Math.max(1, Math.floor(reorderPoint * 0.5));

  const stockStatus =
    currentStock <= criticalPoint
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
    ruleBasedMovement,
    predictedMovement: null,
    predictionAvailable: false,
    predictionStatus: "loading",
    predictionMessage: "Waiting for the Random Forest service.",
    reorderRisk: item.reorderRisk || "OK",
    daysUntilStockout,
    daysToRestock: Math.max(0, daysUntilStockout - leadTimeDays),
    reorderPoint,
    stockStatus,
    transactions: Array.isArray(item.transactions) ? item.transactions : [],
  };
}

let store = [];
let filtered = [];
let currentPage = 1;
const PAGE_SIZE = 12;
let activeTab = "all";
let activeItemId = null;
let editingItemId = null;
let stockInMode = "single";
let stockOutMode = "single";
let currentRole = "";

/* ══════════════════════════════════════════════════════
   CATEGORY COLORS
══════════════════════════════════════════════════════ */
const catBadge = (cat) => {
  return `<span class="cat-badge" title="${cat}">${cat}</span>`;
};

const today = () => new Date().toISOString().split("T")[0];

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", {
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
  const fast = store.filter((i) => i.predictedMovement === "Fast").length;

  set("statTotal", store.length);
  set("statCritical", critical);
  set("heroCriticalCount", critical);
  set("statLow", low);
  set("statFast", fast);
}

function renderPredictionStatus(state, details = "") {
  const banner = document.getElementById("predictiveStatus");
  if (!banner) return;
  const states = {
    loading: ["bi-arrow-repeat", "Loading live Random Forest predictions…"],
    ready: ["bi-cpu-fill", "Random Forest movement uses current Firestore inventory."],
    partial: ["bi-exclamation-circle", "Some items lack the model features required for prediction."],
    unavailable: ["bi-cloud-slash", "Random Forest predictions are unavailable. Inventory controls remain active."],
  };
  const [icon, label] = states[state] || states.unavailable;
  banner.className = `predictive-status predictive-${state}`;
  banner.innerHTML = `<i class="bi ${icon}"></i><span><strong>${label}</strong>${details ? `<small>${details}</small>` : ""}</span>`;
}

function movementBadge(item, compact = false) {
  if (!item.predictionAvailable || !item.predictedMovement) {
    const label = item.predictionStatus === "loading" ? "Loading" : "Unavailable";
    return `<span class="movement-badge movement-unavailable${compact ? " is-compact" : ""}" title="${item.predictionMessage || label}"><i class="bi bi-dash-circle"></i>${label}</span>`;
  }
  const movement = item.predictedMovement;
  return `<span class="movement-badge movement-${movement.toLowerCase()}${compact ? " is-compact" : ""}" title="Random Forest prediction"><i class="bi ${movement === "Fast" ? "bi-lightning-charge-fill" : "bi-hourglass-split"}"></i>${compact ? movement : `${movement} Moving`}</span>`;
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
        <span class="alert-action" data-stock-status="Critical">View all →</span>
      </div>
    `;
  }

  bar.innerHTML = html;

  bar.querySelectorAll("[data-stock-status]").forEach((el) => {
    el.addEventListener("click", () => {
      const stockStatusFilter = document.getElementById("filterStockStatus");
      if (stockStatusFilter) stockStatusFilter.value = el.dataset.stockStatus || "Critical";

      const riskFilter = document.getElementById("filterRisk");
      if (riskFilter) riskFilter.value = "";

      const movementFilter = document.getElementById("filterMovement");
      if (movementFilter) movementFilter.value = "";

      const searchInput = document.getElementById("searchInventory");
      if (searchInput) searchInput.value = "";

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
  const stockStatus = document.getElementById("filterStockStatus")?.value || "";
  activeTab = document.getElementById("filterCategory")?.value.trim() || "all";
  const categoryQuery = activeTab === "all" ? "" : activeTab.toLowerCase();

  filtered = store.filter((item) => {
    if (categoryQuery && !item.category.toLowerCase().includes(categoryQuery)) return false;
    if (movement && item.predictedMovement !== movement) return false;
    if (risk && item.reorderRisk !== risk) return false;
    if (stockStatus && item.stockStatus !== stockStatus) return false;
    if (
      q &&
      !item.name.toLowerCase().includes(q) &&
      !item.id.toLowerCase().includes(q) &&
      !item.category.toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  const so = { Critical: 0, Low: 1, OK: 2 };
  filtered.sort((a, b) => {
    const d = (so[a.stockStatus] ?? 2) - (so[b.stockStatus] ?? 2);
    return d !== 0 ? d : a.daysUntilStockout - b.daysUntilStockout;
  });

  const resultLabel = document.getElementById("inventoryResultLabel");
  if (resultLabel) resultLabel.textContent = `${filtered.length} ${filtered.length === 1 ? "record" : "records"}`;
  const countLabel = document.getElementById("filterResultsCount");
  if (countLabel) {
    countLabel.textContent = filtered.length === store.length
      ? `Showing all ${store.length} inventory items`
      : `Showing ${filtered.length} of ${store.length} inventory items`;
  }

  const clearButton = document.getElementById("clearInventoryFilters");
  if (clearButton) {
    clearButton.disabled = !(q || movement || risk || stockStatus || activeTab !== "all");
  }

  currentPage = 1;
  renderView();
  renderPagination();
}

function clearInventoryFilters() {
  activeTab = "all";
  ["searchInventory", "filterMovement", "filterRisk", "filterStockStatus"].forEach((id) => {
    const control = document.getElementById(id);
    if (control) control.value = "";
  });

  const category = document.getElementById("filterCategory");
  if (category) category.value = "";
  applyFilters();
}

function stockBar(item) {
  const base = Number(item.averageInventory || 0) || 1;

  const pct = Math.min(
    100,
    Math.round(
      (Number(item.currentStock || 0) / base) * 100
    )
  );

  const fillCls =
    item.stockStatus === "Critical"
      ? "fill-crit"
      : item.stockStatus === "Low"
      ? "fill-low"
      : "fill-ok";

  return `
    <div class="stock-cell">
      <div class="stock-main">
        <span class="stock-val">
          ${item.currentStock}
        </span>

        <span class="stock-unit">
          ${formatUnit(item.currentStock, item.unit)} available
        </span>
      </div>

      <div class="stock-bar-wrap">
        <div class="stock-bar">
          <div
            class="stock-bar-fill ${fillCls}"
            style="width:${pct}%"
          ></div>
        </div>

        <span class="stock-percent">
          ${pct}%
        </span>
      </div>
    </div>
  `;
}

function daysBadge(item) {
  if (item.daysUntilStockout >= 999) {
    return `
      <span class="days-cell days-ok">
        <i class="bi bi-infinity"></i>
        Stable
      </span>
    `;
  }

  const cls =
    item.daysUntilStockout <= 14
      ? "days-crit"
      : item.daysUntilStockout <= 30
      ? "days-warn"
      : "days-ok";

  const icon =
    item.daysUntilStockout <= 14
      ? "bi-exclamation-triangle-fill"
      : item.daysUntilStockout <= 30
      ? "bi-clock-fill"
      : "bi-calendar-check-fill";

  const label =
    item.daysUntilStockout === 1
      ? "1 Day Left"
      : `${item.daysUntilStockout} Days Left`;

  return `
    <span class="days-cell ${cls}">
      <i class="bi ${icon}"></i>
      ${label}
    </span>
  `;
}

/* ── Table view ─────────────────────────────────────── */
function renderTable() {
  const tbody = document.getElementById("inventoryTableBody");
  if (!tbody) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);

  if (!page.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="reference-records-empty">
            <span><i class="bi bi-box-seam"></i></span>
            <strong>No inventory items found</strong>
            <small>Adjust the category, movement, risk, status, or search filters to broaden this view.</small>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = page
    .map((item) => {
      const rowStatusClass =
        item.stockStatus === "Critical"
          ? "row-critical"
          : item.stockStatus === "Low"
          ? "row-low"
          : "";

      const itemIcon =
        item.category === "Antibiotic"
          ? "bi-capsule"
          : item.category === "Vaccine"
          ? "bi-eyedropper"
          : item.category === "Disinfectant"
          ? "bi-droplet-fill"
          : item.category === "Equipment"
          ? "bi-tools"
          : item.category === "Feed"
          ? "bi-basket2-fill"
          : item.category === "Supplement"
          ? "bi-heart-pulse-fill"
          : item.category === "Surgical Supply"
          ? "bi-bandaid-fill"
          : item.category === "Consumable"
          ? "bi-box-seam-fill"
          : "bi-box2-heart-fill";

      const stockHealthClass =
        item.stockStatus === "Critical"
          ? "risk-critical"
          : item.reorderRisk === "Review"
          ? "risk-review"
          : "risk-ok";

      const stockHealthIcon =
        item.stockStatus === "Critical"
          ? "bi-exclamation-octagon-fill"
          : item.reorderRisk === "Review"
          ? "bi-exclamation-circle-fill"
          : "bi-check-circle-fill";

      const stockHealthText =
        item.stockStatus === "Critical"
          ? "Critical"
          : item.reorderRisk === "Review"
          ? "Review Soon"
          : "Healthy";

      return `
        <tr
          data-id="${item.id}"
          class="
            management-card-row
            ${item.id === activeItemId ? "row-active" : ""}
            ${rowStatusClass}
          "
        >
          <td class="management-card-primary">
            <span class="management-mobile-label" aria-hidden="true">Inventory item</span>
            <div class="item-name-cell">
              <div class="item-icon">
                <i class="bi ${itemIcon}"></i>
              </div>

              <div class="item-content">
                <div class="item-name" title="${item.name.trim()}">
                  ${item.name.trim()}
                </div>

                <div class="item-meta">
                  <span class="item-id">${item.id}</span>
                  <span class="item-meta-dot"></span>
                  <span class="item-status-label">
                    ${item.stockStatus === "OK" ? "In Stock" : item.stockStatus}
                  </span>
                </div>
              </div>
            </div>
          </td>

          <td>
            <span class="management-mobile-label" aria-hidden="true">Category</span>
            ${catBadge(item.category)}
          </td>

          <td>
            <span class="management-mobile-label" aria-hidden="true">Availability</span>
            ${stockBar(item)}
          </td>

          <td>
            <span class="management-mobile-label" aria-hidden="true">Stock forecast</span>
            ${daysBadge(item)}
          </td>

          <td>
            <span class="management-mobile-label" aria-hidden="true">RF movement</span>
            ${movementBadge(item)}
          </td>

          <td>
            <span class="management-mobile-label" aria-hidden="true">Stock health</span>
            <span class="${stockHealthClass}">
              <i class="bi ${stockHealthIcon}"></i>
              ${stockHealthText}
            </span>
          </td>

          <td class="management-card-actions">
            <span class="management-mobile-label" aria-hidden="true">Actions</span>
            <div class="table-actions">
              <button
                class="tbl-action-btn action-view management-card-open"
                title="View item"
                data-action="view"
                data-id="${item.id}"
                aria-label="View ${item.name.trim()}"
              >
                <i class="bi bi-eye"></i>
                <span class="inventory-action-text">View item</span>
              </button>

              ${
                can("stock_in")
                  ? `
                    <button
                      class="tbl-action-btn stock-in"
                      title="Increase stock"
                      data-action="stockin"
                      data-id="${item.id}"
                      aria-label="Increase stock for ${item.name.trim()}"
                    >
                      <i class="bi bi-plus-lg"></i>
                      <span class="inventory-action-text">Stock in</span>
                    </button>
                  `
                  : ""
              }

              ${
                can("consume_general")
                  ? `
                    <button
                      class="tbl-action-btn use"
                      title="Decrease stock"
                      data-action="use"
                      data-id="${item.id}"
                      aria-label="Decrease stock for ${item.name.trim()}"
                    >
                      <i class="bi bi-dash-lg"></i>
                      <span class="inventory-action-text">Use stock</span>
                    </button>
                  `
                  : ""
              }
            </div>
          </td>
        </tr>
      `;
    })
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

      if (action === "view") {
        openDrawer(id);
      }

      if (action === "stockin") {
        openStockIn(id);
      }

      if (action === "use") {
        openStockOut(id);
      }
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

      const base = Number(item.averageInventory || 0) || 1;
      const pct = Math.min(100, Math.round((Number(item.currentStock || 0) / base) * 100));

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
        <div class="inv-card-unit">${formatUnit(item.currentStock, item.unit)} in stock</div>
        <div style="margin:8px 0 4px">
          <div class="stock-bar" style="height:5px">
            <div class="stock-bar-fill ${fc}" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="inv-card-meta">
          ${movementBadge(item, true)}
          ${daysBadge(item)}
        </div>
        <div class="inv-card-footer">
  ${
    can("stock_in")
      ? `<button class="inv-card-btn" data-action="stockin" data-id="${item.id}">
          <i class="bi bi-plus-lg"></i> Stock In
        </button>`
      : ""
  }
  ${
    can("consume_general")
      ? `<button class="inv-card-btn card-use" data-action="use" data-id="${item.id}">
          <i class="bi bi-dash-lg"></i> Use
        </button>`
      : ""
  }
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
  renderTable();
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
  h += `<button class="page-btn" id="pagePrev" ${currentPage === 1 ? "disabled" : ""}><i class="bi bi-chevron-left"></i></button>`;

  for (let i = 1; i <= pages; i++) {
    h += `<button class="page-btn ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>`;
  }

  if (pages > 8) {
    h += `<span style="color:var(--stone);font-size:0.82rem;padding:0 4px">…${pages}</span>`;
  }

  h += `<button class="page-btn" id="pageNext" ${currentPage === pages ? "disabled" : ""}><i class="bi bi-chevron-right"></i></button>`;

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
      currentPage = parseInt(b.dataset.page, 10);
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

  document.querySelectorAll("tr[data-id]").forEach((r) => {
    r.classList.toggle("row-active", r.dataset.id === id);
  });

  document.querySelectorAll(".inv-card").forEach((c) => {
    c.classList.toggle("card-active", c.dataset.id === id);
  });

  renderDrawer(item);
  openModal("viewItemModalBackdrop");
}

function closeDrawer() {
  activeItemId = null;
  closeModal("viewItemModalBackdrop");

  document.querySelectorAll("tr[data-id]").forEach((r) => {
    r.classList.remove("row-active");
  });

  document.querySelectorAll(".inv-card").forEach((c) => {
    c.classList.remove("card-active");
  });
}

function renderDrawer(item) {
  const inner = document.getElementById("viewItemModalInner");
  if (!inner) return;

  const txns = item.transactions.slice().reverse().slice(0, 8);

  inner.innerHTML = `
    <div class="drawer-header">
      <div>
        <h3>${item.name.trim()}</h3>
        <p>${item.id} · ${item.category} · ${formatUnit(item.currentStock, item.unit)}</p>
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
              ${item.currentStock} <span style="font-size:0.8rem;font-weight:500;color:var(--stone)">${formatUnit(item.currentStock, item.unit)}</span>
            </div>
          </div>

          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Status</div>
            <div class="drawer-info-val">
              <span class="${
                item.stockStatus === "Critical" || item.stockStatus === "Low"
                  ? "risk-review"
                  : "risk-ok"
              }" style="${item.stockStatus === "Low" ? "background:var(--amber-soft);color:var(--amber)" : ""}">
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
           <div class="drawer-info-val">${item.avgMonthlyUsage} ${formatUnit(item.avgMonthlyUsage, item.unit)}/mo</div>
          </div>

          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Reorder Point</div>
            <div class="drawer-info-val">${item.reorderPoint} ${formatUnit(item.reorderPoint, item.unit)}</div>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title"><i class="bi bi-diagram-3-fill"></i> Inventory Insight</div>
        <div class="rf-pred-card">
          <div class="rf-pred-header">
            <span class="rf-chip"><i class="bi bi-graph-up-arrow"></i> Random Forest Movement</span>
            ${movementBadge(item)}
          </div>

          <div class="rf-pred-metrics">
            <div class="rf-metric">
              <div class="rf-metric-val">${item.daysUntilStockout >= 999 ? "—" : `${item.daysUntilStockout}d`}</div>
              <div class="rf-metric-lbl">Rule-based Days Until Stockout</div>
            </div>

            <div class="rf-metric">
              <div class="rf-metric-val">${item.reorderRisk}</div>
              <div class="rf-metric-lbl">Rule-based Reorder Risk</div>
            </div>
          </div>

          <div style="margin-top:10px;font-size:0.75rem;color:var(--teal);display:flex;align-items:center;gap:5px">
            <i class="bi bi-info-circle"></i>
            <span>${
              !item.predictionAvailable
                ? item.predictionMessage
                : item.reorderRisk === "Review"
                ? `⚠ Restock recommended${
                    item.daysToRestock <= 0
                      ? " now"
                      : ` within ${item.daysToRestock} days`
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
              <div class="txn-type">${t.type === "in" ? "Stock In" : "Used — " + (t.procedure || "General Use")}</div>
              <div class="txn-meta">${fmtDate(t.date)}${t.animal ? " · " + t.animal : ""}${t.supplier ? " · " + t.supplier : ""}${t.staff ? " · by " + t.staff : ""}</div>
              ${t.notes ? `<div class="txn-meta" style="font-style:italic">${t.notes}</div>` : ""}
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
  <button class="btn-ghost-clay" id="drawerCloseBtn">
    <i class="bi bi-x"></i> Close
  </button>

  ${
    can("edit")
      ? `<button class="btn-outline-add" id="drawerEditBtn">
          <i class="bi bi-pencil"></i> Edit
        </button>`
      : ""
  }

  ${
    can("consume_general")
      ? `<button class="btn-primary-clay ${can("stock_in") ? "management-secondary-action" : "management-primary-action"}" style="background:var(--amber);flex:1" id="drawerUseBtn">
          <i class="bi bi-dash-lg"></i> Record Usage
        </button>`
      : ""
  }

  ${
    can("stock_in")
      ? `<button class="btn-primary-clay management-primary-action" style="flex:1" id="drawerStockInBtn">
          <i class="bi bi-plus-lg"></i> Stock In
        </button>`
      : ""
  }
</div>
  `;

  document.getElementById("drawerCloseX")?.addEventListener("click", closeDrawer);
  document.getElementById("drawerCloseBtn")?.addEventListener("click", closeDrawer);
  document.getElementById("drawerStockInBtn")?.addEventListener("click", () => {
  closeDrawer();
  setTimeout(() => openStockIn(item.id), 180);
});

document.getElementById("drawerUseBtn")?.addEventListener("click", () => {
  closeDrawer();
  setTimeout(() => openStockOut(item.id), 180);
});
  document.getElementById("drawerEditBtn")?.addEventListener("click", () => openItemModal(item.id));
}

async function loadInventory() {
  try {
    const items = await getInventoryItems();

    if (!items.length) {
      throw new Error("No inventory items found.");
    }

    renderPredictionStatus("loading");
    store = await Promise.all(
      items.map(async (item, index) => {
        const mapped = mapPredictiveItem(item, index);
        const txns = await getItemTransactions(mapped.id);
        mapped.transactions = txns;
        return mapped;
      })
    );

    filtered = [...store];
    renderStats();
    renderAlerts();
    buildCategoryFilter();
    applyFilters();

    try {
      const predictions = await getLiveInventoryPredictions(items);
      store = mergeInventoryPredictions(store, predictions);
      const unavailable = Number(predictions.unavailableCount || 0);
      renderPredictionStatus(
        unavailable ? "partial" : "ready",
        unavailable
          ? `${predictions.predictedCount || 0} predicted; ${unavailable} unavailable due to missing or invalid fields.`
          : `${predictions.predictedCount || store.length} live items predicted.`
      );
    } catch (predictionError) {
      console.warn("[loadInventory predictions]", predictionError);
      store = markInventoryPredictionsUnavailable(store, predictionError.message);
      renderPredictionStatus("unavailable", predictionError.message);
    }

    filtered = [...store];
    renderStats();
    renderAlerts();
    applyFilters();
  } catch (error) {
    console.error("[loadInventory]", error);
    showToast("error", error.message || "Failed to load inventory.");
    store = [];
    filtered = [];
    renderView();
    renderPagination();
  }
}

/* ── Firestore stock deduction event ────────────────── */
window.addEventListener("animua:stockDeduct", async (e) => {
  const { itemId, qty, animal, procedure, notes } = e.detail;

  try {
    const item = await getInventoryItemById(itemId);

    if (Number(item.currentStock || 0) < qty) {
      console.warn("[stockDeduct] Insufficient stock");
      return;
    }

    const newStock = Number(item.currentStock || 0) - qty;

    const updatedLocal = {
      ...item,
      currentStock: newStock,
      recencyDays: 0,
      stockoutFrequency:
        newStock <= 0
          ? (Number(item.stockoutFrequency) || 0) + 1
          : Number(item.stockoutFrequency) || 0,
    };

    updatedLocal.monthlyTurnoverRatio =
      Number(updatedLocal.averageInventory || 0) > 0
        ? Number(
            (
              Number(updatedLocal.avgMonthlyUsage || 0) /
              Number(updatedLocal.averageInventory || 0)
            ).toFixed(2)
          )
        : 0;

    Object.assign(updatedLocal, rfClassify(updatedLocal));

    await applyInventoryMovement(itemId, "out", {
      qty,
      date: today(),
      animal: animal || "",
      procedure: procedure || "General Use",
      notes: notes || "",
      predictionUpdates: {
        recencyDays: updatedLocal.recencyDays,
        stockoutFrequency: updatedLocal.stockoutFrequency,
        monthlyTurnoverRatio: updatedLocal.monthlyTurnoverRatio,
        ruleBasedMovement: updatedLocal.movement,
        reorderRisk: updatedLocal.reorderRisk,
        reorderPoint: updatedLocal.reorderPoint,
        daysUntilStockout: updatedLocal.daysUntilStockout,
        daysToRestock: updatedLocal.daysToRestock,
        stockStatus: updatedLocal.stockStatus,
      },
    });

    await loadInventory();
  } catch (error) {
    console.error("[stockDeduct]", error);
  }
});

function can(action) {
  return hasPermission(
    currentRole,
    "inventory",
    action
  );
}

/* ── Batch helpers ──────────────────────────────────── */
function addStockInBatchRow(prefill = {}) {
  const wrap = document.getElementById("stockInBatchRows");
  if (!wrap) return;

  const row = document.createElement("div");
  row.className = "batch-row";
  row.style.display = "grid";
  row.style.gridTemplateColumns = "2fr 1fr 2fr auto";
  row.style.gap = "10px";
  row.style.marginBottom = "10px";

  row.innerHTML = `
    <select class="form-inp batch-stock-item">
      <option value="">Select item</option>
      ${store
        .map(
          (i) =>
            `<option value="${i.id}" ${prefill.itemId === i.id ? "selected" : ""}>
              ${i.name.trim()} (${i.id}) — ${i.currentStock} ${formatUnit(i.currentStock, i.unit)}
            </option>`
        )
        .join("")}
    </select>

    <input type="number" min="1" class="form-inp batch-stock-qty" placeholder="Qty" value="${prefill.qty || ""}" />
    <input type="text" class="form-inp batch-stock-note" placeholder="Note (optional)" value="${prefill.note || ""}" />

    <button type="button" class="btn-ghost-clay batch-remove-btn">
      <i class="bi bi-trash"></i>
    </button>
  `;

  row.querySelector(".batch-remove-btn")?.addEventListener("click", () => {
    row.remove();
  });

  wrap.appendChild(row);
}

function addStockOutBatchRow(prefill = {}) {
  const wrap = document.getElementById("stockOutBatchRows");
  if (!wrap) return;

  const row = document.createElement("div");
  row.className = "batch-row batch-usage-row";

  row.innerHTML = `
    <div class="batch-usage-grid">
      <select class="form-inp batch-out-item">
        <option value="">Select item</option>
        ${store
          .map(
            (i) =>
              `<option value="${i.id}" ${prefill.itemId === i.id ? "selected" : ""}>
                ${i.name.trim()} (${i.id}) — ${i.currentStock} ${formatUnit(i.currentStock, i.unit)}
              </option>`
          )
          .join("")}
      </select>

      <input
        type="number"
        min="1"
        class="form-inp batch-out-qty"
        placeholder="Qty"
        value="${prefill.qty || ""}"
      />

      <button type="button" class="btn-ghost-clay batch-remove-btn" title="Remove row">
        <i class="bi bi-trash"></i>
      </button>

      <input
        type="text"
        class="form-inp batch-out-animal"
        placeholder="Animal (optional)"
        value="${prefill.animal || ""}"
      />

      <select class="form-inp batch-out-procedure">
        <option value="">Select procedure…</option>
        <option ${prefill.procedure === "Vaccination" ? "selected" : ""}>Vaccination</option>
        <option ${prefill.procedure === "Deworming" ? "selected" : ""}>Deworming</option>
        <option ${prefill.procedure === "Treatment" ? "selected" : ""}>Treatment</option>
        <option ${prefill.procedure === "Surgery / Spay / Neuter" ? "selected" : ""}>Surgery / Spay / Neuter</option>
        <option ${prefill.procedure === "Checkup" ? "selected" : ""}>Checkup</option>
        <option ${prefill.procedure === "Feeding" ? "selected" : ""}>Feeding</option>
        <option ${prefill.procedure === "Cleaning / Disinfection" ? "selected" : ""}>Cleaning / Disinfection</option>
        <option ${prefill.procedure === "Other" ? "selected" : ""}>Other</option>
      </select>
    </div>
  `;

  row.querySelector(".batch-remove-btn")?.addEventListener("click", () => {
    row.remove();
  });

  wrap.appendChild(row);
}

function openBatchStockIn() {
  if (!can("stock_in")) {
  showToast("error", "You do not have permission to stock in inventory items.");
  return;
}

  stockInMode = "batch";

  document.getElementById("stockInTitle").textContent = "Batch Stock In";
  document.getElementById("fStockDate").value = today();
  document.getElementById("fStockSupplier").value = "";
  document.getElementById("fStockNotes").value = "";
  document.getElementById("errStockItem").textContent = "";
  document.getElementById("errStockQty").textContent = "";
  const batchErr = document.getElementById("errStockBatch");
  if (batchErr) batchErr.textContent = "";

  const singleWrap = document.getElementById("stockInSingleFields");
  const batchWrap = document.getElementById("stockInBatchWrap");
  if (singleWrap) singleWrap.style.display = "none";
  if (batchWrap) batchWrap.style.display = "";

  const wrap = document.getElementById("stockInBatchRows");
  if (wrap) {
    wrap.innerHTML = "";
    addStockInBatchRow();
  }

  openModal("stockInModalBackdrop");
}

function openBatchStockOut() {
  if (!can("consume_general")) {
  showToast("error", "You do not have permission to record general inventory usage.");
  return;
}

  stockOutMode = "batch";

  document.getElementById("stockOutSubtitle").textContent = "Record usage for multiple items";
  document.getElementById("errOutQty").textContent = "";
  document.getElementById("fOutDate").value = today();
  document.getElementById("fOutNotes").value = "";

  const singleWrap = document.getElementById("stockOutSingleFields");
  const batchWrap = document.getElementById("stockOutBatchWrap");
  if (singleWrap) singleWrap.style.display = "none";
  if (batchWrap) batchWrap.style.display = "";

  const wrap = document.getElementById("stockOutBatchRows");
  if (wrap) {
    wrap.innerHTML = "";
    addStockOutBatchRow();
  }

  openModal("stockOutModalBackdrop");
}

async function saveBatchStockIn() {
  if (!can("stock_in")) {
  showToast("error", "You do not have permission to stock in inventory items.");
  return;
}
  const rows = [...document.querySelectorAll("#stockInBatchRows .batch-row")];
  const batchDate = document.getElementById("fStockDate").value || today();
  const supplier = document.getElementById("fStockSupplier").value.trim();
  const notes = document.getElementById("fStockNotes").value.trim();
  const batchId = `BIN-${Date.now()}`;

  if (!rows.length) {
    showToast("warning", "Add at least one item.");
    return;
  }

  try {
    for (const row of rows) {
      const id = row.querySelector(".batch-stock-item")?.value;
      const qty = Number(row.querySelector(".batch-stock-qty")?.value);
      const rowNote = row.querySelector(".batch-stock-note")?.value.trim() || "";

      if (!id || !Number.isInteger(qty) || qty < 1) {
        throw new Error("Please complete all batch stock in rows.");
      }

      const item = await getInventoryItemById(id);
      const newStock = Number(item.currentStock || 0) + qty;

      const updatedLocal = {
        ...item,
        currentStock: newStock,
      };

      Object.assign(updatedLocal, rfClassify(updatedLocal));

      await applyInventoryMovement(id, "in", {
        qty,
        date: batchDate,
        supplier,
        notes: rowNote || notes,
        batchId,
        predictionUpdates: {
          ruleBasedMovement: updatedLocal.movement,
          reorderRisk: updatedLocal.reorderRisk,
          reorderPoint: updatedLocal.reorderPoint,
          daysUntilStockout: updatedLocal.daysUntilStockout,
          daysToRestock: updatedLocal.daysToRestock,
          stockStatus: updatedLocal.stockStatus,
        },
      });
    }

    closeModal("stockInModalBackdrop");
    await loadInventory();
    showToast("success", "Batch stock in saved successfully.");
  } catch (error) {
    console.error("[saveBatchStockIn]", error);
    const batchErr = document.getElementById("errStockBatch");
    if (batchErr) batchErr.textContent = error.message || "Failed to save batch stock in.";
    showToast("error", error.message || "Failed to save batch stock in.");
  }
}

async function saveBatchStockOut() {
  if (!can("consume_general")) {
  showToast("error", "You do not have permission to record general inventory usage.");
  return;
}

  const rows = [...document.querySelectorAll("#stockOutBatchRows .batch-row")];
  const batchDate = document.getElementById("fOutDate").value || today();
  const notes = document.getElementById("fOutNotes").value.trim();
  const batchId = `BOUT-${Date.now()}`;

  if (!rows.length) {
    showToast("warning", "Add at least one item.");
    return;
  }

  try {
    for (const row of rows) {
      const id = row.querySelector(".batch-out-item")?.value;
      const qty = Number(row.querySelector(".batch-out-qty")?.value);
      const animal = row.querySelector(".batch-out-animal")?.value.trim() || "";
      const procedure = row.querySelector(".batch-out-procedure")?.value.trim() || "General Use";

      if (!id || !Number.isInteger(qty) || qty < 1) {
        throw new Error("Please complete all batch usage rows.");
      }

      const item = await getInventoryItemById(id);

      if (qty > Number(item.currentStock || 0)) {
        throw new Error(`${item.name.trim()} only has ${item.currentStock} ${formatUnit(item.currentStock, item.unit)} available.`);
      }

      const newStock = Number(item.currentStock || 0) - qty;

      const updatedLocal = {
        ...item,
        currentStock: newStock,
        recencyDays: 0,
        stockoutFrequency:
          newStock <= 0
            ? (Number(item.stockoutFrequency) || 0) + 1
            : Number(item.stockoutFrequency) || 0,
      };

      updatedLocal.monthlyTurnoverRatio =
        Number(updatedLocal.averageInventory || 0) > 0
          ? Number(
              (
                Number(updatedLocal.avgMonthlyUsage || 0) /
                Number(updatedLocal.averageInventory || 0)
              ).toFixed(2)
            )
          : 0;

      Object.assign(updatedLocal, rfClassify(updatedLocal));

      await applyInventoryMovement(id, "out", {
        qty,
        date: batchDate,
        animal,
        procedure,
        notes,
        batchId,
        predictionUpdates: {
          recencyDays: updatedLocal.recencyDays,
          stockoutFrequency: updatedLocal.stockoutFrequency,
          monthlyTurnoverRatio: updatedLocal.monthlyTurnoverRatio,
          ruleBasedMovement: updatedLocal.movement,
          reorderRisk: updatedLocal.reorderRisk,
          reorderPoint: updatedLocal.reorderPoint,
          daysUntilStockout: updatedLocal.daysUntilStockout,
          daysToRestock: updatedLocal.daysToRestock,
          stockStatus: updatedLocal.stockStatus,
        },
      });
    }

    closeModal("stockOutModalBackdrop");
    await loadInventory();
    showToast("success", "Batch record usage saved successfully.");
  } catch (error) {
    console.error("[saveBatchStockOut]", error);
    document.getElementById("errOutQty").textContent =
      error.message || "Failed to record batch usage.";
  }
}

/* ── Stock In Modal ─────────────────────────────────── */
function openStockIn(prefillId = null) {
  if (!can("stock_in")) {
  showToast("error", "You do not have permission to stock in inventory items.");
  return;
}
  stockInMode = "single";

  const singleWrap = document.getElementById("stockInSingleFields");
  const batchWrap = document.getElementById("stockInBatchWrap");
  if (singleWrap) singleWrap.style.display = "";
  if (batchWrap) batchWrap.style.display = "none";

  const item = prefillId ? store.find((i) => i.id === prefillId) : null;
  if (!item) return;

  document.getElementById("fStockItemSelect").value = item.id;
  document.getElementById("fStockItemName").textContent =
    `${item.name.trim()} — ${item.currentStock} ${formatUnit(item.currentStock, item.unit)} available`;

  document.getElementById("fStockDate").value = today();
  document.getElementById("fStockQty").value = "";
  document.getElementById("fStockSupplier").value = "";
  document.getElementById("fStockNotes").value = "";
  document.getElementById("errStockItem").textContent = "";
  document.getElementById("errStockQty").textContent = "";
  document.getElementById("stockInTitle").textContent = `Stock In — ${item.name.trim()}`;

  openModal("stockInModalBackdrop");
}

async function saveStockIn() {
  if (!can("stock_in")) {
  showToast("error", "You do not have permission to stock in inventory items.");
  return;
}

  const id = document.getElementById("fStockItemSelect").value;
  const qty = Number(document.getElementById("fStockQty").value);

  if (!id) {
    document.getElementById("errStockItem").textContent = "Please select an item.";
    return;
  }

  if (!Number.isInteger(qty) || qty < 1) {
    document.getElementById("errStockQty").textContent = "Enter a valid quantity.";
    return;
  }

  try {
    const item = await getInventoryItemById(id);
    const newStock = Number(item.currentStock || 0) + qty;

    const updatedLocal = {
      ...item,
      currentStock: newStock,
    };

    Object.assign(updatedLocal, rfClassify(updatedLocal));

    await applyInventoryMovement(id, "in", {
      qty,
      date: document.getElementById("fStockDate").value,
      supplier: document.getElementById("fStockSupplier").value.trim(),
      notes: document.getElementById("fStockNotes").value.trim(),
      predictionUpdates: {
        ruleBasedMovement: updatedLocal.movement,
        reorderRisk: updatedLocal.reorderRisk,
        reorderPoint: updatedLocal.reorderPoint,
        daysUntilStockout: updatedLocal.daysUntilStockout,
        daysToRestock: updatedLocal.daysToRestock,
        stockStatus: updatedLocal.stockStatus,
      },
    });

    closeModal("stockInModalBackdrop");
    await loadInventory();
    showToast("success", `+${qty} ${formatUnit(qty, item.unit)} added to ${item.name.trim()}.`);
  } catch (error) {
    console.error("[saveStockIn]", error);
    showToast("error", error.message || "Failed to save stock in.");
  }
}

/* ── Stock Out Modal ────────────────────────────────── */
function openStockOut(id) {
  if (!can("consume_general")) {
  showToast("error", "You do not have permission to record general inventory usage.");
  return;
}

  stockOutMode = "single";

  const singleWrap = document.getElementById("stockOutSingleFields");
  const batchWrap = document.getElementById("stockOutBatchWrap");
  if (singleWrap) singleWrap.style.display = "";
  if (batchWrap) batchWrap.style.display = "none";

  const item = store.find((i) => i.id === id);
  if (!item) return;

  document.getElementById("fOutItemId").value = id;
  document.getElementById("fOutItemName").textContent = `${item.name.trim()} — ${item.currentStock} ${formatUnit(item.currentStock, item.unit)} available`;
  document.getElementById("fOutQty").value = "";
  document.getElementById("fOutDate").value = today();
  document.getElementById("fOutAnimal").value = "";
  document.getElementById("fOutProcedure").value = "";
  document.getElementById("fOutNotes").value = "";
  document.getElementById("errOutQty").textContent = "";
  document.getElementById("stockOutSubtitle").textContent = `Deduct from: ${item.name.trim()} — ${item.currentStock} ${formatUnit(item.currentStock, item.unit)} available`;

  openModal("stockOutModalBackdrop");
}

async function saveStockOut() {
  if (!can("consume_general")) {
  showToast("error", "You do not have permission to record general inventory usage.");
  return;
}

  const id = document.getElementById("fOutItemId").value;
  const qty = Number(document.getElementById("fOutQty").value);

  if (!Number.isInteger(qty) || qty < 1) {
    document.getElementById("errOutQty").textContent = "Enter a valid quantity.";
    return;
  }

  try {
    const item = await getInventoryItemById(id);

    if (qty > Number(item.currentStock || 0)) {
      document.getElementById("errOutQty").textContent =
        `Only ${item.currentStock} ${formatUnit(item.currentStock, item.unit)} available`;
      return;
    }

    const newStock = Number(item.currentStock || 0) - qty;

    const updatedLocal = {
      ...item,
      currentStock: newStock,
      recencyDays: 0,
      stockoutFrequency:
        newStock <= 0
          ? (Number(item.stockoutFrequency) || 0) + 1
          : Number(item.stockoutFrequency) || 0,
    };

    updatedLocal.monthlyTurnoverRatio =
      Number(updatedLocal.averageInventory || 0) > 0
        ? Number(
            (
              Number(updatedLocal.avgMonthlyUsage || 0) /
              Number(updatedLocal.averageInventory || 0)
            ).toFixed(2)
          )
        : 0;

    Object.assign(updatedLocal, rfClassify(updatedLocal));

    await applyInventoryMovement(id, "out", {
      qty,
      date: document.getElementById("fOutDate").value,
      animal: document.getElementById("fOutAnimal").value.trim(),
      procedure: document.getElementById("fOutProcedure").value || "General Use",
      notes: document.getElementById("fOutNotes").value.trim(),
      predictionUpdates: {
        recencyDays: updatedLocal.recencyDays,
        stockoutFrequency: updatedLocal.stockoutFrequency,
        monthlyTurnoverRatio: updatedLocal.monthlyTurnoverRatio,
        ruleBasedMovement: updatedLocal.movement,
        reorderRisk: updatedLocal.reorderRisk,
        reorderPoint: updatedLocal.reorderPoint,
        daysUntilStockout: updatedLocal.daysUntilStockout,
        daysToRestock: updatedLocal.daysToRestock,
        stockStatus: updatedLocal.stockStatus,
      },
    });

    closeModal("stockOutModalBackdrop");
    await loadInventory();
    const requestedId = new URLSearchParams(window.location.search).get("id");
    if (requestedId && store.some((item) => item.id === requestedId)) {
      openDrawer(requestedId);
    }

    if (updatedLocal.stockStatus === "Critical") {
      showToast(
        "error",
        `⚠ ${item.name.trim()} is now at CRITICAL stock level (${updatedLocal.currentStock} ${item.unit}).`
      );
    } else if (updatedLocal.stockStatus === "Low") {
      showToast(
        "warning",
        `↓ ${item.name.trim()} stock is LOW (${updatedLocal.currentStock} ${item.unit}).`
      );
    } else {
      showToast("success", `−${qty} ${item.unit} deducted from ${item.name.trim()}.`);
    }
  } catch (error) {
    console.error("[saveStockOut]", error);
    document.getElementById("errOutQty").textContent =
      error.message || "Failed to record usage.";
  }
}

/* ── Add/Edit Item Modal ────────────────────────────── */
function openItemModal(id = null) {
  const requiredPermission = id ? "edit" : "create";

if (!can(requiredPermission)) {
  showToast(
    "error",
    id
      ? "You do not have permission to edit inventory items."
      : "You do not have permission to add inventory items."
  );
  return;
}

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

  ["errItemName", "errItemCategory", "errItemStock"].forEach((errId) => {
    const el = document.getElementById(errId);
    if (el) el.textContent = "";
  });

  openModal("itemModalBackdrop");
}

async function saveItem() {
  const requiredPermission = editingItemId ? "edit" : "create";

if (!can(requiredPermission)) {
  showToast(
    "error",
    editingItemId
      ? "You do not have permission to edit inventory items."
      : "You do not have permission to add inventory items."
  );
  return;
}

  const itemIdInput = document.getElementById("fItemId");
  const name = document.getElementById("fItemName").value.trim();
  const cat = document.getElementById("fItemCategory").value;
  const unit = document.getElementById("fItemUnit").value.trim() || "pcs";
  const stock = parseInt(document.getElementById("fItemCurrentStock").value, 10) || 0;
  const avgUsage = parseInt(document.getElementById("fItemAvgUsage").value, 10) || 1;
  const leadTime = parseInt(document.getElementById("fItemLeadTime").value, 10) || 7;

  let hasError = false;

  document.getElementById("errItemName").textContent = "";
  document.getElementById("errItemCategory").textContent = "";
  document.getElementById("errItemStock").textContent = "";

  if (!name) {
    document.getElementById("errItemName").textContent = "Item name is required.";
    hasError = true;
  }

  if (!cat) {
    document.getElementById("errItemCategory").textContent = "Please select a category.";
    hasError = true;
  }

  if (stock < 0) {
    document.getElementById("errItemStock").textContent = "Stock cannot be negative.";
    hasError = true;
  }

  if (hasError) return;

  try {
    let finalId = itemIdInput.value.trim();

    if (!editingItemId) {
      finalId = finalId || `ITM${String(store.length + 1).padStart(3, "0")}X`;
      itemIdInput.value = finalId;
    }

    const baseItem = {
      id: finalId,
      name,
      category: cat,
      unit,
      currentStock: stock,
      averageInventory: stock,
      avgMonthlyUsage: avgUsage,
      recencyDays: 0,
      leadTimeDays: leadTime,
      stockoutFrequency: 0,
      monthlyTurnoverRatio: stock > 0 ? Number((avgUsage / stock).toFixed(2)) : 0,
      transactions: [],
    };

    const { movement: ruleBasedMovement, ...computedIndicators } = rfClassify(baseItem);
    const finalItem = {
      ...baseItem,
      ...computedIndicators,
      ruleBasedMovement,
    };

    if (editingItemId) {
      await updateInventoryItem(finalId, finalItem);
      showToast("success", "Item updated.");
    } else {
      await createInventoryItem(finalItem);
      showToast("success", "New item added.");
    }

    closeModal("itemModalBackdrop");
    await loadInventory();
  } catch (error) {
    console.error("[saveItem]", error);
    showToast("error", error.message || "Failed to save item.");
  }
}

/* ── Category tabs ──────────────────────────────────── */
function buildCategoryFilter() {
  const input = document.getElementById("filterCategory");
  const options = document.getElementById("inventoryCategoryOptions");
  if (!input || !options) return;

  const categoryNames = [...new Set(
    store.map((i) => (i.category || "").trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
  if (activeTab !== "all" && !categoryNames.includes(activeTab)) activeTab = "all";

  options.replaceChildren(
    ...categoryNames.map((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      return option;
    })
  );
  input.value = activeTab === "all" ? "" : activeTab;
}

/* ── Modals / Toast ─────────────────────────────────── */
const openModal = (id) => document.getElementById(id)?.classList.add("open");
const closeModal = (id) => document.getElementById(id)?.classList.remove("open");
const closeAllModals = () =>
  ["stockInModalBackdrop", "stockOutModalBackdrop", "itemModalBackdrop"].forEach(closeModal);

let toastT;

function showToast(type, msg) {
  const t = document.getElementById("umToast");
  const i = document.getElementById("toastIcon");
  const m = document.getElementById("toastMsg");
  if (!t || !i || !m) return;

  const icons = {
    success: "bi-check-circle-fill",
    warning: "bi-exclamation-triangle-fill",
    error: "bi-x-circle-fill",
  };

  t.className = `um-toast show ${type}`;
  i.className = `bi ${icons[type] || icons.success}`;
  m.textContent = msg;

  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ── Init ───────────────────────────────────────────── */
async function init() {
  try {
    const session = await protectPageByModule("inventory");
    currentRole = session.role;
    renderTopbarUser();
    await loadSidebar();

    await loadInventory();

    document.getElementById("searchInventory")?.addEventListener("input", () => {
      applyFilters();
    });

    document.getElementById("filterCategory")?.addEventListener("input", () => {
      applyFilters();
    });

    document.getElementById("filterMovement")?.addEventListener("change", () => {
      applyFilters();
    });

    document.getElementById("filterRisk")?.addEventListener("change", () => {
      applyFilters();
    });

    document.getElementById("filterStockStatus")?.addEventListener("change", () => {
      applyFilters();
    });

    document.getElementById("clearInventoryFilters")?.addEventListener("click", clearInventoryFilters);

    const stockInButton = document.getElementById("btnStockIn");
const recordUsageButton = document.getElementById("btnRecordUsage");
const addItemButton = document.getElementById("btnAddItem");

if (stockInButton) {
  stockInButton.style.display = can("stock_in") ? "" : "none";

  if (can("stock_in")) {
    stockInButton.addEventListener("click", () => openBatchStockIn());
  }
}

if (recordUsageButton) {
  recordUsageButton.style.display = can("consume_general") ? "" : "none";

  if (can("consume_general")) {
    recordUsageButton.addEventListener("click", () => openBatchStockOut());
  }
}

if (addItemButton) {
  addItemButton.style.display = can("create") ? "" : "none";

  if (can("create")) {
    addItemButton.addEventListener("click", () => openItemModal());
  }
}

    document.getElementById("addStockInBatchRow")?.addEventListener("click", () => {
      addStockInBatchRow();
    });

    document.getElementById("addStockOutBatchRow")?.addEventListener("click", () => {
      addStockOutBatchRow();
    });

    document.getElementById("stockInClose")?.addEventListener("click", () => closeModal("stockInModalBackdrop"));
    document.getElementById("stockInCancel")?.addEventListener("click", () => closeModal("stockInModalBackdrop"));
    document.getElementById("stockInSave")?.addEventListener("click", () => {
      if (stockInMode === "batch") {
        saveBatchStockIn();
      } else {
        saveStockIn();
      }
    });

    document.getElementById("stockOutClose")?.addEventListener("click", () => closeModal("stockOutModalBackdrop"));
    document.getElementById("stockOutCancel")?.addEventListener("click", () => closeModal("stockOutModalBackdrop"));
    document.getElementById("stockOutSave")?.addEventListener("click", () => {
      if (stockOutMode === "batch") {
        saveBatchStockOut();
      } else {
        saveStockOut();
      }
    });

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
