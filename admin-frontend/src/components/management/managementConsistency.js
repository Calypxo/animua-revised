import "../../css/managementConsistency.css";

const PAGINATION_SELECTOR = ".um-pagination";

function compactPagination(bar) {
  if (!(bar instanceof HTMLElement)) return;
  const numericButtons = [...bar.querySelectorAll(".page-btn[data-page]")]
    .filter((button) => /^\d+$/.test(button.dataset.page || ""));
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

export function initializeManagementConsistency() {
  document.body.classList.add("management-consistent-ui");
  normalizePagination();
  if (document.documentElement.dataset.managementConsistencyObserver === "true") return;
  document.documentElement.dataset.managementConsistencyObserver = "true";
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      normalizePagination();
    });
  }).observe(document.body, { childList: true, subtree: true });
}
