import "../../css/managementModal.css";

const LAYER_SELECTOR = ".um-modal-backdrop, .modal-backdrop-custom";
const PANEL_SELECTOR = ".um-modal, .announcement-modal";
const CLOSE_SELECTOR = ".modal-close-btn, .drawer-close-btn, [data-modal-close]";
const OPEN_LAYER_SELECTOR = LAYER_SELECTOR.split(",")
  .map((selector) => `${selector.trim()}.open`)
  .join(",");
const FOCUSABLE_SELECTOR = [
  "a[href]", "button:not([disabled])", "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])", "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");
let modalId = 0;
const returnFocus = new WeakMap();

function syncBodyLock() {
  const hasOpenModal = [...document.querySelectorAll(LAYER_SELECTOR)]
    .some(layer => layer.classList.contains("open"));
  document.body.classList.toggle("management-modal-open", hasOpenModal);
}

function ensureAccessibleMarkup(layer, panel) {
  const title = panel.querySelector(":scope > .um-modal-header h2, :scope > .modal-head h2, .drawer-header h3");
  const subtitle = panel.querySelector(":scope > .um-modal-header .modal-subtitle, :scope > .modal-head .modal-subtitle, .drawer-header p");

  if (title && !panel.hasAttribute("aria-label") && !panel.hasAttribute("aria-labelledby")) {
    title.id ||= `management-modal-title-${++modalId}`;
    panel.setAttribute("aria-labelledby", title.id);
  }
  if (subtitle && !panel.hasAttribute("aria-describedby")) {
    subtitle.id ||= `management-modal-description-${++modalId}`;
    panel.setAttribute("aria-describedby", subtitle.id);
  }

  panel.querySelectorAll(CLOSE_SELECTOR).forEach((button) => {
    if (button instanceof HTMLButtonElement) button.type = "button";
    if (!button.hasAttribute("aria-label")) {
      button.setAttribute("aria-label", title ? `Close ${title.textContent.trim()}` : "Close dialog");
    }
    button.querySelectorAll("i").forEach((icon) => icon.setAttribute("aria-hidden", "true"));
  });
}

function focusOpenedModal(layer, panel) {
  if (!returnFocus.has(layer)) returnFocus.set(layer, document.activeElement);
  requestAnimationFrame(() => {
    if (!layer.classList.contains("open") || panel.contains(document.activeElement)) return;
    const target = panel.querySelector("[autofocus]")
      || (panel.classList.contains("management-confirm-modal") && panel.querySelector(".btn-ghost-clay, [data-modal-cancel]"))
      || panel.querySelector("input:not([type='hidden']):not([disabled]), textarea:not([disabled]), select:not([disabled])")
      || panel.querySelector("button:not([disabled]), a[href]");
    target?.focus({ preventScroll: true });
  });
}

function restoreModalFocus(layer) {
  const target = returnFocus.get(layer);
  returnFocus.delete(layer);
  if (target instanceof HTMLElement && target.isConnected) target.focus({ preventScroll: true });
}

function bindModalKeyboardNavigation() {
  if (document.documentElement.dataset.managementModalKeyboard === "true") return;
  document.documentElement.dataset.managementModalKeyboard = "true";

  document.addEventListener("keydown", (event) => {
    const layers = [...document.querySelectorAll(OPEN_LAYER_SELECTOR)];
    const layer = layers.at(-1);
    if (!layer) return;
    const panel = layer.querySelector(PANEL_SELECTOR);
    if (!panel) return;

    if (event.key === "Escape") {
      const closeButton = panel.querySelector(CLOSE_SELECTOR);
      if (!closeButton) return;
      event.preventDefault();
      closeButton.click();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = [...panel.querySelectorAll(FOCUSABLE_SELECTOR)]
      .filter((item) => item.getClientRects().length > 0);
    if (!focusable.length) {
      event.preventDefault();
      panel.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

function enhanceLayer(layer) {
  if (!(layer instanceof HTMLElement) || layer.dataset.managementModalReady === "true") return;

  const panel = layer.querySelector(PANEL_SELECTOR);
  if (!panel) return;

  const isConfirmModal = panel.classList.contains("um-modal-xs");

  layer.dataset.managementModalReady = "true";
  layer.classList.add("management-modal-layer");
  if (isConfirmModal) {
    layer.classList.add("management-confirm-layer");
    panel.classList.add("management-confirm-modal");
    panel.classList.remove("management-side-modal");
  } else {
    panel.classList.add("management-side-modal");
  }
  panel.setAttribute("role", panel.getAttribute("role") || "dialog");
  panel.setAttribute("aria-modal", "true");
  if (!panel.hasAttribute("tabindex")) panel.tabIndex = -1;
  ensureAccessibleMarkup(layer, panel);
  layer.setAttribute("aria-hidden", String(!layer.classList.contains("open")));

  let wasOpen = layer.classList.contains("open");
  if (wasOpen) focusOpenedModal(layer, panel);

  new MutationObserver(() => {
    const isOpen = layer.classList.contains("open");
    layer.setAttribute("aria-hidden", String(!isOpen));
    if (isOpen && !wasOpen) focusOpenedModal(layer, panel);
    if (!isOpen && wasOpen) restoreModalFocus(layer);
    wasOpen = isOpen;
    syncBodyLock();
  }).observe(layer, { attributes: true, attributeFilter: ["class"] });
}

export function initializeManagementModals(root = document) {
  root.querySelectorAll(LAYER_SELECTOR).forEach(enhanceLayer);
  syncBodyLock();
  bindModalKeyboardNavigation();

  if (document.documentElement.dataset.managementModalObserver === "true") return;
  document.documentElement.dataset.managementModalObserver = "true";

  new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches(LAYER_SELECTOR)) enhanceLayer(node);
      node.querySelectorAll?.(LAYER_SELECTOR).forEach(enhanceLayer);
    }));
  }).observe(document.body, { childList: true, subtree: true });
}
