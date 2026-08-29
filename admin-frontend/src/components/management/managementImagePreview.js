const PREVIEWABLE_IMAGE_SELECTOR = [
  "body.management-consistent-ui .page-body img",
  "body.management-consistent-ui .drawer-body img",
  "body.management-consistent-ui .um-modal img",
  "body.management-consistent-ui .management-modal img",
  "body.management-consistent-ui .modal-content img",
].join(",");

const EXCLUDED_IMAGE_SELECTOR = [
  "[data-management-image-preview='off']",
  "[aria-hidden='true']",
  ".management-image-preview-image",
  ".navbar-logo-img",
  ".login-brand-logo",
].join(",");

let lastPreviewTrigger = null;

function isPreviewableImage(image) {
  return image instanceof HTMLImageElement
    && image.matches(PREVIEWABLE_IMAGE_SELECTOR)
    && !image.matches(EXCLUDED_IMAGE_SELECTOR)
    && !image.closest(".management-image-preview");
}

function previewSource(image) {
  return String(
    image.dataset.managementPreviewSrc
      || image.dataset.originalSrc
      || image.currentSrc
      || image.src
      || ""
  ).trim();
}

function previewLabel(image) {
  return String(
    image.dataset.managementPreviewLabel
      || image.alt
      || image.closest("figure")?.querySelector("figcaption")?.textContent
      || "Photo preview"
  ).trim();
}

function ensurePreviewDialog() {
  let dialog = document.getElementById("managementImagePreview");
  if (dialog) return dialog;

  dialog = document.createElement("div");
  dialog.id = "managementImagePreview";
  dialog.className = "management-image-preview";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "managementImagePreviewTitle");
  dialog.hidden = true;
  dialog.innerHTML = `
    <section class="management-image-preview-panel">
      <header class="management-image-preview-header">
        <div>
          <small>Image review</small>
          <h2 id="managementImagePreviewTitle">Photo preview</h2>
        </div>
        <button class="management-image-preview-close" type="button" aria-label="Close enlarged photo">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </header>
      <div class="management-image-preview-stage">
        <img class="management-image-preview-image" alt="" />
      </div>
      <footer class="management-image-preview-footer">
        <span><i class="bi bi-arrows-fullscreen" aria-hidden="true"></i> Fit to screen</span>
        <span>Press Esc or click outside to close</span>
      </footer>
    </section>
  `;
  document.body.append(dialog);

  const close = () => closeManagementImagePreview();
  dialog.querySelector(".management-image-preview-close")?.addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  return dialog;
}

function openManagementImagePreview(image) {
  const source = previewSource(image);
  if (!source) return;

  const dialog = ensurePreviewDialog();
  const previewImage = dialog.querySelector(".management-image-preview-image");
  const title = dialog.querySelector("#managementImagePreviewTitle");
  const label = previewLabel(image);

  lastPreviewTrigger = image;
  title.textContent = label;
  previewImage.alt = label;
  previewImage.src = source;
  dialog.hidden = false;
  document.body.classList.add("management-image-preview-open");
  requestAnimationFrame(() => {
    dialog.classList.add("is-open");
    dialog.querySelector(".management-image-preview-close")?.focus({ preventScroll: true });
  });
}

function closeManagementImagePreview() {
  const dialog = document.getElementById("managementImagePreview");
  if (!dialog || dialog.hidden) return;

  dialog.classList.remove("is-open");
  document.body.classList.remove("management-image-preview-open");
  window.setTimeout(() => {
    if (dialog.classList.contains("is-open")) return;
    dialog.hidden = true;
    const previewImage = dialog.querySelector(".management-image-preview-image");
    if (previewImage) previewImage.removeAttribute("src");
  }, 180);
  lastPreviewTrigger?.focus?.({ preventScroll: true });
  lastPreviewTrigger = null;
}

export function enhanceManagementImagePreviews(root = document) {
  const images = root instanceof HTMLImageElement
    ? [root]
    : [...root.querySelectorAll?.("img") || []];

  images.filter(isPreviewableImage).forEach((image) => {
    if (image.dataset.managementImagePreviewReady === "true") return;
    image.dataset.managementImagePreviewReady = "true";
    image.classList.add("management-image-preview-trigger");
    image.tabIndex = image.tabIndex >= 0 ? image.tabIndex : 0;
    image.setAttribute("role", "button");
    image.setAttribute("aria-label", `Enlarge ${previewLabel(image).toLowerCase()}`);
  });
}

export function initializeManagementImagePreview() {
  if (document.documentElement.dataset.managementImagePreview === "true") return;
  document.documentElement.dataset.managementImagePreview = "true";
  ensurePreviewDialog();

  document.addEventListener("click", (event) => {
    const image = event.target.closest?.("img");
    if (!isPreviewableImage(image)) return;
    if (image.closest("a, button") && image.dataset.managementImagePreview !== "true") return;
    event.preventDefault();
    event.stopPropagation();
    openManagementImagePreview(image);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeManagementImagePreview();
      return;
    }

    const dialog = document.getElementById("managementImagePreview");
    if (event.key === "Tab" && dialog && !dialog.hidden) {
      event.preventDefault();
      dialog.querySelector(".management-image-preview-close")?.focus({ preventScroll: true });
      return;
    }

    if (!["Enter", " "].includes(event.key) || !isPreviewableImage(event.target)) return;
    event.preventDefault();
    openManagementImagePreview(event.target);
  });
}
