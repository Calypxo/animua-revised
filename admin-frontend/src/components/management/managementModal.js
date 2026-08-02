import "../../css/managementModal.css";

const LAYER_SELECTOR = ".um-modal-backdrop, .modal-backdrop-custom";
const PANEL_SELECTOR = ".um-modal, .announcement-modal";

function syncBodyLock() {
  const hasOpenModal = [...document.querySelectorAll(LAYER_SELECTOR)]
    .some(layer => layer.classList.contains("open"));
  document.body.classList.toggle("management-modal-open", hasOpenModal);
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
  layer.setAttribute("aria-hidden", String(!layer.classList.contains("open")));

  new MutationObserver(() => {
    layer.setAttribute("aria-hidden", String(!layer.classList.contains("open")));
    syncBodyLock();
  }).observe(layer, { attributes: true, attributeFilter: ["class"] });
}

export function initializeManagementModals(root = document) {
  root.querySelectorAll(LAYER_SELECTOR).forEach(enhanceLayer);
  syncBodyLock();

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
