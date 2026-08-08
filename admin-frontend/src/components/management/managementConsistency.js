import "../../css/managementConsistency.css";
import "../../css/brandTheme.css";
import "../../css/managementResponsive.css";
import "../../css/managementTabs.css";

const PAGINATION_SELECTOR = ".um-pagination, .report-pagination";
const TABLIST_SELECTOR = [
  ".intake-tabs", ".aa-tabs", ".sr-tabs", ".archive-tabs", ".ap-tabs",
  ".um-tabs", ".inv-tabs", ".audit-view-switch", ".profile-tabs-bar", ".report-tabs",
].join(",");
const TAB_SELECTOR = TABLIST_SELECTOR.split(",")
  .map((selector) => `${selector} > button`)
  .join(",");

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

function normalizeActionButtons(root = document) {
  root.querySelectorAll(".tbl-action-btn, .detail-btn, .view-btn, .audit-review-btn, .modal-close-btn, .drawer-close-btn").forEach((button) => {
    if (button instanceof HTMLButtonElement) button.type = "button";
    if (!button.hasAttribute("aria-label") && button.getAttribute("title")) {
      button.setAttribute("aria-label", button.getAttribute("title"));
    }
    button.querySelectorAll("i").forEach((icon) => icon.setAttribute("aria-hidden", "true"));
  });
}

function normalizeInterface(root = document) {
  normalizePagination(root);
  normalizeTabs(root);
  normalizeTables(root);
  normalizeActionButtons(root);
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
  normalizeInterface();
  bindTabKeyboardNavigation();
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
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
}
