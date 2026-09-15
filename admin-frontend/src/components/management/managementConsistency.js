import "../../css/managementConsistency.css";
import "../../css/brandTheme.css";
import "../../css/managementResponsive.css";
import "../../css/managementTabs.css";
import "../../css/managementTypography.css";
import "../../css/managementImagePreview.css";
import "../../css/requiredFields.css";
import { initializeRequiredFields, syncRequiredMarkers } from "./requiredFields.js";
import { enhanceResponsiveFilters } from "./responsiveFilters.js";
import {
  enhanceManagementImagePreviews,
  initializeManagementImagePreview,
} from "./managementImagePreview.js";

const PAGINATION_SELECTOR = ".um-pagination, .report-pagination";
const TABLIST_SELECTOR = [
  ".intake-tabs", ".aa-tabs", ".sr-tabs", ".archive-tabs", ".ap-tabs",
  ".um-tabs", ".inv-tabs", ".audit-view-switch", ".profile-tabs-bar", ".report-tabs",
].join(",");
const TAB_SELECTOR = TABLIST_SELECTOR.split(",")
  .map((selector) => `${selector} > button`)
  .join(",");
const RESPONSIVE_TABLE_SELECTOR = ".management-card-table[data-card-until]";
const MANAGEMENT_SEARCH_INPUT_SELECTOR = [
  "#searchIntake", "#searchApps", "#searchSR", "#searchInventory",
  "#reportSearch", "#searchAudit", "#searchArchive", "#resultSearch",
  "#searchUsers", "#searchAnimals", "#messageSearch", "#searchAnnouncement",
  "#globalSearch", "#animalSearch", "input#filterCategory", "#fMedInventorySearch",
].join(",");
const MANAGEMENT_SEARCH_CONTROL_SELECTOR = [
  ".search-pill", ".search-pill-sm", ".ap-control", ".cq-search",
  ".report-input", ".feed-search", ".medical-inventory-search",
  ".dashboard-animal-search-shell",
].join(",");

function managementViewportWidth() {
  try {
    if (window.parent !== window && window.parent.location.origin === window.location.origin) {
      return window.parent.innerWidth;
    }
  } catch {
    // Cross-origin preview frames use the current document viewport.
  }
  return window.innerWidth;
}

function syncResponsiveTables(root = document) {
  const viewportWidth = managementViewportWidth();
  root.querySelectorAll(RESPONSIVE_TABLE_SELECTOR).forEach((table) => {
    const cardUntil = Number(table.dataset.cardUntil);
    if (!Number.isFinite(cardUntil)) return;
    table.classList.toggle("management-card-active", viewportWidth <= cardUntil);
  });
}

function compactPagination(bar) {
  if (!(bar instanceof HTMLElement)) return;
  bar.setAttribute("role", "navigation");
  if (!bar.hasAttribute("aria-label")) bar.setAttribute("aria-label", "Table pagination");
  bar.querySelectorAll("button").forEach((button) => {
    button.type = "button";
    button.toggleAttribute("aria-current", button.classList.contains("active"));
    if (button.classList.contains("active")) button.setAttribute("aria-current", "page");
    button.querySelectorAll("i").forEach((icon) => icon.setAttribute("aria-hidden", "true"));
  });

  const numericButtons = [...bar.querySelectorAll(".page-btn[data-page], .report-page-btn[data-page]")]
    .filter((button) => /^\d+$/.test(button.textContent.trim()));
  if (!numericButtons.length) return;

  const pageNumbers = numericButtons.map((button) => Number(button.dataset.page));
  const totalPages = Math.max(...pageNumbers);
  const activeButton = numericButtons.find((button) => button.classList.contains("active"));
  const currentPage = Number(activeButton?.dataset.page || pageNumbers[0] || 1);
  if (bar.__animuaFirstPageButton === numericButtons[0]
      && bar.__animuaCurrentPage === currentPage
      && bar.__animuaTotalPages === totalPages) return;
  bar.__animuaFirstPageButton = numericButtons[0];
  bar.__animuaCurrentPage = currentPage;
  bar.__animuaTotalPages = totalPages;

  bar.querySelectorAll(".page-ellipsis").forEach((item) => item.remove());
  numericButtons.forEach((button) => { button.hidden = false; });
  if (totalPages <= 7) return;

  const visible = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]
    .filter((page) => page >= 1 && page <= totalPages));
  numericButtons.forEach((button) => { button.hidden = !visible.has(Number(button.dataset.page)); });

  const visibleButtons = numericButtons.filter((button) => !button.hidden);
  visibleButtons.forEach((button, index) => {
    if (!index) return;
    const previous = Number(visibleButtons[index - 1].dataset.page);
    const current = Number(button.dataset.page);
    if (current - previous <= 1) return;
    const ellipsis = document.createElement("span");
    ellipsis.className = "page-ellipsis";
    ellipsis.setAttribute("aria-hidden", "true");
    ellipsis.textContent = "\u2026";
    button.before(ellipsis);
  });
}

function normalizePagination(root = document) {
  root.querySelectorAll(PAGINATION_SELECTOR).forEach(compactPagination);
}

function normalizeTabs(root = document) {
  root.querySelectorAll(TABLIST_SELECTOR).forEach((tablist) => {
    tablist.setAttribute("role", "tablist");
    const tabs = [...tablist.children].filter((item) => item.matches?.("button"));
    const selectedTab = tabs.find((tab) => tab.classList.contains("active")) || tabs[0];
    tabs.forEach((tab) => {
      tab.type = "button";
      tab.setAttribute("role", "tab");
      const selected = tab === selectedTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.querySelectorAll("i").forEach((icon) => icon.setAttribute("aria-hidden", "true"));
    });
  });
}

function normalizeTables(root = document) {
  root.querySelectorAll(".management-data-table").forEach((table) => {
    table.querySelectorAll("thead th").forEach((heading) => {
      heading.setAttribute("scope", "col");
      const label = heading.textContent.trim().toLowerCase();
      if (label === "actions" || label.includes("review")) heading.classList.add("management-actions-heading");
    });
    table.querySelectorAll("tbody tr").forEach((row) => {
      [...row.children].forEach((cell) => {
        if (cell.querySelector(":scope > .tbl-action-btn, :scope > .detail-btn, :scope > .audit-review-btn, :scope > .table-actions, :scope > .action-group")) {
          cell.classList.add("management-actions-cell");
        }
      });
    });
  });
}

function normalizeSearchControls(root = document) {
  root.querySelectorAll(MANAGEMENT_SEARCH_INPUT_SELECTOR).forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    const control = input.closest(MANAGEMENT_SEARCH_CONTROL_SELECTOR);
    if (!(control instanceof HTMLElement)) return;

    control.classList.add("management-search-control");
    input.classList.add("management-search-input");
    const icon = control.querySelector(":scope > i.bi-search, :scope > i.bi-tag");
    icon?.classList.add("management-search-icon");
  });
}

function hasAccessibleName(button) {
  if (!(button instanceof HTMLElement)) return true;
  const ariaLabel = button.getAttribute("aria-label")?.trim();
  if (ariaLabel) return true;

  const labelledBy = button.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelText = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() || "")
      .join(" ")
      .trim();
    if (labelText) return true;
  }

  return Boolean(button.textContent?.trim() || button.getAttribute("title")?.trim());
}

function iconLabel(button) {
  const icon = button.querySelector("i[class*='bi-']");
  const classes = icon?.className || "";
  const iconLabels = [
    [/bi-list/, "Toggle management navigation"],
    [/bi-bell/, "Open management notifications"],
    [/bi-x|bi-x-lg|bi-x-circle/, "Close"],
    [/bi-chevron-left|bi-arrow-left/, "Previous page"],
    [/bi-chevron-right|bi-arrow-right/, "Next page"],
    [/bi-arrow-counterclockwise|bi-arrow-clockwise/, "Reset"],
    [/bi-eye/, "Show password"],
    [/bi-pencil|bi-pen/, "Edit"],
    [/bi-trash|bi-archive/, "Delete"],
    [/bi-search/, "Search"],
    [/bi-plus|bi-plus-lg|bi-plus-circle/, "Add"],
    [/bi-dash|bi-dash-lg/, "Remove"],
    [/bi-check|bi-check-lg|bi-check-circle/, "Confirm"],
    [/bi-calendar/, "Open date action"],
    [/bi-file|bi-clipboard/, "Open record"],
  ];
  return iconLabels.find(([pattern]) => pattern.test(classes))?.[1] || "";
}

function inferredButtonLabel(button) {
  const id = button.id || "";
  const className = button.className || "";
  const action = button.dataset?.action || button.dataset?.clearanceDecision || "";
  const combined = `${id} ${className} ${action}`.toLowerCase();

  if (button.getAttribute("title")?.trim()) return button.getAttribute("title").trim();
  if (button.closest(PAGINATION_SELECTOR)) {
    if (/prev|previous|chevron-left|arrow-left/.test(combined)) return "Previous page";
    if (/next|chevron-right|arrow-right/.test(combined)) return "Next page";
    if (/^\d+$/.test(button.textContent?.trim() || "")) return `Go to page ${button.textContent.trim()}`;
  }

  const patternLabels = [
    [/sidebar.*toggle|menu-toggle|nav-toggle|icon-btn/, "Toggle management navigation"],
    [/notif|notification|attention/, "Open management notifications"],
    [/close|dismiss|drawerclose|modalclose|x\b/, "Close"],
    [/cancel/, "Cancel"],
    [/save|draft/, "Save"],
    [/submit|send/, "Submit"],
    [/confirm|approve|clear/, "Confirm"],
    [/reject|danger|deactivate|delete|remove/, "Reject or remove"],
    [/restore/, "Restore"],
    [/edit|update/, "Edit"],
    [/view|detail|review|open/, "View details"],
    [/filter|clear/, "Clear filters"],
    [/add|create|new/, "Add record"],
    [/refresh|reload/, "Refresh"],
    [/arrival/, "Confirm arrival"],
    [/noshow|no-show/, "Mark no-show"],
    [/extend/, "Extend deadline"],
    [/logout|signout|sign-out/, "Sign out"],
  ];

  return patternLabels.find(([pattern]) => pattern.test(combined))?.[1] || iconLabel(button) || "Button";
}

function normalizeActionButtons(root = document) {
  root.querySelectorAll("button").forEach((button) => {
    if (button instanceof HTMLButtonElement && !button.hasAttribute("type")) {
      button.type = "button";
    }
    button.querySelectorAll("i").forEach((icon) => icon.setAttribute("aria-hidden", "true"));
    if (hasAccessibleName(button)) return;
    button.setAttribute("aria-label", inferredButtonLabel(button));
  });
}

function normalizeInterface(root = document) {
  syncRequiredMarkers(root);
  enhanceResponsiveFilters(root);
  enhanceManagementImagePreviews(root);
  normalizeSearchControls(root);
  syncResponsiveTables(root);
  normalizePagination(root);
  normalizeTabs(root);
  normalizeTables(root);
  normalizeActionButtons(root);
}

function bindResponsiveTableSync() {
  if (document.documentElement.dataset.managementTableSync === "true") return;
  document.documentElement.dataset.managementTableSync = "true";
  let scheduled = false;
  const scheduleSync = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      syncResponsiveTables();
    });
  };
  window.addEventListener("resize", scheduleSync, { passive: true });
  window.addEventListener("orientationchange", scheduleSync, { passive: true });
}

function bindTabKeyboardNavigation() {
  if (document.documentElement.dataset.managementTabsKeyboard === "true") return;
  document.documentElement.dataset.managementTabsKeyboard = "true";
  document.addEventListener("keydown", (event) => {
    if (!event.target.matches?.(TAB_SELECTOR)) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...event.target.parentElement.children].filter((item) => item.matches?.("button:not(:disabled)"));
    const current = tabs.indexOf(event.target);
    if (current < 0 || !tabs.length) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
    tabs[next].click();
  });
}

export function initializeManagementConsistency() {
  document.body.classList.add("management-consistent-ui");
  initializeRequiredFields();
  initializeManagementImagePreview();
  normalizeInterface();
  bindTabKeyboardNavigation();
  bindResponsiveTableSync();
  if (document.documentElement.dataset.managementConsistencyObserver === "true") return;
  document.documentElement.dataset.managementConsistencyObserver = "true";
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      normalizeInterface();
    });
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "required", "disabled", "aria-required"] });
}
